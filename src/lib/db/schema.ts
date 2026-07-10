import { sql } from 'drizzle-orm';
import { text, integer, sqliteTable, index } from 'drizzle-orm/sqlite-core';
import { Block } from '../types';
import { SearchSources } from '../agents/search/types';

export const messages = sqliteTable('messages', {
  id: integer('id').primaryKey(),
  messageId: text('messageId').notNull(),
  chatId: text('chatId').notNull(),
  backendId: text('backendId').notNull(),
  query: text('query').notNull(),
  createdAt: text('createdAt').notNull(),
  responseBlocks: text('responseBlocks', { mode: 'json' })
    .$type<Block[]>()
    .default(sql`'[]'`),
  status: text({ enum: ['answering', 'completed', 'error'] }).default(
    'answering',
  ),
});

export interface DBFile {
  name: string;
  fileId: string;
}

export interface SpaceIcon {
  type: 'emoji' | 'color';
  value: string;
}

export interface SpaceWebSource {
  id: string;
  url: string;
  title: string;
  fileId: string | null;
  status: 'pending' | 'ready' | 'failed';
  error: string | null;
  addedAt: string;
}

export const chats = sqliteTable('chats', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  createdAt: text('createdAt').notNull(),
  sources: text('sources', {
    mode: 'json',
  })
    .$type<SearchSources[]>()
    .default(sql`'[]'`),
  files: text('files', { mode: 'json' })
    .$type<DBFile[]>()
    .default(sql`'[]'`),
  spaceId: text('spaceId'),
  origin: text('origin', { enum: ['user', 'digest'] })
    .notNull()
    .default('user'),
  digestId: text('digestId'),
});

export const spaces = sqliteTable('spaces', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description'),
  instructions: text('instructions'),
  icon: text('icon', { mode: 'json' })
    .$type<SpaceIcon>()
    .default(sql`'{"type":"color","value":"#6366f1"}'`),
  useGlobalInstructions: integer('useGlobalInstructions', { mode: 'boolean' })
    .notNull()
    .default(true),
  defaultSourceScope: text('defaultSourceScope', {
    enum: ['space', 'web', 'both'],
  })
    .notNull()
    .default('both'),
  files: text('files', { mode: 'json' })
    .$type<DBFile[]>()
    .default(sql`'[]'`),
  webSources: text('webSources', { mode: 'json' })
    .$type<SpaceWebSource[]>()
    .default(sql`'[]'`),
  pinnedQueries: text('pinnedQueries', { mode: 'json' })
    .$type<string[]>()
    .default(sql`'[]'`),
  createdAt: text('createdAt').notNull(),
  updatedAt: text('updatedAt').notNull(),
});

export const digestTopics = sqliteTable('digest_topics', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  spaceId: text('spaceId'),
  queries: text('queries', { mode: 'json' })
    .$type<string[]>()
    .default(sql`'[]'`),
  instructions: text('instructions'),
  excludedDomains: text('excludedDomains', { mode: 'json' })
    .$type<string[]>()
    .default(sql`'[]'`),
  frequency: text('frequency', { enum: ['daily', 'weekly'] }).notNull(),
  timeOfDay: text('timeOfDay').notNull(),
  dayOfWeek: integer('dayOfWeek'),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  sources: text('sources', { mode: 'json' })
    .$type<SearchSources[]>()
    .default(sql`'[]'`),
  optimizationMode: text('optimizationMode', {
    enum: ['speed', 'balanced', 'quality'],
  })
    .notNull()
    .default('balanced'),
  chatModelProviderId: text('chatModelProviderId').notNull(),
  chatModelKey: text('chatModelKey').notNull(),
  embeddingModelProviderId: text('embeddingModelProviderId').notNull(),
  embeddingModelKey: text('embeddingModelKey').notNull(),
  lastRunAt: text('lastRunAt'),
  nextRunAt: text('nextRunAt').notNull(),
  lastRunError: text('lastRunError'),
  lastRunChatId: text('lastRunChatId'),
  createdAt: text('createdAt').notNull(),
  updatedAt: text('updatedAt').notNull(),
}, (table) => ({
  dueIdx: index('idx_digest_topics_due').on(table.enabled, table.nextRunAt),
}));
