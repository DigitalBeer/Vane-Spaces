import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { checkRateLimit, rateLimitResponse, _resetBuckets } from './rateLimit';

beforeEach(() => {
  _resetBuckets();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

function mockRequest(ip?: string): Request {
  const headers = new Headers();
  if (ip) headers.set('x-forwarded-for', ip);
  return new Request('http://localhost', { headers, method: 'GET' });
}

describe('checkRateLimit', () => {
  it('allows requests under the limit', () => {
    const req = mockRequest('1.2.3.4');
    for (let i = 0; i < 5; i++) {
      const result = checkRateLimit(req, { limit: 10, windowMs: 60_000 });
      expect(result.allowed).toBe(true);
      expect(result.retryAfterSeconds).toBeUndefined();
    }
  });

  it('blocks requests once the limit is exceeded within the window', () => {
    const req = mockRequest('5.6.7.8');
    const limit = 3;

    for (let i = 0; i < limit; i++) {
      const result = checkRateLimit(req, { limit, windowMs: 60_000 });
      expect(result.allowed).toBe(true);
    }

    const blocked = checkRateLimit(req, { limit, windowMs: 60_000 });
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it('resets after the window elapses', () => {
    const req = mockRequest('9.10.11.12');
    const limit = 2;

    for (let i = 0; i < limit; i++) {
      expect(checkRateLimit(req, { limit, windowMs: 60_000 }).allowed).toBe(true);
    }
    expect(checkRateLimit(req, { limit, windowMs: 60_000 }).allowed).toBe(false);

    // advance past the window
    vi.advanceTimersByTime(60_001);

    const after = checkRateLimit(req, { limit, windowMs: 60_000 });
    expect(after.allowed).toBe(true);
  });

  it('gives independent buckets per client key', () => {
    const reqA = mockRequest('10.0.0.1');
    const reqB = mockRequest('10.0.0.2');
    const limit = 2;

    // exhaust A
    for (let i = 0; i < limit; i++) {
      expect(checkRateLimit(reqA, { limit, windowMs: 60_000 }).allowed).toBe(true);
    }
    expect(checkRateLimit(reqA, { limit, windowMs: 60_000 }).allowed).toBe(false);

    // B should still be allowed
    expect(checkRateLimit(reqB, { limit, windowMs: 60_000 }).allowed).toBe(true);
  });

  it('uses x-real-ip fallback when x-forwarded-for is absent', () => {
    const headers = new Headers();
    headers.set('x-real-ip', '192.168.1.1');
    const req = new Request('http://localhost', { headers, method: 'GET' });

    expect(checkRateLimit(req, { limit: 1 }).allowed).toBe(true);
    expect(checkRateLimit(req, { limit: 1 }).allowed).toBe(false);
  });

  it('falls back to a constant key when no proxy headers are present', () => {
    const req = new Request('http://localhost', { method: 'GET' });
    expect(checkRateLimit(req, { limit: 1 }).allowed).toBe(true);
    expect(checkRateLimit(req, { limit: 1 }).allowed).toBe(false);
  });
});

describe('rateLimitResponse', () => {
  it('returns 429 with Retry-After header and JSON body', () => {
    const res = rateLimitResponse(45);
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('45');
  });

  it('includes a JSON message body', async () => {
    const res = rateLimitResponse(30);
    const body = await res.json();
    expect(body).toEqual({ message: 'Too many requests.' });
  });
});
