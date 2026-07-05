-- Full-text search index over thread messages. Each row is one conversation
-- turn, with the user prompt (query) and assistant answer (response) as separate
-- columns: matching spans both, the search result header is drawn from `query`,
-- and the preview snippet from `response`.
-- Populated and kept in sync from the application layer (see src/lib/db/messagesFts.ts),
-- because responseBlocks is JSON and cannot be tokenised by SQL triggers alone.
-- The 0004 branch in src/lib/db/migrate.ts creates this table AND backfills existing rows.
CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
  messageId UNINDEXED,
  chatId UNINDEXED,
  query,
  response,
  tokenize = 'porter unicode61'
);
