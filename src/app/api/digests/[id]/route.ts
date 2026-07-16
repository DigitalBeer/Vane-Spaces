import db from '@/lib/db';
import { digestTopics } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { computeNextRunAt } from '@/lib/digests/schedule';
import { checkRateLimit, rateLimitResponse } from '@/lib/rateLimit';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const rl = checkRateLimit(req);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterSeconds!);
  try {
    const { id } = await params;
    const digest = await db.query.digestTopics.findFirst({ where: eq(digestTopics.id, id) });
    if (!digest) return Response.json({ message: 'Digest not found' }, { status: 404 });
    return Response.json({ digest }, { status: 200 });
  } catch (err) {
    console.error('Error fetching digest:', err);
    return Response.json({ message: 'An error has occurred.' }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const rl = checkRateLimit(req);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterSeconds!);
  try {
    const { id } = await params;
    const body = await req.json();
    const existing = await db.query.digestTopics.findFirst({ where: eq(digestTopics.id, id) });
    if (!existing) return Response.json({ message: 'Digest not found' }, { status: 404 });

    const updates: Record<string, unknown> = {};
    if (typeof body.name === 'string') updates.name = body.name.trim();
    if (Array.isArray(body.queries)) updates.queries = body.queries.map((q: unknown) => String(q).trim()).filter((q: string) => q.length > 0);
    if (typeof body.instructions === 'string' || body.instructions === null) updates.instructions = body.instructions;
    if (Array.isArray(body.excludedDomains)) updates.excludedDomains = body.excludedDomains.map((d: unknown) => String(d));
    if (Array.isArray(body.sources)) updates.sources = body.sources;
    if (body.optimizationMode === 'speed' || body.optimizationMode === 'balanced' || body.optimizationMode === 'quality') updates.optimizationMode = body.optimizationMode;
    if (typeof body.enabled === 'boolean') updates.enabled = body.enabled;
    if ('spaceId' in body) updates.spaceId = body.spaceId ?? null;
    if (body.frequency === 'daily' || body.frequency === 'weekly') updates.frequency = body.frequency;
    if (typeof body.timeOfDay === 'string' && /^\d{2}:\d{2}$/.test(body.timeOfDay)) updates.timeOfDay = body.timeOfDay;
    if (typeof body.dayOfWeek === 'number' || body.dayOfWeek === null) updates.dayOfWeek = body.dayOfWeek;

    const scheduleChanged: boolean =
      'frequency' in updates || 'timeOfDay' in updates || 'dayOfWeek' in updates;
    if (scheduleChanged) {
      const frequency = (updates.frequency ?? existing.frequency) as 'daily' | 'weekly';
      const timeOfDay = (updates.timeOfDay ?? existing.timeOfDay) as string;
      const dayOfWeek = ('dayOfWeek' in updates ? updates.dayOfWeek : existing.dayOfWeek) as number | null;
      if (
        frequency === 'weekly' &&
        (dayOfWeek === null || Number.isNaN(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6)
      ) {
        return Response.json(
          { message: 'dayOfWeek (0-6) is required when frequency is weekly.' },
          { status: 400 },
        );
      }
      updates.nextRunAt = computeNextRunAt({ frequency, timeOfDay, dayOfWeek }, new Date());
    }

    updates.updatedAt = new Date().toISOString();

    await db.update(digestTopics).set(updates).where(eq(digestTopics.id, id));
    const updated = await db.query.digestTopics.findFirst({ where: eq(digestTopics.id, id) });
    return Response.json({ digest: updated }, { status: 200 });
  } catch (err) {
    console.error('Error updating digest:', err);
    return Response.json({ message: 'An error has occurred.' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const rl = checkRateLimit(req);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterSeconds!);
  try {
    const { id } = await params;
    const existing = await db.query.digestTopics.findFirst({ where: eq(digestTopics.id, id) });
    if (!existing) return Response.json({ message: 'Digest not found' }, { status: 404 });
    await db.delete(digestTopics).where(eq(digestTopics.id, id));
    return Response.json({ message: 'deleted' }, { status: 200 });
  } catch (err) {
    console.error('Error deleting digest:', err);
    return Response.json({ message: 'An error has occurred.' }, { status: 500 });
  }
}
