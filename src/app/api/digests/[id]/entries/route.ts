import db from '@/lib/db';
import { chats, messages } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { Block, Chunk } from '@/lib/types';
import { checkRateLimit, rateLimitResponse } from '@/lib/rateLimit';

type EntrySource = { title: string; url: string };
type DigestEntry = {
  chatId: string;
  title: string;
  createdAt: string;
  statuses: (string | null)[];
  snippet: string;
  sources: EntrySource[];
};

function makeSnippet(text: string): string {
  const cleaned: string = text
    .replace(/<\/?citation[^>]*>/gi, '')
    .replace(/\[\/?citation[^\]]*\]/gi, '')
    .replace(/[#*`>_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.length > 280 ? cleaned.slice(0, 280).trimEnd() + '…' : cleaned;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const rl = checkRateLimit(req);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterSeconds!);
  try {
    const { id } = await params;
    const entryChats = await db.query.chats.findMany({
      where: eq(chats.digestId, id),
      orderBy: (c, { desc }) => [desc(c.createdAt)],
    });

    const entries: DigestEntry[] = [];
    for (const entry of entryChats) {
      const msgs = await db.query.messages.findMany({ where: eq(messages.chatId, entry.id) });

      let snippet = '';
      const firstMsg = msgs[0];
      if (firstMsg && Array.isArray(firstMsg.responseBlocks)) {
        const textBlock = (firstMsg.responseBlocks as Block[]).find((b: Block) => b.type === 'text');
        if (textBlock && textBlock.type === 'text') snippet = makeSnippet(textBlock.data);
      }

      const seen = new Set<string>();
      const sources: EntrySource[] = [];
      for (const m of msgs) {
        if (!Array.isArray(m.responseBlocks)) continue;
        for (const b of m.responseBlocks as Block[]) {
          if (b.type !== 'source') continue;
          for (const c of b.data as Chunk[]) {
            const url: string = c.metadata?.url ?? '';
            if (!url || seen.has(url)) continue;
            seen.add(url);
            sources.push({ title: c.metadata?.title ?? url, url });
            if (sources.length >= 12) break;
          }
          if (sources.length >= 12) break;
        }
        if (sources.length >= 12) break;
      }

      entries.push({
        chatId: entry.id,
        title: entry.title,
        createdAt: entry.createdAt,
        statuses: msgs.map((m: typeof messages.$inferSelect) => m.status),
        snippet,
        sources,
      });
    }

    return Response.json({ entries }, { status: 200 });
  } catch (err) {
    console.error('Error fetching digest entries:', err);
    return Response.json({ message: 'An error has occurred.' }, { status: 500 });
  }
}
