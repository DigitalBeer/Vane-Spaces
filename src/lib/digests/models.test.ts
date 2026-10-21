// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { checkDigestModels, readFallbackChoice } from './models';

const providers = [
  { id: 'or', chatModels: [{ key: 'nemotron:free' }], embeddingModels: [] },
  { id: 'ollama', chatModels: [{ key: 'minicpm' }], embeddingModels: [{ key: 'embed' }] },
];

const base = {
  chatModelProviderId: 'or',
  chatModelKey: 'nemotron:free',
  embeddingModelProviderId: 'ollama',
  embeddingModelKey: 'embed',
  fallbackChatModelProviderId: null,
  fallbackChatModelKey: null,
};

describe('readFallbackChoice', () => {
  it('needs both parts to set a fallback', () => {
    expect(readFallbackChoice({ fallbackChatModelProviderId: 'ollama', fallbackChatModelKey: 'minicpm' })).toEqual({
      fallbackChatModelProviderId: 'ollama',
      fallbackChatModelKey: 'minicpm',
    });
    expect(readFallbackChoice({ fallbackChatModelProviderId: 'ollama', fallbackChatModelKey: '' })).toEqual({
      fallbackChatModelProviderId: null,
      fallbackChatModelKey: null,
    });
    expect(readFallbackChoice({})).toEqual({ fallbackChatModelProviderId: null, fallbackChatModelKey: null });
  });
});

describe('checkDigestModels', () => {
  it('accepts configured models, with or without a fallback', () => {
    expect(checkDigestModels(providers, base)).toBeNull();
    expect(
      checkDigestModels(providers, { ...base, fallbackChatModelProviderId: 'ollama', fallbackChatModelKey: 'minicpm' }),
    ).toBeNull();
  });

  it('rejects models that are not configured', () => {
    expect(checkDigestModels(providers, { ...base, chatModelKey: 'gone' })).toMatch(/chat model/);
    expect(checkDigestModels(providers, { ...base, embeddingModelKey: 'gone' })).toMatch(/embedding model/);
    expect(
      checkDigestModels(providers, { ...base, fallbackChatModelProviderId: 'ollama', fallbackChatModelKey: 'gone' }),
    ).toMatch(/fallback model/);
  });
});
