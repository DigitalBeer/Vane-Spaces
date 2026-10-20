// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { getTokenCount } from '@/lib/utils/splitText';
import { lightweightExcerpt } from './lightweight';

const sentence = (i: number) =>
  `Paragraph ${i} explains one more detail of the story in plain words. `;

describe('lightweightExcerpt', () => {
  it('returns short content unchanged', () => {
    const text = 'A short article.\nIt has two lines.';
    expect(lightweightExcerpt(text)).toBe(text);
  });

  it('keeps only the opening part of a long page', () => {
    const text = Array.from({ length: 400 }, (_, i) => sentence(i)).join('');
    const excerpt = lightweightExcerpt(text, 200);

    expect(text.startsWith(excerpt)).toBe(true);
    expect(getTokenCount(excerpt)).toBeLessThanOrEqual(200);
    expect(excerpt.length).toBeLessThan(text.length / 5);
    expect(excerpt).toContain('Paragraph 0 ');
  });

  it('returns an empty string for empty content', () => {
    expect(lightweightExcerpt('')).toBe('');
  });
});
