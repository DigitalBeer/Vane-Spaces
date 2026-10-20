// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

const providers = vi.hoisted(() => ({ list: [] as unknown[] }));
vi.mock('@/lib/config/serverRegistry', () => ({
  getConfiguredModelProviders: () => providers.list,
}));

const { checkFreeModelsNow } = await import('./freeModelWatcher');
const { ModelHealthStore } = await import('./modelHealth');
const { resetCatalogueCache } = await import('./freeModelCheck');

const free = { prompt: '0', completion: '0' };
let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vane-watch-'));
  resetCatalogueCache();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      json: async () => ({
        data: [
          { id: 'google/gemma-4-31b-it:free', pricing: free, supported_parameters: ['structured_outputs'] },
        ],
      }),
    })),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  fs.rmSync(dir, { recursive: true, force: true });
});

const openRouter = (keys: string[]) => ({
  id: 'or',
  name: 'OpenRouter',
  type: 'openai',
  config: { baseURL: 'https://openrouter.ai/api/v1' },
  chatModels: keys.map((key) => ({ key, name: key })),
  embeddingModels: [],
});

describe('checkFreeModelsNow', () => {
  it('benches hand-added free models that have been retired, and leaves live ones alone', async () => {
    providers.list = [openRouter(['google/gemma-4-31b-it:free', 'google/gemma-3-27b-it:free', 'openai/gpt-4o'])];
    const health = new ModelHealthStore(dir);

    expect(await checkFreeModelsNow(health)).toEqual(['or/google/gemma-3-27b-it:free']);
    expect(health.isBenched('or/google/gemma-3-27b-it:free')).toBe(true);
    expect(health.isBenched('or/google/gemma-4-31b-it:free')).toBe(false);

    // Already benched: not reported again.
    expect(await checkFreeModelsNow(health)).toEqual([]);
  });

  it('does nothing without an OpenRouter connection', async () => {
    providers.list = [{ id: 'local', name: 'Ollama', type: 'ollama', config: {}, chatModels: [], embeddingModels: [] }];
    expect(await checkFreeModelsNow(new ModelHealthStore(dir))).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });
});
