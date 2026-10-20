// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import {
  checkFreeModels,
  fetchOpenRouterCatalogue,
  isOpenRouterProvider,
  parseOpenRouterCatalogue,
  rankReplacements,
  resetCatalogueCache,
} from './freeModelCheck';

const free = { prompt: '0', completion: '0' };
const paid = { prompt: '0.0000002', completion: '0.0000006' };
const structured = ['tools', 'structured_outputs', 'response_format'];

const catalogue = {
  data: [
    { id: 'meta-llama/llama-3.3-70b-instruct:free', pricing: free, supported_parameters: structured, created: 100 },
    { id: 'meta-llama/llama-4-scout:free', pricing: free, supported_parameters: structured, created: 300 },
    { id: 'meta-llama/llama-guard:free', pricing: free, supported_parameters: ['max_tokens'], created: 400 },
    { id: 'qwen/qwen3-8b:free', pricing: paid, supported_parameters: structured, created: 200 },
    { id: 'google/gemma-4-12b:free', pricing: free, supported_parameters: structured, created: 250 },
  ],
};
const entries = parseOpenRouterCatalogue(catalogue);
const model = (modelKey: string) => ({ providerId: 'or', providerName: 'OpenRouter', modelKey });

describe('parseOpenRouterCatalogue', () => {
  it('marks free by zero price, not the :free suffix, and reads structured-output support', () => {
    const byId = Object.fromEntries(entries.map((e) => [e.id, e]));
    expect(byId['meta-llama/llama-4-scout:free']).toMatchObject({ free: true, structured: true });
    expect(byId['qwen/qwen3-8b:free'].free).toBe(false);
    expect(byId['meta-llama/llama-guard:free'].structured).toBe(false);
  });

  it('returns nothing for a malformed body', () => {
    expect(parseOpenRouterCatalogue({ nope: true })).toEqual([]);
    expect(parseOpenRouterCatalogue(null)).toEqual([]);
  });
});

describe('rankReplacements', () => {
  it('keeps to the same vendor, needs structured output, prefers the same family then newest', () => {
    expect(rankReplacements('meta-llama/llama-3.1-8b-instruct:free', entries, new Set())).toEqual([
      'meta-llama/llama-4-scout:free',
      'meta-llama/llama-3.3-70b-instruct:free',
    ]);
  });

  it('never suggests a model that is already configured', () => {
    expect(
      rankReplacements('meta-llama/llama-3.1-8b-instruct:free', entries, new Set(['meta-llama/llama-4-scout:free'])),
    ).toEqual(['meta-llama/llama-3.3-70b-instruct:free']);
  });
});

describe('checkFreeModels', () => {
  it('reports withdrawn and no-longer-free models with a replacement, and leaves live ones alone', () => {
    const verdicts = checkFreeModels(
      [
        model('meta-llama/llama-3.3-70b-instruct:free'), // still free
        model('meta-llama/llama-3.1-8b-instruct:free'), // withdrawn
        model('qwen/qwen3-8b:free'), // now paid, no other qwen
        model('openai/gpt-4o-mini'), // paid by choice: not checked
      ],
      entries,
    );
    expect(verdicts).toEqual([
      { ...model('meta-llama/llama-3.1-8b-instruct:free'), status: 'withdrawn', replacement: 'meta-llama/llama-4-scout:free' },
      { ...model('qwen/qwen3-8b:free'), status: 'no-longer-free', replacement: undefined },
    ]);
  });

  it('says nothing when the catalogue is unavailable', () => {
    expect(checkFreeModels([model('meta-llama/llama-3.1-8b-instruct:free')], [])).toEqual([]);
  });
});

describe('isOpenRouterProvider', () => {
  it('matches OpenAI-compatible providers pointed at OpenRouter', () => {
    expect(isOpenRouterProvider({ type: 'openai', config: { baseURL: 'https://openrouter.ai/api/v1' } })).toBe(true);
    expect(isOpenRouterProvider({ type: 'openai', config: { baseURL: 'https://api.openai.com/v1' } })).toBe(false);
    expect(isOpenRouterProvider({ type: 'ollama', config: { baseURL: 'https://openrouter.ai' } })).toBe(false);
  });
});

describe('fetchOpenRouterCatalogue', () => {
  beforeEach(() => resetCatalogueCache());

  it('returns an empty list when the fetch fails, and caches a good result', async () => {
    expect(await fetchOpenRouterCatalogue(async () => { throw new Error('offline'); })).toEqual([]);

    let calls = 0;
    const ok = async () => { calls++; return { ok: true, json: async () => catalogue }; };
    expect((await fetchOpenRouterCatalogue(ok, 1_000)).length).toBe(5);
    await fetchOpenRouterCatalogue(ok, 2_000);
    expect(calls).toBe(1);
  });
});
