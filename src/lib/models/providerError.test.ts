// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { classifyProviderError, errorText, shouldFallBack } from './providerError';

describe('classifyProviderError', () => {
  it.each([
    ['404 This model is unavailable for free. The paid version is available now', 'unavailable'],
    ['No endpoints found for meta-llama/llama-3.3-8b-instruct:free.', 'unavailable'],
    ['400 model_not_found', 'unavailable'],
    ['429 Rate limit exceeded: free-models-per-day', 'quota'],
    ['402 Insufficient credits', 'quota'],
    ['429 Too Many Requests', 'transient'],
    ['503 Service Unavailable', 'transient'],
    ['connect ECONNREFUSED 192.168.1.171:8080', 'transient'],
    ['fetch failed', 'transient'],
    ["This endpoint's maximum context length is 8192 tokens", 'context'],
    ['400 Invalid JSON schema', 'other'],
    ['401 Invalid API key', 'auth'],
    ['401 Missing Authentication header', 'auth'],
    ['403 Forbidden', 'auth'],
  ])('%s -> %s', (message, expected) => {
    expect(classifyProviderError(new Error(message))).toBe(expected);
  });

  it('reads the HTTP status and nested cause that SDK errors carry separately', () => {
    const err = Object.assign(new Error('Request failed'), { status: 429 });
    expect(classifyProviderError(err)).toBe('transient');

    const wrapped = new Error('fetch failed', {
      cause: Object.assign(new Error('connect'), { code: 'ECONNREFUSED' }),
    });
    expect(classifyProviderError(wrapped)).toBe('transient');
  });

  it('does not repeat a status the message already starts with', () => {
    const err = Object.assign(new Error('401 Missing Authentication header'), { status: 401 });
    expect(errorText(err)).toBe('401 Missing Authentication header');
    expect(classifyProviderError(err)).toBe('auth');
  });

  it('does not treat unrelated numbers as HTTP statuses', () => {
    expect(classifyProviderError(new Error('expected 5000 items'))).toBe('other');
  });

  it('only falls back when another model could help', () => {
    expect(shouldFallBack('unavailable')).toBe(true);
    expect(shouldFallBack('quota')).toBe(true);
    expect(shouldFallBack('transient')).toBe(true);
    expect(shouldFallBack('auth')).toBe(true);
    expect(shouldFallBack('context')).toBe(false);
    expect(shouldFallBack('other')).toBe(false);
  });
});
