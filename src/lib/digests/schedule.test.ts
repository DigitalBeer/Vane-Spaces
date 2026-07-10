import { describe, it, expect } from 'vitest';
import { computeNextRunAt, DigestSchedule } from './schedule';

// Jan 2026: Jan 1 = Thu, so Jan 5 = Mon(1), Jan 7 = Wed(3), Jan 12 = Mon(1) next week.
// Expected values are built with the SAME local-time constructor the impl uses,
// so assertions are timezone-independent.

describe('computeNextRunAt — daily', () => {
  it('returns today when the time is still ahead', () => {
    const from = new Date(2026, 0, 5, 8, 0, 0); // Mon 08:00
    const sched: DigestSchedule = {
      frequency: 'daily',
      timeOfDay: '09:30',
      dayOfWeek: null,
    };
    expect(computeNextRunAt(sched, from)).toBe(
      new Date(2026, 0, 5, 9, 30, 0, 0).toISOString(),
    );
  });

  it('rolls to tomorrow when the time has already passed today', () => {
    const from = new Date(2026, 0, 5, 10, 0, 0); // Mon 10:00
    const sched: DigestSchedule = {
      frequency: 'daily',
      timeOfDay: '09:30',
      dayOfWeek: null,
    };
    expect(computeNextRunAt(sched, from)).toBe(
      new Date(2026, 0, 6, 9, 30, 0, 0).toISOString(),
    );
  });

  it('rolls to tomorrow at the exact boundary (candidate == from is not "after")', () => {
    const from = new Date(2026, 0, 5, 9, 30, 0, 0); // exactly 09:30
    const sched: DigestSchedule = {
      frequency: 'daily',
      timeOfDay: '09:30',
      dayOfWeek: null,
    };
    expect(computeNextRunAt(sched, from)).toBe(
      new Date(2026, 0, 6, 9, 30, 0, 0).toISOString(),
    );
  });
});

describe('computeNextRunAt — weekly', () => {
  it('returns later the same week', () => {
    const from = new Date(2026, 0, 5, 8, 0, 0); // Mon
    const sched: DigestSchedule = {
      frequency: 'weekly',
      timeOfDay: '09:00',
      dayOfWeek: 3, // Wed
    };
    expect(computeNextRunAt(sched, from)).toBe(
      new Date(2026, 0, 7, 9, 0, 0, 0).toISOString(),
    );
  });

  it('rolls to next week when the target day is earlier in the week', () => {
    const from = new Date(2026, 0, 7, 10, 0, 0); // Wed
    const sched: DigestSchedule = {
      frequency: 'weekly',
      timeOfDay: '09:00',
      dayOfWeek: 1, // Mon
    };
    expect(computeNextRunAt(sched, from)).toBe(
      new Date(2026, 0, 12, 9, 0, 0, 0).toISOString(),
    );
  });

  it('rolls +7 when it is the target day but the time has passed', () => {
    const from = new Date(2026, 0, 5, 10, 0, 0); // Mon 10:00
    const sched: DigestSchedule = {
      frequency: 'weekly',
      timeOfDay: '09:00',
      dayOfWeek: 1, // Mon
    };
    expect(computeNextRunAt(sched, from)).toBe(
      new Date(2026, 0, 12, 9, 0, 0, 0).toISOString(),
    );
  });

  it('throws when dayOfWeek is null for a weekly schedule', () => {
    const from = new Date(2026, 0, 5, 8, 0, 0);
    const sched: DigestSchedule = {
      frequency: 'weekly',
      timeOfDay: '09:00',
      dayOfWeek: null,
    };
    expect(() => computeNextRunAt(sched, from)).toThrow();
  });
});
