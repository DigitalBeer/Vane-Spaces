import db from '@/lib/db';
import { chats, messages, spaces, digestTopics } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import ModelRegistry from '@/lib/models/registry';
import SessionManager from '@/lib/session';
import SearchAgent from '@/lib/agents/search';
import { computeNextRunAt } from './schedule';
import { SearchSources } from '@/lib/agents/search/types';

type DigestTopicRow = typeof digestTopics.$inferSelect;

export async function runDigest(topic: DigestTopicRow): Promise<void> {
  const nowIso = (): string => new Date().toISOString();
  let systemInstructions = 'None';
  let fileIds: string[] = [];
  const sources: SearchSources[] = topic.sources ?? [];
  if (topic.spaceId) {
    const space = await db.query.spaces.findFirst({ where: eq(spaces.id, topic.spaceId) });
    if (space) {
      if (space.instructions) systemInstructions = `[Space: ${space.name}]\n${space.instructions}`;
      const spaceFileIds: string[] = [
        ...(space.files ?? []).map((f: { fileId: string; name: string }) => f.fileId),
        ...(space.webSources ?? [])
          .filter((s: { status: string; fileId: string | null }) => s.status === 'ready' && s.fileId)
          .map((s: { fileId: string | null }) => s.fileId as string),
      ];
      if (space.defaultSourceScope === 'space' || space.defaultSourceScope === 'both') {
        fileIds = [...fileIds, ...spaceFileIds];
      }
    }
  }
  if (topic.instructions) systemInstructions = systemInstructions === 'None' ? topic.instructions : `${systemInstructions}\n\n${topic.instructions}`;

  const schedule = { frequency: topic.frequency, timeOfDay: topic.timeOfDay, dayOfWeek: topic.dayOfWeek };

  const registry = new ModelRegistry();
  let llm; let embedding;
  try {
    const loaded = await Promise.all([
      registry.loadChatModel(topic.chatModelProviderId, topic.chatModelKey),
      registry.loadEmbeddingModel(topic.embeddingModelProviderId, topic.embeddingModelKey),
    ]);
    llm = loaded[0];
    embedding = loaded[1];
  } catch (err) {
    await db.update(digestTopics).set({
      lastRunError: `Model load failed: ${String(err)}`,
      nextRunAt: computeNextRunAt(schedule, new Date()),
      updatedAt: nowIso(),
    }).where(eq(digestTopics.id, topic.id));
    return;
  }

  const chatId = crypto.randomUUID();
  await db.insert(chats).values({
    id: chatId,
    title: `${topic.name} — ${new Date().toLocaleDateString()}`,
    createdAt: nowIso(),
    sources,
    files: [],
    spaceId: topic.spaceId ?? null,
    origin: 'digest',
    digestId: topic.id,
  });

  const agent = new SearchAgent();
  const errors: string[] = [];
  const queries: string[] = topic.queries ?? [];
  for (const query of queries) {
    const session = SessionManager.createSession();
    const messageId = crypto.randomUUID();
    try {
      await agent.searchAsync(session, {
        chatHistory: [],
        followUp: query,
        chatId,
        messageId,
        config: {
          llm,
          embedding,
          sources,
          mode: topic.optimizationMode,
          fileIds,
          systemInstructions,
          excludedDomains: topic.excludedDomains ?? [],
        },
      });
    } catch (err) {
      errors.push(`"${query}": ${String(err)}`);
      await db.update(messages)
        .set({ status: 'error' })
        .where(and(eq(messages.chatId, chatId), eq(messages.messageId, messageId)));
    }
  }

  await db.update(digestTopics).set({
    lastRunAt: nowIso(),
    lastRunChatId: chatId,
    lastRunError: errors.length > 0 ? errors.join('; ') : null,
    nextRunAt: computeNextRunAt(schedule, new Date()),
    updatedAt: nowIso(),
  }).where(eq(digestTopics.id, topic.id));
}
