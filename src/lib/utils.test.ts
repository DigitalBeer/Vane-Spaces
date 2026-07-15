import { describe, it, expect } from 'vitest';
import { formatTimestamp } from './utils';

describe('formatTimestamp', () => {
  it('formats a Date object correctly', () => {
    const date = new Date('2026-07-12T14:30:00Z');
    const result = formatTimestamp(date);
    expect(result).toContain('Sun');
    expect(result).toContain('Jul');
    expect(result).toContain('12');
    expect(result).toContain('2026');
  });

  it('formats an ISO string correctly', () => {
    const result = formatTimestamp('2026-01-05T09:15:00.000Z');
    expect(result).toContain('Mon');
    expect(result).toContain('Jan');
    expect(result).toContain('5');
    expect(result).toContain('2026');
  });

  it('returns "Invalid date" for invalid input', () => {
    const result = formatTimestamp('not-a-date');
    expect(result).toBe('Invalid date');
  });

  it('handles epoch date', () => {
    const result = formatTimestamp(new Date(0));
    expect(result).toContain('1970');
    expect(result).toContain('Jan');
    expect(result).toContain('1');
  });
});
