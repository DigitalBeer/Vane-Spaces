import fs from 'fs';

/**
 * Writes JSON so no reader can ever see a half-written file: write a temp file
 * next to the target, then rename it over the target (atomic on the same
 * filesystem). Also refreshes `<file>.bak`, the last known-good copy that
 * readJsonWithRecovery restores from.
 *
 * Why: config.json used to be written in place (truncate, then write). When
 * two processes overlapped (the dev server and a build, or several build
 * workers), one could read an empty or partial file, treat it as corrupt and
 * overwrite it with defaults, which wiped all providers and API keys.
 */
export function writeJsonAtomic(filePath: string, data: unknown) {
  const text = JSON.stringify(data, null, 2);
  const write = (target: string) => {
    const tmp = `${target}.tmp-${process.pid}-${Math.random().toString(36).slice(2)}`;
    fs.writeFileSync(tmp, text);
    try {
      renameWithRetry(tmp, target);
    } catch (err) {
      fs.rmSync(tmp, { force: true });
      throw err;
    }
  };
  write(filePath);
  write(`${filePath}.bak`);
}

const sleep = (ms: number) =>
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/**
 * On Windows, renaming over a file another process has open briefly fails
 * with EPERM/EBUSY/EACCES (several build workers saving at once hit this).
 * Retry for up to ~1s; Linux renames don't fail this way.
 */
function renameWithRetry(from: string, to: string) {
  for (let attempt = 0; ; attempt++) {
    try {
      fs.renameSync(from, to);
      return;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      const retryable = code === 'EPERM' || code === 'EBUSY' || code === 'EACCES';
      if (!retryable || attempt >= 20) throw err;
      sleep(50);
    }
  }
}

export type ReadResult<T> = {
  data: T;
  /** 'file': read normally; 'backup': restored from <file>.bak; 'defaults': nothing usable. */
  source: 'file' | 'backup' | 'defaults';
};

/**
 * Reads JSON, never silently replacing a file it can't parse. An unreadable
 * file is retried briefly (another process may be mid-write), then kept as
 * `<file>.corrupt-<time>` and the last good `<file>.bak` is restored. Only if
 * there is no usable backup are the defaults returned.
 */
export function readJsonWithRecovery<T>(
  filePath: string,
  defaults: T,
  log: (msg: string) => void = console.error,
): ReadResult<T> {
  const tryRead = (p: string): T | undefined => {
    try {
      const text = fs.readFileSync(p, 'utf-8');
      return JSON.parse(text) as T;
    } catch {
      return undefined;
    }
  };

  for (let attempt = 0; attempt < 3; attempt++) {
    const data = tryRead(filePath);
    if (data !== undefined) return { data, source: 'file' };
    sleep(100);
  }

  const corruptCopy = `${filePath}.corrupt-${Date.now()}`;
  try {
    fs.copyFileSync(filePath, corruptCopy);
    log(`Could not parse ${filePath}; kept a copy at ${corruptCopy}.`);
  } catch {
    // Nothing to keep.
  }

  const backup = tryRead(`${filePath}.bak`);
  if (backup !== undefined) {
    log(`Restored ${filePath} from its last good backup.`);
    writeJsonAtomic(filePath, backup);
    return { data: backup, source: 'backup' };
  }

  log(`No usable backup for ${filePath}; starting from defaults.`);
  return { data: defaults, source: 'defaults' };
}
