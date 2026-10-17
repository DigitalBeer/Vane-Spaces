import type { spaces } from '@/lib/db/schema';
import type { SearchSources } from '@/lib/agents/search/types';

type Space = Pick<
  typeof spaces.$inferSelect,
  | 'name'
  | 'instructions'
  | 'useGlobalInstructions'
  | 'defaultSourceScope'
  | 'files'
  | 'webSources'
>;

export type SpaceContext = {
  sources: SearchSources[];
  fileIds: string[];
  systemInstructions: string;
};

/**
 * Applies a Space's source scope and instructions on top of a base search
 * context. 'space' searches only the Space's files (no web/discussions/academic),
 * 'web' ignores the Space's files, 'both' adds the Space's files to the sources.
 */
export const resolveSpaceContext = (
  space: Space | null | undefined,
  base: SpaceContext,
): SpaceContext => {
  if (!space) return base;

  let systemInstructions = base.systemInstructions;
  if (space.instructions) {
    const globalPart =
      space.useGlobalInstructions && systemInstructions !== 'None'
        ? systemInstructions + '\n\n'
        : '';
    systemInstructions = `${globalPart}[Space: ${space.name}]\n${space.instructions}`;
  }

  const scope = space.defaultSourceScope;
  const spaceFileIds = [
    ...(space.files ?? []).map((f) => f.fileId),
    ...(space.webSources ?? [])
      .filter((s) => s.status === 'ready' && s.fileId)
      .map((s) => s.fileId as string),
  ];

  return {
    sources: scope === 'space' ? [] : base.sources,
    fileIds:
      scope === 'web'
        ? base.fileIds
        : [...new Set([...base.fileIds, ...spaceFileIds])],
    systemInstructions,
  };
};
