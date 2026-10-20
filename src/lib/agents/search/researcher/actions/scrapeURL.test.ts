// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const longArticle = Array.from(
  { length: 1200 },
  (_, i) => `Paragraph ${i} explains one more detail of the story in plain words. `,
).join('');

vi.mock('@/lib/scraper', () => ({
  default: {
    scrape: vi.fn(async () => ({ content: longArticle, title: 'A long article' })),
  },
}));

const { default: scrapeURLAction } = await import('./scrapeURL');

const generateObject = vi.fn(async () => ({ extracted_facts: 'summary of a chunk' }));

const run = (lightweight: boolean) =>
  scrapeURLAction.execute({ urls: ['https://example.com/article'] } as never, {
    llm: { generateObject } as never,
    embedding: {} as never,
    session: { getBlock: () => undefined, updateBlock: () => {} } as never,
    researchBlockId: 'research-1',
    fileIds: [],
    mode: 'speed',
    lightweight,
  });

describe('scrape_url action', () => {
  beforeEach(() => generateObject.mockClear());

  it('summarises every chunk of a long page with the model by default', async () => {
    const out = (await run(false)) as { results: { content: string }[] };
    expect(generateObject.mock.calls.length).toBeGreaterThan(1);
    expect(out.results[0].content).toContain('summary of a chunk');
  });

  it('makes no model calls in lightweight mode and keeps the opening of the page', async () => {
    const out = (await run(true)) as { results: { content: string }[] };
    expect(generateObject).not.toHaveBeenCalled();
    expect(out.results[0].content.startsWith('Paragraph 0 ')).toBe(true);
    expect(out.results[0].content.length).toBeLessThan(longArticle.length / 4);
  });
});
