import { describe, expect, it } from 'vitest';
import { cn, formatTimeDifference, formatTimestamp } from './utils';

describe('cn', () => {
  it('joins truthy class values', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('drops falsy values', () => {
    expect(cn('a', false, undefined, null, 'b')).toBe('a b');
  });

  it('merges conflicting tailwind classes, keeping the last', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });
});

describe('formatTimeDifference', () => {
  it('formats a difference in seconds', () => {
    const a = new Date('2024-01-01T00:00:00Z');
    const b = new Date('2024-01-01T00:00:30Z');
    expect(formatTimeDifference(a, b)).toBe('30 seconds');
  });

  it('formats a difference in minutes', () => {
    const a = new Date('2024-01-01T00:00:00Z');
    const b = new Date('2024-01-01T00:05:00Z');
    expect(formatTimeDifference(a, b)).toBe('5 minutes');
  });

  it('uses singular units where appropriate', () => {
    const a = new Date('2024-01-01T00:00:00Z');
    const b = new Date('2024-01-01T01:00:00Z');
    expect(formatTimeDifference(a, b)).toBe('1 hour');
  });
});

describe('formatTimestamp', () => {
  it('formats a Date object correctly', () => {
    const date = new Date('2026-07-12T14:30:00Z');
    expect(formatTimestamp(date)).toBe(
      'Sun, Jul 12, 2026, 2:30:00 PM UTC',
    );
  });

  it('formats an ISO string correctly', () => {
    expect(formatTimestamp('2026-01-05T09:15:00.000Z')).toBe(
      'Mon, Jan 5, 2026, 9:15:00 AM UTC',
    );
  });

  it('returns "Invalid date" for invalid input', () => {
    expect(formatTimestamp('not-a-date')).toBe('Invalid date');
  });

  it('handles epoch date', () => {
    expect(formatTimestamp(new Date(0))).toBe(
      'Thu, Jan 1, 1970, 12:00:00 AM UTC',
    );
  });

  it('accepts custom timeZone', () => {
    const date = new Date('2026-07-12T14:30:00Z');
    expect(formatTimestamp(date, 'en-US', 'America/New_York')).toBe(
      'Sun, Jul 12, 2026, 10:30:00 AM EDT',
    );
  });
});
