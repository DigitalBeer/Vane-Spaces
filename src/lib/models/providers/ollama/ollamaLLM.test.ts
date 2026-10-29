// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import OllamaLLM from './ollamaLLM';

const llmWith = (model: string, show: () => Promise<{ capabilities?: string[] }>) => {
  // A unique host per test keeps the module-level capability cache apart.
  const llm = new OllamaLLM({ baseURL: `http://test-${crypto.randomUUID()}:11434`, model });
  const spy = vi.fn(show);
  (llm.ollamaClient as unknown as { show: typeof spy }).show = spy;
  return { llm, spy };
};

describe('OllamaLLM.thinkOption', () => {
  it('turns thinking off for models that report the thinking capability', async () => {
    const { llm, spy } = llmWith('hf.co/openbmb/MiniCPM5-2B-GGUF:Q4_K_M', async () => ({
      capabilities: ['completion', 'tools', 'thinking'],
    }));
    expect(await llm.thinkOption()).toEqual({ think: false });
    expect(await llm.thinkOption()).toEqual({ think: false });
    expect(spy).toHaveBeenCalledTimes(1); // cached per host + model
  });

  it('leaves models without the capability alone', async () => {
    const { llm } = llmWith('llama3.2', async () => ({ capabilities: ['completion'] }));
    expect(await llm.thinkOption()).toEqual({});
  });

  it('keeps thinking on for LFM3, where think:false breaks JSON replies', async () => {
    const { llm, spy } = llmWith('lfm3:latest', async () => ({ capabilities: ['thinking'] }));
    expect(await llm.thinkOption()).toEqual({});
    expect(spy).not.toHaveBeenCalled();
  });

  it('falls back to the name list when the server cannot report capabilities', async () => {
    const { llm: listed } = llmWith('qwen3:4b', async () => {
      throw new Error('404');
    });
    expect(await listed.thinkOption()).toEqual({ think: false });

    const { llm: unknown, spy } = llmWith('mystery', async () => {
      throw new Error('connect ECONNREFUSED');
    });
    expect(await unknown.thinkOption()).toEqual({});
    await unknown.thinkOption();
    expect(spy).toHaveBeenCalledTimes(2); // a failed lookup isn't cached
  });
});
