import { describe, expect, it } from 'vitest';
import { formatAnswerNote, shortModelName } from './answerModelNote';

describe('shortModelName', () => {
  it('keeps the last part of paths and namespaced ids', () => {
    expect(shortModelName('C:\\Models\\gemma\\gemma-4-E2B-Q4_K.gguf')).toBe('gemma-4-E2B-Q4_K');
    expect(shortModelName('nvidia/nemotron-3-ultra-550b-a55b:free')).toBe('nemotron-3-ultra-550b-a55b:free');
    expect(shortModelName('hf.co/openbmb/MiniCPM5-2B-GGUF:Q4_K_M')).toBe('MiniCPM5-2B-GGUF:Q4_K_M');
    expect(shortModelName('mistral-medium-latest')).toBe('mistral-medium-latest');
  });
});

describe('formatAnswerNote', () => {
  const startedAt = '2026-10-23T06:00:00.000Z';
  const completedAt = '2026-10-23T06:01:05.000Z';

  it('names the model, provider and duration', () => {
    const note = formatAnswerNote({
      model: { provider: 'OpenRouter', model: 'nvidia/nemotron:free' },
      startedAt,
      completedAt,
    });
    expect(note).toMatch(/^nemotron:free via OpenRouter · .+ → .+ \(1m 5s\)$/);
  });

  it('says when the fallback wrote the answer', () => {
    const note = formatAnswerNote({
      model: { provider: 'Unraid Ollama', model: 'hf.co/unsloth/LFM2.5:Q4' },
      fallbackFrom: { provider: 'OpenRouter', model: 'nvidia/nemotron:free' },
      startedAt,
      completedAt,
    });
    expect(note).toContain('LFM2.5:Q4 via Unraid Ollama (fallback; nemotron:free failed)');
  });

  it('copes with no model and no finish time', () => {
    expect(formatAnswerNote({ startedAt })).toMatch(/^asked /);
  });
});
