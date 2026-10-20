// Checks that configured free OpenRouter models are still served for free, and
// suggests a like-for-like replacement when one isn't. Ported from
// pi-orchestrator's src/config/free-model-check.ts. The difference: pi needs
// tool calls, Vane needs structured output (its research steps call
// generateObject with a JSON schema), so replacements must support that.
//
// Fail-safe by design: a catalogue that can't be fetched or parsed produces no
// verdicts. Only a model with positive evidence of being gone is reported.

export const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';

export type CatalogueEntry = {
  id: string;
  /** Served at no charge right now. */
  free: boolean;
  /** Whether the provider says the model accepts structured output. Undefined when it doesn't say. */
  structured?: boolean;
  /** Unix seconds; newer wins ties. */
  created?: number;
};

export type FreeModelVerdict = {
  providerId: string;
  providerName: string;
  modelKey: string;
  status: 'withdrawn' | 'no-longer-free';
  /** A live free model from the same vendor that supports structured output. */
  replacement?: string;
};

export type ConfiguredModel = {
  providerId: string;
  providerName: string;
  modelKey: string;
};

const listOf = (body: unknown): Record<string, unknown>[] => {
  const data = (body as { data?: unknown })?.data;
  return Array.isArray(data)
    ? data.filter(
        (m): m is Record<string, unknown> =>
          !!m && typeof m === 'object' && typeof m.id === 'string',
      )
    : [];
};

/** `{data:[{id, created, pricing:{prompt, completion}, supported_parameters}]}`. Free = zero prompt and completion price. */
export function parseOpenRouterCatalogue(body: unknown): CatalogueEntry[] {
  return listOf(body).map((m) => {
    const pricing = (m.pricing ?? {}) as { prompt?: unknown; completion?: unknown };
    const zero = (v: unknown) => v !== undefined && Number(v) === 0;
    // An explicit non-zero price wins over a stale `:free` suffix.
    const hasPricing = pricing.prompt !== undefined || pricing.completion !== undefined;
    const params = Array.isArray(m.supported_parameters)
      ? (m.supported_parameters as unknown[])
      : undefined;
    return {
      id: m.id as string,
      free: hasPricing
        ? zero(pricing.prompt) && zero(pricing.completion)
        : (m.id as string).endsWith(':free'),
      structured: params
        ? params.includes('structured_outputs') || params.includes('response_format')
        : undefined,
      created: typeof m.created === 'number' ? m.created : undefined,
    };
  });
}

/** Whether a provider config points at OpenRouter. */
export const isOpenRouterProvider = (p: { type: string; config?: Record<string, unknown> }) =>
  p.type === 'openai' &&
  typeof p.config?.baseURL === 'string' &&
  /openrouter\.ai/i.test(p.config.baseURL);

/** Only `:free` ids are checked; a paid model is a deliberate choice. */
export const isFreeModelId = (id: string) => id.endsWith(':free');

/** "meta-llama/llama-3.3-8b-instruct:free" -> { vendor: "meta-llama", stem: "llama" }. */
function describeId(id: string) {
  const slash = id.indexOf('/');
  const vendor = slash >= 0 ? id.slice(0, slash) : '';
  const rest = slash >= 0 ? id.slice(slash + 1) : id;
  const stem = /^[a-z]+/i.exec(rest)?.[0]?.toLowerCase() ?? '';
  return { vendor: vendor.toLowerCase(), stem };
}

/**
 * Best stand-ins for a gone model: same vendor (required), same family
 * preferred, newest first. Must be free, must not be refused structured
 * output by the catalogue, and must not already be configured.
 */
export function rankReplacements(
  goneId: string,
  entries: CatalogueEntry[],
  exclude: Set<string>,
): string[] {
  const gone = describeId(goneId);
  if (!gone.vendor) return [];
  return entries
    .filter((e) => e.free && e.structured !== false && e.id !== goneId && !exclude.has(e.id))
    .map((e) => ({ e, d: describeId(e.id) }))
    .filter(({ d }) => d.vendor === gone.vendor)
    .sort(
      (a, b) =>
        Number(b.d.stem === gone.stem) - Number(a.d.stem === gone.stem) ||
        (b.e.created ?? 0) - (a.e.created ?? 0),
    )
    .map(({ e }) => e.id);
}

/** Verdicts for configured free models that the catalogue shows are no longer free. */
export function checkFreeModels(
  configured: ConfiguredModel[],
  entries: CatalogueEntry[],
): FreeModelVerdict[] {
  if (entries.length === 0) return [];
  const inUse = new Set(configured.map((m) => m.modelKey));
  const verdicts: FreeModelVerdict[] = [];
  for (const model of configured) {
    if (!isFreeModelId(model.modelKey)) continue;
    const listed = entries.find((e) => e.id === model.modelKey);
    if (listed?.free) continue;
    const replacement = rankReplacements(model.modelKey, entries, inUse)[0];
    if (replacement) inUse.add(replacement);
    verdicts.push({
      ...model,
      status: listed ? 'no-longer-free' : 'withdrawn',
      replacement,
    });
  }
  return verdicts;
}

type FetchLike = (
  url: string,
  init?: { signal?: AbortSignal },
) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

let cache: { at: number; entries: CatalogueEntry[] } | null = null;
const CACHE_MS = 30 * 60 * 1000;

/** OpenRouter's catalogue, cached for 30 minutes. Empty on any failure. */
export async function fetchOpenRouterCatalogue(
  fetchImpl: FetchLike = globalThis.fetch as unknown as FetchLike,
  now = Date.now(),
): Promise<CatalogueEntry[]> {
  if (cache && now - cache.at < CACHE_MS) return cache.entries;
  try {
    const res = await fetchImpl(OPENROUTER_MODELS_URL, {
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return [];
    const entries = parseOpenRouterCatalogue(await res.json());
    // An empty list is no evidence of anything; don't cache it.
    if (entries.length > 0) cache = { at: now, entries };
    return entries;
  } catch {
    return [];
  }
}

export const resetCatalogueCache = () => {
  cache = null;
};
