import { sqlite } from './index';
import { Block } from '../types';

/**
 * Full-text search over thread messages, backed by an FTS5 virtual table
 * (`messages_fts`). Each row is one conversation turn, with the user prompt
 * (`query`) and assistant answer (`response`) indexed as separate columns.
 *
 * Matching runs across both columns (so a term in a prompt or an answer, in the
 * first turn or any follow-up, surfaces that turn). For display, the result
 * header is the turn's prompt and the preview snippet is taken from the
 * `response` column — so the answer's matching passage is shown rather than
 * repeating the prompt.
 *
 * The table is created/backfilled by migration 0004; these helpers keep it in
 * sync as messages are written/deleted and expose a space-scoped search. All
 * writes are best-effort: FTS must never break the message persistence or
 * chat-deletion paths.
 */

let ready = false;

const ensureTable = () => {
  if (ready) return;
  sqlite.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
      messageId UNINDEXED,
      chatId UNINDEXED,
      query,
      response,
      tokenize = 'porter unicode61'
    );
  `);
  ready = true;
};

const blocksToText = (blocks: Block[] | null | undefined): string =>
  Array.isArray(blocks)
    ? blocks
        .filter((b) => b && b.type === 'text')
        .map((b) => (b as { data?: string }).data || '')
        .join('\n')
    : '';

export const indexMessageFts = (message: {
  messageId: string;
  chatId: string;
  query: string;
  responseBlocks: Block[] | null | undefined;
}) => {
  try {
    ensureTable();
    const response = blocksToText(message.responseBlocks);
    sqlite
      .prepare('DELETE FROM messages_fts WHERE messageId = ?')
      .run(message.messageId);
    sqlite
      .prepare(
        'INSERT INTO messages_fts (messageId, chatId, query, response) VALUES (?, ?, ?, ?)',
      )
      .run(message.messageId, message.chatId, message.query || '', response);
  } catch (err) {
    console.error('Failed to index message for FTS:', err);
  }
};

export const deleteChatFts = (chatId: string) => {
  try {
    ensureTable();
    sqlite.prepare('DELETE FROM messages_fts WHERE chatId = ?').run(chatId);
  } catch (err) {
    console.error('Failed to delete chat from FTS:', err);
  }
};

export interface SpaceSearchHit {
  chatId: string;
  chatTitle: string;
  messageId: string;
  /** The prompt asked in this specific turn — used as the result header. */
  query: string;
  /** Snippet of the assistant answer, with the match highlighted when present. */
  snippet: string;
  createdAt: string;
}

/**
 * Escape a user query into a safe FTS5 MATCH expression: each whitespace-run
 * token is wrapped in double quotes (so punctuation can't be parsed as FTS
 * syntax) and a trailing `*` is appended for prefix matching.
 */
const toMatchExpr = (raw: string): string =>
  raw
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => `"${t.replace(/"/g, '""')}"*`)
    .join(' ');

export const searchSpaceMessages = (
  spaceId: string,
  rawQuery: string,
  limit = 50,
): SpaceSearchHit[] => {
  const match = toMatchExpr(rawQuery);
  if (!match) return [];
  try {
    ensureTable();
    // One result per matching turn, ranked by relevance. Header comes from the
    // turn's prompt (m.query); the preview snippet is taken from the `response`
    // column (index 3) so the answer's matching passage is shown — not the
    // prompt repeated. A term found only in the prompt still matches the turn
    // (MATCH spans both columns) and is conveyed by the header.
    const rows = sqlite
      .prepare(
        `
        SELECT
          f.chatId AS chatId,
          c.title AS chatTitle,
          f.messageId AS messageId,
          m.query AS query,
          m.createdAt AS createdAt,
          snippet(messages_fts, 3, char(57344), char(57345), '…', 20) AS snippet
        FROM messages_fts f
        JOIN chats c ON c.id = f.chatId
        LEFT JOIN messages m ON m.messageId = f.messageId AND m.chatId = f.chatId
        WHERE c.spaceId = ? AND messages_fts MATCH ?
        ORDER BY bm25(messages_fts)
        LIMIT ?
      `,
      )
      .all(spaceId, match, limit) as SpaceSearchHit[];

    return rows;
  } catch (err) {
    console.error('Failed to search space messages:', err);
    return [];
  }
};
