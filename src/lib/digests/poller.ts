import db from '@/lib/db';
import { digestTopics } from '@/lib/db/schema';
import { and, eq, lte } from 'drizzle-orm';
import { runDigest } from './runner';

const POLL_INTERVAL_MS = 60_000;
const inFlight = new Set<string>();

async function tick(): Promise<void> {
  const nowIso: string = new Date().toISOString();
  const due = await db.query.digestTopics.findMany({
    where: and(eq(digestTopics.enabled, true), lte(digestTopics.nextRunAt, nowIso)),
  });

  for (const topic of due) {
    if (inFlight.has(topic.id)) continue;
    inFlight.add(topic.id);
    try {
      await runDigest(topic);
    } catch (err) {
      console.error(`[digest-poller] runDigest failed for ${topic.id}:`, err);
    } finally {
      inFlight.delete(topic.id);
    }
  }
}

export function startDigestPoller(): void {
  if ((global as unknown as { _digestPollerStarted?: boolean })._digestPollerStarted) return;
  (global as unknown as { _digestPollerStarted?: boolean })._digestPollerStarted = true;
  setInterval(() => { void tick(); }, POLL_INTERVAL_MS);
  console.log('[digest-poller] started');
}
