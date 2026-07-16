import { describe, expect, it } from 'vitest';
import { cn, formatTimeDifference, formatTimestamp, truncateSnippet } from './utils';

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

describe('truncateSnippet', () => {
  it('returns text unchanged when under maxLength', () => {
    expect(truncateSnippet('Hello world', 280)).toBe('Hello world');
  });

  it('returns text unchanged when exactly maxLength', () => {
    const text = 'x'.repeat(100);
    expect(truncateSnippet(text, 100)).toBe(text);
  });

  it('truncates text exceeding maxLength with ellipsis', () => {
    const text = 'a'.repeat(300);
    expect(truncateSnippet(text, 280)).toBe('a'.repeat(280) + '…');
  });

  it('trims trailing whitespace before appending ellipsis', () => {
    const text = 'Hello ' + 'x'.repeat(276);
    expect(truncateSnippet(text, 280)).toBe('Hello ' + 'x'.repeat(274) + '…');
  });

  it('handles empty string', () => {
    expect(truncateSnippet('', 100)).toBe('');
  });

  it('handles maxLength of 0', () => {
    expect(truncateSnippet('anything', 0)).toBe('…');
  });
});
