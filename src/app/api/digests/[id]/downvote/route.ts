import db from '@/lib/db';
import { digestTopics } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { checkRateLimit, rateLimitResponse } from '@/lib/rateLimit';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const rl = checkRateLimit(req);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterSeconds!);
  try {
    const { id } = await params;
    const body = await req.json();
    const url: string = typeof body.url === 'string' ? body.url : '';
    if (!url) return Response.json({ message: 'url is required.' }, { status: 400 });

    let host: string;
    try {
      host = new URL(url).hostname;
    } catch {
      return Response.json({ message: 'Invalid url.' }, { status: 400 });
    }
    if (host.startsWith('www.')) host = host.slice(4);
    if (!host) return Response.json({ message: 'Could not resolve a domain from url.' }, { status: 400 });

    const digest = await db.query.digestTopics.findFirst({ where: eq(digestTopics.id, id) });
    if (!digest) return Response.json({ message: 'Digest not found' }, { status: 404 });

    const domains: string[] = digest.excludedDomains ?? [];
    if (!domains.includes(host)) domains.push(host);

    await db.update(digestTopics)
      .set({ excludedDomains: domains, updatedAt: new Date().toISOString() })
      .where(eq(digestTopics.id, id));

    return Response.json({ excludedDomains: domains }, { status: 200 });
  } catch (err) {
    console.error('Error downvoting digest source:', err);
    return Response.json({ message: 'An error has occurred.' }, { status: 500 });
  }
}
