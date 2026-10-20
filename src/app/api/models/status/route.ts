import { getConfiguredModelProviders } from '@/lib/config/serverRegistry';
import { ModelHealthStore } from '@/lib/models/modelHealth';
import {
  checkFreeModels,
  ConfiguredModel,
  fetchOpenRouterCatalogue,
  isFreeModelId,
  isOpenRouterProvider,
} from '@/lib/models/freeModelCheck';
import { checkRateLimit, rateLimitResponse } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type SelectedModel = { providerId: string; key: string };

/**
 * Model status for the Settings > Models screen: free OpenRouter models that
 * are no longer free (with a suggested replacement), whether added to a
 * connection by hand or only selected in a picker, and models currently
 * benched after failing at runtime.
 */
async function buildStatus(selected: SelectedModel[]) {
  const providers = getConfiguredModelProviders();
  const openRouter = providers.filter((p) => isOpenRouterProvider(p as never));

  const toCheck = new Map<string, ConfiguredModel>();
  for (const p of openRouter) {
    for (const m of p.chatModels) {
      if (!isFreeModelId(m.key)) continue;
      toCheck.set(`${p.id}/${m.key}`, {
        providerId: p.id,
        providerName: p.name,
        modelKey: m.key,
        configured: true,
      });
    }
  }
  // Models picked from the live free list aren't in the config, so the
  // browser tells us what it has selected.
  for (const s of selected) {
    const p = openRouter.find((o) => o.id === s.providerId);
    if (!p || !isFreeModelId(s.key) || toCheck.has(`${p.id}/${s.key}`)) continue;
    toCheck.set(`${p.id}/${s.key}`, {
      providerId: p.id,
      providerName: p.name,
      modelKey: s.key,
      configured: false,
    });
  }

  const verdicts =
    toCheck.size > 0
      ? checkFreeModels([...toCheck.values()], await fetchOpenRouterCatalogue())
      : [];

  const names = new Map(providers.map((p) => [p.id, p.name]));
  const benched = new ModelHealthStore().list().map((b) => {
    const [providerId, ...rest] = b.key.split('/');
    return {
      ...b,
      providerId,
      providerName: names.get(providerId) ?? providerId,
      modelKey: rest.join('/'),
    };
  });

  return { freeModels: verdicts, benched };
}

export const GET = async (req: Request): Promise<Response> => {
  const rl = checkRateLimit(req);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterSeconds!);
  try {
    return Response.json(await buildStatus([]), { status: 200 });
  } catch (err) {
    console.error('Error checking model status:', err);
    return Response.json({ message: 'An error has occurred.' }, { status: 500 });
  }
};

/** Same as GET, also checking the models this browser has selected. Body: { selected: [{ providerId, key }] }. */
export const POST = async (req: Request): Promise<Response> => {
  const rl = checkRateLimit(req);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterSeconds!);
  try {
    const body = await req.json().catch(() => ({}));
    const selected: SelectedModel[] = Array.isArray(body?.selected)
      ? body.selected.filter(
          (s: unknown): s is SelectedModel =>
            !!s &&
            typeof (s as SelectedModel).providerId === 'string' &&
            typeof (s as SelectedModel).key === 'string',
        )
      : [];
    return Response.json(await buildStatus(selected), { status: 200 });
  } catch (err) {
    console.error('Error checking model status:', err);
    return Response.json({ message: 'An error has occurred.' }, { status: 500 });
  }
};

/** Clears a bench early, e.g. after the user fixed a provider. Body: { key }. */
export const DELETE = async (req: Request): Promise<Response> => {
  const rl = checkRateLimit(req);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterSeconds!);
  try {
    const { key } = await req.json();
    if (typeof key !== 'string' || !key) {
      return Response.json({ message: 'key is required.' }, { status: 400 });
    }
    new ModelHealthStore().clear(key);
    return Response.json({ message: 'Cleared.' }, { status: 200 });
  } catch (err) {
    console.error('Error clearing model status:', err);
    return Response.json({ message: 'An error has occurred.' }, { status: 500 });
  }
};
