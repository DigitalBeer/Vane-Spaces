import BaseLLM from './base/llm';
import FallbackLLM from './fallbackLLM';
import { ModelHealthStore, modelKey } from './modelHealth';
import { ModelWithProvider } from './types';

type ChatModelLoader = {
  loadChatModel(providerId: string, key: string): Promise<BaseLLM<any>>;
};

/**
 * Loads the requested chat model, wrapped so failures fall back to `fallback`
 * (see FallbackLLM). Without a usable fallback this is a plain load. If the
 * primary can't even be loaded (provider removed, server unreachable), the
 * fallback is used directly.
 */
export async function loadChatModelWithFallback(
  registry: ChatModelLoader,
  primary: ModelWithProvider,
  fallback?: ModelWithProvider | null,
  health: ModelHealthStore = new ModelHealthStore(),
): Promise<BaseLLM<any>> {
  const primaryKey = modelKey(primary.providerId, primary.key);
  const fallbackKey = fallback
    ? modelKey(fallback.providerId, fallback.key)
    : null;

  if (!fallback || !fallbackKey || fallbackKey === primaryKey) {
    return registry.loadChatModel(primary.providerId, primary.key);
  }

  let fallbackLLM: BaseLLM<any>;
  try {
    fallbackLLM = await registry.loadChatModel(fallback.providerId, fallback.key);
  } catch (err) {
    console.warn(`[fallback] could not load fallback ${fallbackKey}:`, err);
    return registry.loadChatModel(primary.providerId, primary.key);
  }

  let primaryLLM: BaseLLM<any>;
  try {
    primaryLLM = await registry.loadChatModel(primary.providerId, primary.key);
  } catch (err) {
    console.warn(`[fallback] could not load ${primaryKey}; using ${fallbackKey}:`, err);
    return fallbackLLM;
  }

  return new FallbackLLM({
    primary: primaryLLM,
    primaryKey,
    fallback: fallbackLLM,
    fallbackKey,
    health,
  });
}
