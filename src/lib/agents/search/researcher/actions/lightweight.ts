import { splitText } from '@/lib/utils/splitText';

/** Roughly how much of a long page lightweight mode keeps, in tokens. */
export const LIGHTWEIGHT_EXCERPT_TOKENS = 1500;

/**
 * Lightweight page reading for slow (e.g. CPU-only) models: instead of asking
 * the model to summarise every 4,000-token chunk of a long page, which costs
 * one full prompt read per chunk, keep only the page's opening section. News
 * and article pages put the substance first, so little is lost.
 */
export const lightweightExcerpt = (
  content: string,
  maxTokens = LIGHTWEIGHT_EXCERPT_TOKENS,
): string => splitText(content, maxTokens, 0)[0] ?? '';
