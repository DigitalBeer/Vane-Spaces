export type DigestSchedule = {
  frequency: 'daily' | 'weekly';
  timeOfDay: string;       // "HH:MM" 24-hour, e.g. "09:30"
  dayOfWeek: number | null; // 0=Sunday .. 6=Saturday; only used when frequency==='weekly'
};

export function computeNextRunAt(schedule: DigestSchedule, from: Date): string {
  const [hours, minutes] = schedule.timeOfDay.split(':').map(Number);

  const candidate = new Date(from);
  candidate.setHours(hours, minutes, 0, 0);

  if (schedule.frequency === 'daily') {
    if (candidate > from) {
      return candidate.toISOString();
    } else {
      candidate.setDate(candidate.getDate() + 1);
      return candidate.toISOString();
    }
  } else if (schedule.frequency === 'weekly') {
    if (schedule.dayOfWeek === null) {
      throw new Error('dayOfWeek required for weekly schedule');
    }

    let daysUntil = ((schedule.dayOfWeek - candidate.getDay()) + 7) % 7;
    candidate.setDate(candidate.getDate() + daysUntil);
    if (candidate > from) {
      return candidate.toISOString();
    } else {
      candidate.setDate(candidate.getDate() + 7);
      return candidate.toISOString();
    }
  }

  throw new Error('Invalid frequency');
}
