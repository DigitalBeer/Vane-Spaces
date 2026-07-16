const DEFAULT_LIMIT = 30;
const DEFAULT_WINDOW_MS = 60_000;
const FALLBACK_KEY = '__local_fallback__';
const SWEEP_THRESHOLD = 10_000;

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const ip = forwarded.split(',')[0].trim();
    if (ip) return ip;
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return FALLBACK_KEY;
}

function sweepExpired(now: number): void {
  if (buckets.size < SWEEP_THRESHOLD) return;
  const threshold = now - DEFAULT_WINDOW_MS * 2;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt < threshold) buckets.delete(key);
  }
}

export function checkRateLimit(
  req: Request,
  opts?: { limit?: number; windowMs?: number },
): { allowed: boolean; retryAfterSeconds?: number } {
  const limit = opts?.limit ?? DEFAULT_LIMIT;
  const windowMs = opts?.windowMs ?? DEFAULT_WINDOW_MS;
  const key = getClientIp(req);
  const now = Date.now();

  sweepExpired(now);

  let bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }

  bucket.count++;

  if (bucket.count > limit) {
    const retryAfterSeconds = Math.ceil((bucket.resetAt - now) / 1000);
    return { allowed: false, retryAfterSeconds: Math.max(1, retryAfterSeconds) };
  }

  return { allowed: true };
}

export function rateLimitResponse(retryAfterSeconds: number): Response {
  return Response.json(
    { message: 'Too many requests.' },
    { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } },
  );
}

/**
 * Reset internal state. Only used in tests.
 */
export function _resetBuckets(): void {
  buckets.clear();
}
