// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import z from 'zod';
import FallbackLLM, { FallbackEvent } from './fallbackLLM';
import { ModelHealthStore } from './modelHealth';

const fakeLLM = (name: string, opts: { failWith?: Error; failAfterChunk?: Error } = {}) => ({
  calls: 0,
  async generateText() {
    this.calls++;
    if (opts.failWith) throw opts.failWith;
    return { content: name, toolCalls: [] };
  },
  async *streamText() {
    this.calls++;
    if (opts.failWith) throw opts.failWith;
    yield { contentChunk: `${name}-1`, toolCallChunk: [] };
    if (opts.failAfterChunk) throw opts.failAfterChunk;
    yield { contentChunk: `${name}-2`, toolCallChunk: [] };
  },
  async generateObject() {
    this.calls++;
    if (opts.failWith) throw opts.failWith;
    return { from: name };
  },
  async *streamObject() {
    this.calls++;
    if (opts.failWith) throw opts.failWith;
    yield { from: name };
  },
});

let dir: string;
let health: ModelHealthStore;
let events: FallbackEvent[];

const wrap = (primary: ReturnType<typeof fakeLLM>, fallback: ReturnType<typeof fakeLLM>) =>
  new FallbackLLM({
    primary: primary as never,
    primaryKey: 'cloud/free-model',
    fallback: fallback as never,
    fallbackKey: 'laptop/gemma',
    health,
    onFallback: (e) => events.push(e),
  });

const input = { messages: [] };
const objInput = { messages: [], schema: z.object({ from: z.string() }) };
const collect = async <T>(gen: AsyncGenerator<T>) => {
  const out: T[] = [];
  for await (const c of gen) out.push(c);
  return out;
};

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vane-fallback-'));
  health = new ModelHealthStore(dir);
  events = [];
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('FallbackLLM', () => {
  it('uses the primary when it works', async () => {
    const primary = fakeLLM('cloud');
    const fallback = fakeLLM('laptop');
    expect((await wrap(primary, fallback).generateText(input)).content).toBe('cloud');
    expect(fallback.calls).toBe(0);
    expect(events).toEqual([]);
  });

  it('retries on the fallback and benches the primary when the model is gone', async () => {
    const primary = fakeLLM('cloud', { failWith: new Error('404 This model is unavailable for free') });
    const fallback = fakeLLM('laptop');
    const llm = wrap(primary, fallback);

    expect(await llm.generateObject(objInput)).toEqual({ from: 'laptop' });
    expect(health.isBenched('cloud/free-model')).toBe(true);
    expect(events[0]).toMatchObject({ reason: 'unavailable', to: 'laptop/gemma' });

    // The next call skips the benched primary entirely.
    expect((await llm.generateText(input)).content).toBe('laptop');
    expect(primary.calls).toBe(1);
    expect(events[1].reason).toBe('benched');
  });

  it('falls back when a rate limit is hit', async () => {
    const primary = fakeLLM('cloud', { failWith: new Error('429 Rate limit exceeded: free-models-per-day') });
    const out = await collect(wrap(primary, fakeLLM('laptop')).streamText(input));
    expect(out.map((c) => c.contentChunk)).toEqual(['laptop-1', 'laptop-2']);
  });

  it('does not hide errors another model would not fix', async () => {
    const primary = fakeLLM('cloud', { failWith: new Error('400 Invalid JSON schema') });
    const fallback = fakeLLM('laptop');
    await expect(wrap(primary, fallback).generateText(input)).rejects.toThrow('Invalid JSON schema');
    expect(fallback.calls).toBe(0);
    expect(health.list()).toEqual([]);
  });

  it('does not switch a stream that already produced output', async () => {
    const primary = fakeLLM('cloud', { failAfterChunk: new Error('503 Service Unavailable') });
    const fallback = fakeLLM('laptop');
    await expect(collect(wrap(primary, fallback).streamText(input))).rejects.toThrow('503');
    expect(fallback.calls).toBe(0);
  });

  it('reports which model served the latest call', async () => {
    const primary = Object.assign(fakeLLM('cloud', { failWith: new Error('429 Rate limit exceeded') }), {
      label: { provider: 'OpenRouter', model: 'free-model' },
    });
    const fallback = Object.assign(fakeLLM('laptop'), { label: { provider: 'Laptop', model: 'gemma' } });
    const llm = wrap(primary, fallback);
    expect(llm.answeredBy()).toEqual({ model: primary.label });
    await collect(llm.streamText(input));
    expect(llm.answeredBy()).toEqual({ model: fallback.label, fallbackFrom: primary.label });
  });

  it('surfaces the fallback error if the fallback also fails', async () => {
    const primary = fakeLLM('cloud', { failWith: new Error('fetch failed') });
    const fallback = fakeLLM('laptop', { failWith: new Error('connect ECONNREFUSED') });
    await expect(wrap(primary, fallback).generateText(input)).rejects.toThrow('ECONNREFUSED');
  });
});
