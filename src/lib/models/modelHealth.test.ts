// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { BENCH_TTL_MS, ModelHealthStore } from './modelHealth';

let dir: string;
let now: number;
const store = () => new ModelHealthStore(dir, () => now);

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vane-health-'));
  now = 1_000_000;
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('ModelHealthStore', () => {
  it('benches a model until its TTL runs out', () => {
    store().markFailed('or/model:free', 'unavailable', 'gone');
    expect(store().isBenched('or/model:free')).toBe(true);

    now += BENCH_TTL_MS.unavailable! + 1;
    expect(store().isBenched('or/model:free')).toBe(false);
  });

  it('uses a short bench for transient failures', () => {
    store().markFailed('laptop/gemma', 'transient', 'ECONNREFUSED');
    now += BENCH_TTL_MS.transient! + 1;
    expect(store().isBenched('laptop/gemma')).toBe(false);
  });

  it('ignores failures another model would not fix', () => {
    store().markFailed('a/b', 'other', 'bad request');
    store().markFailed('a/c', 'context', 'too long');
    expect(store().list()).toEqual([]);
  });

  it('lists live entries and prunes expired ones from the file', () => {
    store().markFailed('a/old', 'transient', 'x');
    now += BENCH_TTL_MS.transient! + 1;
    store().markFailed('a/new', 'quota', 'y');

    expect(store().list().map((e) => e.key)).toEqual(['a/new']);
    const onDisk = JSON.parse(fs.readFileSync(path.join(dir, 'model-health.json'), 'utf8'));
    expect(Object.keys(onDisk)).toEqual(['a/new']);
  });

  it('treats a corrupt file as nothing benched', () => {
    fs.writeFileSync(path.join(dir, 'model-health.json'), '{not json');
    expect(store().isBenched('a/b')).toBe(false);
    expect(store().list()).toEqual([]);
  });

  it('clears an entry', () => {
    store().markFailed('a/b', 'quota', 'limit');
    store().clear('a/b');
    expect(store().isBenched('a/b')).toBe(false);
  });
});
