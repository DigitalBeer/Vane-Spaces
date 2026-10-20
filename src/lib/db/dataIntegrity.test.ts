// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';

let dataDir: string;

beforeEach(() => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vane-test-'));
  fs.mkdirSync(path.join(dataDir, 'data'));
  fs.mkdirSync(path.join(dataDir, 'drizzle'));
  vi.stubEnv('DATA_DIR', dataDir);
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

const writeMigration = (name: string, sql: string) =>
  fs.writeFileSync(path.join(dataDir, 'drizzle', name), sql);

const openDb = () => new Database(path.join(dataDir, 'data', 'db.sqlite'));

describe('migrate', () => {
  it('rolls back a migration that fails part-way through', async () => {
    writeMigration(
      '0100_broken.sql',
      'CREATE TABLE half_done (x TEXT);\n--> statement-breakpoint\nTHIS IS NOT SQL;',
    );
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(import('./migrate')).rejects.toThrow();

    const db = openDb();
    const table = db
      .prepare("SELECT name FROM sqlite_master WHERE name = 'half_done'")
      .get();
    const recorded = db
      .prepare("SELECT 1 FROM ran_migrations WHERE name = '0100'")
      .get();
    db.close();
    expect(table).toBeUndefined();
    expect(recorded).toBeUndefined();
  });

  it('applies and records a valid migration', async () => {
    writeMigration('0100_ok.sql', 'CREATE TABLE ok_table (x TEXT);');
    vi.spyOn(console, 'log').mockImplementation(() => {});

    await import('./migrate');

    const db = openDb();
    const table = db
      .prepare("SELECT name FROM sqlite_master WHERE name = 'ok_table'")
      .get();
    const recorded = db
      .prepare("SELECT 1 FROM ran_migrations WHERE name = '0100'")
      .get();
    db.close();
    expect(table).toBeDefined();
    expect(recorded).toBeDefined();
  });
});

describe('deleteMessagesFts', () => {
  it('removes only the given messages from the search index', async () => {
    const { indexMessageFts, deleteMessagesFts } = await import('./messagesFts');
    const { sqlite } = await import('./index');

    for (const id of ['m1', 'm2', 'm3']) {
      indexMessageFts({ messageId: id, chatId: 'c1', query: `q ${id}`, responseBlocks: [] });
    }
    deleteMessagesFts(['m2', 'm3']);

    const rows = sqlite
      .prepare('SELECT messageId FROM messages_fts ORDER BY messageId')
      .all() as { messageId: string }[];
    sqlite.close();
    expect(rows.map((r) => r.messageId)).toEqual(['m1']);
  });
});

describe('UploadManager.removeFile', () => {
  it('deletes the content file and its record entry, leaving others', async () => {
    const { default: UploadManager } = await import('../uploads/manager');
    const dir = UploadManager.uploadsDir;
    fs.mkdirSync(dir, { recursive: true });

    const entry = (id: string) => {
      const p = path.join(dir, `${id}.content.json`);
      fs.writeFileSync(p, '{"chunks":[]}');
      return { id, name: id, filePath: p, contentPath: p, uploadedAt: '' };
    };
    fs.writeFileSync(
      UploadManager.uploadedFilesRecordPath,
      JSON.stringify({ files: [entry('keep'), entry('drop')] }),
    );

    UploadManager.removeFile('drop');

    expect(fs.existsSync(path.join(dir, 'drop.content.json'))).toBe(false);
    expect(fs.existsSync(path.join(dir, 'keep.content.json'))).toBe(true);
    expect(UploadManager.getFile('drop')).toBeNull();
    expect(UploadManager.getFile('keep')).not.toBeNull();
  });

  it('never deletes files outside the uploads folder', async () => {
    const { default: UploadManager } = await import('../uploads/manager');
    fs.mkdirSync(UploadManager.uploadsDir, { recursive: true });
    const outside = path.join(dataDir, 'outside.json');
    fs.writeFileSync(outside, '{}');
    fs.writeFileSync(
      UploadManager.uploadedFilesRecordPath,
      JSON.stringify({
        files: [{ id: 'x', name: 'x', filePath: outside, contentPath: outside, uploadedAt: '' }],
      }),
    );

    UploadManager.removeFile('x');

    expect(fs.existsSync(outside)).toBe(true);
    expect(UploadManager.getFile('x')).toBeNull();
  });
});
