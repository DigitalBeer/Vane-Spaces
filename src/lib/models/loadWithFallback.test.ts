// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import FallbackLLM from './fallbackLLM';
import { ModelHealthStore } from './modelHealth';
import { loadChatModelWithFallback } from './loadWithFallback';

let dir: string;
let health: ModelHealthStore;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vane-load-'));
  health = new ModelHealthStore(dir);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

const registry = (broken: string[] = []) => ({
  loadChatModel: vi.fn(async (providerId: string, key: string) => {
    if (broken.includes(`${providerId}/${key}`)) throw new Error('connect ECONNREFUSED');
    return { name: `${providerId}/${key}` } as never;
  }),
});

const cloud = { providerId: 'or', key: 'model:free' };
const laptop = { providerId: 'laptop', key: 'gemma' };

describe('loadChatModelWithFallback', () => {
  it('loads the primary as-is when there is no fallback', async () => {
    const llm = await loadChatModelWithFallback(registry(), cloud, null, health);
    expect(llm).toEqual({ name: 'or/model:free' });
  });

  it('does not wrap when the fallback is the same model', async () => {
    const llm = await loadChatModelWithFallback(registry(), cloud, { ...cloud }, health);
    expect(llm).not.toBeInstanceOf(FallbackLLM);
  });

  it('wraps the primary when a different fallback is given', async () => {
    const llm = await loadChatModelWithFallback(registry(), cloud, laptop, health);
    expect(llm).toBeInstanceOf(FallbackLLM);
  });

  it('uses the fallback directly when the primary cannot be loaded', async () => {
    const llm = await loadChatModelWithFallback(registry(['or/model:free']), cloud, laptop, health);
    expect(llm).toEqual({ name: 'laptop/gemma' });
  });

  it('carries on with the primary when the fallback cannot be loaded', async () => {
    const llm = await loadChatModelWithFallback(registry(['laptop/gemma']), cloud, laptop, health);
    expect(llm).toEqual({ name: 'or/model:free' });
  });
});
