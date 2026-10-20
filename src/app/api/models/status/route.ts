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

/**
 * Model status for the Settings > Models screen: configured free OpenRouter
 * models that are no longer free (with a suggested replacement), and models
 * currently benched after failing at runtime.
 */
export const GET = async (req: Request): Promise<Response> => {
  const rl = checkRateLimit(req);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterSeconds!);
  try {
    const providers = getConfiguredModelProviders();

    const freeModels: ConfiguredModel[] = providers
      .filter((p) => isOpenRouterProvider(p as never))
      .flatMap((p) =>
        p.chatModels
          .filter((m) => isFreeModelId(m.key))
          .map((m) => ({ providerId: p.id, providerName: p.name, modelKey: m.key })),
      );

    const verdicts =
      freeModels.length > 0
        ? checkFreeModels(freeModels, await fetchOpenRouterCatalogue())
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

    return Response.json({ freeModels: verdicts, benched }, { status: 200 });
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
