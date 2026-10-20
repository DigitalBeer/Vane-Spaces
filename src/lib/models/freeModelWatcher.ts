import { getConfiguredModelProviders } from '@/lib/config/serverRegistry';
import {
  checkFreeModels,
  ConfiguredModel,
  fetchOpenRouterCatalogue,
  isFreeModelId,
  isOpenRouterProvider,
} from './freeModelCheck';
import { ModelHealthStore, modelKey } from './modelHealth';

const CHECK_INTERVAL_MS = 30 * 60 * 1000;

/**
 * One background check: refresh OpenRouter's catalogue (so the live free
 * lists in the pickers stay current) and bench any free model added to a
 * connection by hand that has been retired, so calls go straight to the
 * fallback instead of failing first. Returns the models benched.
 */
export async function checkFreeModelsNow(
  health: ModelHealthStore = new ModelHealthStore(),
): Promise<string[]> {
  const openRouter = getConfiguredModelProviders().filter((p) =>
    isOpenRouterProvider(p as never),
  );
  if (openRouter.length === 0) return [];

  const entries = await fetchOpenRouterCatalogue(undefined, Date.now(), true);
  const configured: ConfiguredModel[] = openRouter.flatMap((p) =>
    p.chatModels
      .filter((m) => isFreeModelId(m.key))
      .map((m) => ({ providerId: p.id, providerName: p.name, modelKey: m.key })),
  );

  const benched: string[] = [];
  for (const v of checkFreeModels(configured, entries)) {
    const key = modelKey(v.providerId, v.modelKey);
    if (health.isBenched(key)) continue;
    health.markFailed(
      key,
      'unavailable',
      v.status === 'withdrawn'
        ? 'Withdrawn from OpenRouter'
        : 'No longer free on OpenRouter',
    );
    benched.push(key);
  }
  if (benched.length > 0) {
    console.warn(`[free-models] retired, now using the fallback: ${benched.join(', ')}`);
  }
  return benched;
}

export function startFreeModelWatcher(): void {
  const g = global as unknown as { _freeModelWatcherStarted?: boolean };
  if (g._freeModelWatcherStarted) return;
  g._freeModelWatcherStarted = true;
  const run = () => {
    checkFreeModelsNow().catch((err) =>
      console.error('[free-models] check failed:', err),
    );
  };
  run();
  setInterval(run, CHECK_INTERVAL_MS);
  console.log('[free-models] watcher started');
}
