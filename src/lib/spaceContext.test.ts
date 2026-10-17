import { describe, expect, it } from 'vitest';
import { resolveSpaceContext, SpaceContext } from './spaceContext';

const base: SpaceContext = {
  sources: ['web', 'discussions'],
  fileIds: ['chat-file'],
  systemInstructions: 'Global rules',
};

const makeSpace = (
  overrides: Partial<Parameters<typeof resolveSpaceContext>[0] & object> = {},
) => ({
  name: 'Research',
  instructions: 'Be terse',
  useGlobalInstructions: true,
  defaultSourceScope: 'both' as const,
  files: [{ fileId: 'space-file', name: 'a.pdf' }],
  webSources: [
    { id: '1', url: 'https://a', status: 'ready', fileId: 'web-ready' },
    { id: '2', url: 'https://b', status: 'pending', fileId: null },
  ] as never,
  ...overrides,
});

describe('resolveSpaceContext', () => {
  it('returns the base context when there is no space', () => {
    expect(resolveSpaceContext(null, base)).toEqual(base);
  });

  it("'space' scope disables web sources and searches only space files", () => {
    const ctx = resolveSpaceContext(makeSpace({ defaultSourceScope: 'space' }), base);
    expect(ctx.sources).toEqual([]);
    expect(ctx.fileIds).toEqual(['chat-file', 'space-file', 'web-ready']);
  });

  it("'both' scope keeps web sources and adds space files", () => {
    const ctx = resolveSpaceContext(makeSpace(), base);
    expect(ctx.sources).toEqual(['web', 'discussions']);
    expect(ctx.fileIds).toEqual(['chat-file', 'space-file', 'web-ready']);
  });

  it("'web' scope ignores space files", () => {
    const ctx = resolveSpaceContext(makeSpace({ defaultSourceScope: 'web' }), base);
    expect(ctx.sources).toEqual(['web', 'discussions']);
    expect(ctx.fileIds).toEqual(['chat-file']);
  });

  it('does not duplicate file ids already attached to the chat', () => {
    const ctx = resolveSpaceContext(makeSpace(), { ...base, fileIds: ['space-file'] });
    expect(ctx.fileIds).toEqual(['space-file', 'web-ready']);
  });

  it('prepends global instructions when the space allows it', () => {
    const ctx = resolveSpaceContext(makeSpace(), base);
    expect(ctx.systemInstructions).toBe('Global rules\n\n[Space: Research]\nBe terse');
  });

  it('drops global instructions when the space opts out', () => {
    const ctx = resolveSpaceContext(makeSpace({ useGlobalInstructions: false }), base);
    expect(ctx.systemInstructions).toBe('[Space: Research]\nBe terse');
  });

  it('keeps base instructions when the space has none', () => {
    const ctx = resolveSpaceContext(makeSpace({ instructions: null }), base);
    expect(ctx.systemInstructions).toBe('Global rules');
  });
});
