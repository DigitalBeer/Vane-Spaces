import db from '@/lib/db';
import { digestTopics } from '@/lib/db/schema';
import ModelRegistry from '@/lib/models/registry';
import { computeNextRunAt } from '@/lib/digests/schedule';
import crypto from 'crypto';

export const GET = async (): Promise<Response> => {
  try {
    const digests = await db.query.digestTopics.findMany({
      orderBy: (t, { desc }) => [desc(t.createdAt)],
    });
    return Response.json({ digests }, { status: 200 });
  } catch (err) {
    console.error('Error listing digests:', err);
    return Response.json({ message: 'An error has occurred.' }, { status: 500 });
  }
};

export const POST = async (req: Request): Promise<Response> => {
  try {
    const body = await req.json();
    const name: string = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) return Response.json({ message: 'Name is required.' }, { status: 400 });

    const queries: string[] = Array.isArray(body.queries)
      ? body.queries.map((q: unknown) => String(q).trim()).filter((q: string) => q.length > 0)
      : [];
    if (queries.length === 0) return Response.json({ message: 'At least one query is required.' }, { status: 400 });

    const frequency: unknown = body.frequency;
    if (frequency !== 'daily' && frequency !== 'weekly')
      return Response.json({ message: 'frequency must be daily or weekly.' }, { status: 400 });

    const timeOfDay: string = typeof body.timeOfDay === 'string' ? body.timeOfDay : '';
    if (!/^\d{2}:\d{2}$/.test(timeOfDay))
      return Response.json({ message: 'timeOfDay must be HH:MM.' }, { status: 400 });

    const dayOfWeek: number | null =
      frequency === 'weekly'
        ? (typeof body.dayOfWeek === 'number' ? body.dayOfWeek : NaN)
        : null;
    if (frequency === 'weekly' && (dayOfWeek === null || Number.isNaN(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6))
      return Response.json({ message: 'dayOfWeek (0-6) is required for weekly.' }, { status: 400 });

    const chatModelProviderId: string = String(body.chatModelProviderId ?? '');
    const chatModelKey: string = String(body.chatModelKey ?? '');
    const embeddingModelProviderId: string = String(body.embeddingModelProviderId ?? '');
    const embeddingModelKey: string = String(body.embeddingModelKey ?? '');
    if (!chatModelProviderId || !chatModelKey || !embeddingModelProviderId || !embeddingModelKey)
      return Response.json({ message: 'Chat and embedding model provider/key are required.' }, { status: 400 });

    // validate the chosen models exist
    const registry = new ModelRegistry();
    const providers = await registry.getActiveProviders();
    const chatProvider = providers.find((p: { id: string }) => p.id === chatModelProviderId);
    const embedProvider = providers.find((p: { id: string }) => p.id === embeddingModelProviderId);
    const chatOk = !!chatProvider && chatProvider.chatModels.some((m: { key: string }) => m.key === chatModelKey);
    const embedOk = !!embedProvider && embedProvider.embeddingModels.some((m: { key: string }) => m.key === embeddingModelKey);
    if (!chatOk) return Response.json({ message: 'Selected chat model is not configured.' }, { status: 400 });
    if (!embedOk) return Response.json({ message: 'Selected embedding model is not configured.' }, { status: 400 });

    const now: string = new Date().toISOString();
    const nextRunAt: string = computeNextRunAt({ frequency: frequency as 'daily' | 'weekly', timeOfDay, dayOfWeek }, new Date());

    const [digest] = await db.insert(digestTopics).values({
      id: crypto.randomUUID(),
      name,
      spaceId: body.spaceId ?? null,
      queries,
      instructions: typeof body.instructions === 'string' ? body.instructions : null,
      excludedDomains: Array.isArray(body.excludedDomains) ? body.excludedDomains.map((d: unknown) => String(d)) : [],
      frequency: frequency as 'daily' | 'weekly',
      timeOfDay,
      dayOfWeek,
      enabled: typeof body.enabled === 'boolean' ? body.enabled : true,
      sources: Array.isArray(body.sources) ? body.sources : [],
      optimizationMode: body.optimizationMode === 'speed' || body.optimizationMode === 'quality' ? body.optimizationMode : 'balanced',
      chatModelProviderId,
      chatModelKey,
      embeddingModelProviderId,
      embeddingModelKey,
      nextRunAt,
      createdAt: now,
      updatedAt: now,
    }).returning();

    return Response.json({ digest }, { status: 201 });
  } catch (err) {
    console.error('Error creating digest:', err);
    return Response.json({ message: 'An error has occurred.' }, { status: 500 });
  }
};
