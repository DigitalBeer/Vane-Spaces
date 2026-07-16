CREATE TABLE IF NOT EXISTS digest_topics (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  spaceId TEXT,
  queries TEXT DEFAULT '[]',
  instructions TEXT,
  excludedDomains TEXT DEFAULT '[]',
  frequency TEXT NOT NULL,
  timeOfDay TEXT NOT NULL,
  dayOfWeek INTEGER,
  enabled INTEGER NOT NULL DEFAULT 1,
  sources TEXT DEFAULT '[]',
  optimizationMode TEXT NOT NULL DEFAULT 'balanced',
  chatModelProviderId TEXT NOT NULL,
  chatModelKey TEXT NOT NULL,
  embeddingModelProviderId TEXT NOT NULL,
  embeddingModelKey TEXT NOT NULL,
  lastRunAt TEXT,
  nextRunAt TEXT NOT NULL,
  lastRunError TEXT,
  lastRunChatId TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_digest_topics_due ON digest_topics (enabled, nextRunAt);
--> statement-breakpoint
ALTER TABLE chats ADD COLUMN origin TEXT NOT NULL DEFAULT 'user';
--> statement-breakpoint
ALTER TABLE chats ADD COLUMN digestId TEXT;
