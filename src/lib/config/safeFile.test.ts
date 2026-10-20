// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { readJsonWithRecovery, writeJsonAtomic } from './safeFile';

let dir: string;
let file: string;
const logs: string[] = [];
const log = (m: string) => logs.push(m);

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vane-config-'));
  file = path.join(dir, 'config.json');
  logs.length = 0;
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('writeJsonAtomic', () => {
  it('writes the file and a backup, leaving no temp files behind', () => {
    writeJsonAtomic(file, { providers: ['ollama'] });
    expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toEqual({ providers: ['ollama'] });
    expect(JSON.parse(fs.readFileSync(`${file}.bak`, 'utf8'))).toEqual({ providers: ['ollama'] });
    expect(fs.readdirSync(dir).sort()).toEqual(['config.json', 'config.json.bak']);
  });

  it('replaces an existing file', () => {
    writeJsonAtomic(file, { v: 1 });
    writeJsonAtomic(file, { v: 2 });
    expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toEqual({ v: 2 });
  });
});

describe('readJsonWithRecovery', () => {
  it('reads a valid file', () => {
    writeJsonAtomic(file, { keys: 'mine' });
    expect(readJsonWithRecovery(file, { keys: 'default' }, log)).toEqual({ data: { keys: 'mine' }, source: 'file' });
  });

  it('restores the last good backup instead of wiping an empty or partial file', () => {
    writeJsonAtomic(file, { apiKey: 'sk-real' });
    fs.writeFileSync(file, '{"apiKey": "sk-re'); // half-written

    const result = readJsonWithRecovery(file, { apiKey: '' }, log);
    expect(result).toEqual({ data: { apiKey: 'sk-real' }, source: 'backup' });
    // The file itself is repaired, and the broken one is kept for inspection.
    expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toEqual({ apiKey: 'sk-real' });
    const corrupt = fs.readdirSync(dir).filter((f) => f.startsWith('config.json.corrupt-'));
    expect(corrupt).toHaveLength(1);
    expect(fs.readFileSync(path.join(dir, corrupt[0]), 'utf8')).toBe('{"apiKey": "sk-re');
  });

  it('falls back to defaults only when there is no usable backup, without touching the file', () => {
    fs.writeFileSync(file, '');
    const result = readJsonWithRecovery(file, { apiKey: '' }, log);
    expect(result).toEqual({ data: { apiKey: '' }, source: 'defaults' });
    expect(fs.readFileSync(file, 'utf8')).toBe('');
  });
});
