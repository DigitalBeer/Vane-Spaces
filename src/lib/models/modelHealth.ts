// Remembers models that recently failed in a way another model could fix
// (see providerError.ts), so the fallback wrapper skips them instead of
// re-discovering the same failure on every call. Modelled on pi-orchestrator's
// src/quota/model-health.ts: plain JSON, auto-expiring entries, and fail-open
// (an unreadable file just means "nothing is benched").

import fs from 'fs';
import path from 'path';
import type { ProviderErrorClass } from './providerError';

/** How long a model stays benched, by the kind of failure that benched it. */
export const BENCH_TTL_MS: Partial<Record<ProviderErrorClass, number>> = {
  unavailable: 6 * 60 * 60 * 1000, // withdrawn / no longer free: rarely comes back soon
  quota: 60 * 60 * 1000, // daily or hourly allowance used up
  auth: 60 * 60 * 1000, // bad or expired key: needs the user to fix it
  transient: 2 * 60 * 1000, // overloaded, or a laptop server asleep
};

export type BenchedModel = {
  /** "providerId/modelKey" */
  key: string;
  errorClass: ProviderErrorClass;
  message: string;
  failedAt: number;
  recoversAt: number;
};

type HealthFile = Record<string, Omit<BenchedModel, 'key'>>;

export const modelKey = (providerId: string, modelKey: string) =>
  `${providerId}/${modelKey}`;

export class ModelHealthStore {
  private readonly filePath: string;

  constructor(
    dir: string = path.join(process.env.DATA_DIR || process.cwd(), 'data'),
    private readonly clock: () => number = Date.now,
  ) {
    this.filePath = path.join(dir, 'model-health.json');
  }

  private read(): HealthFile {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed
        : {};
    } catch {
      return {};
    }
  }

  private write(data: HealthFile) {
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2));
    } catch (err) {
      console.error('Failed to save model health:', err);
    }
  }

  /** Benches a model. Classes without a TTL (context, other) are ignored. */
  markFailed(key: string, errorClass: ProviderErrorClass, message: string) {
    const ttl = BENCH_TTL_MS[errorClass];
    if (!ttl) return;
    const now = this.clock();
    const data = this.read();
    data[key] = {
      errorClass,
      message: message.slice(0, 300),
      failedAt: now,
      recoversAt: now + ttl,
    };
    this.write(data);
  }

  isBenched(key: string): boolean {
    const entry = this.read()[key];
    return !!entry && entry.recoversAt > this.clock();
  }

  /** Currently benched models; expired entries are dropped from the file. */
  list(): BenchedModel[] {
    const now = this.clock();
    const data = this.read();
    const live = Object.entries(data).filter(([, v]) => v.recoversAt > now);
    if (live.length !== Object.keys(data).length) {
      this.write(Object.fromEntries(live));
    }
    return live.map(([key, v]) => ({ key, ...v }));
  }

  clear(key: string) {
    const data = this.read();
    if (key in data) {
      delete data[key];
      this.write(data);
    }
  }
}
