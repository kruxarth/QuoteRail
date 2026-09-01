import { FROZEN_TEST_NOW, IST_OFFSET, IST_TIME_ZONE, SLOT_WINDOWS } from '@/shared/constants';
import type { SlotWindow } from '@/shared/constants';

export type { SlotWindow };

export interface Clock {
  now(): Date;
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

export class FrozenClock implements Clock {
  constructor(private readonly instant: Date) {}
  now(): Date {
    return new Date(this.instant.getTime());
  }
}

export const testClock = new FrozenClock(new Date(FROZEN_TEST_NOW));

export function istDateString(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function istWeekday(date: Date): number {
  const name = new Intl.DateTimeFormat('en-US', {
    timeZone: IST_TIME_ZONE,
    weekday: 'short',
  }).format(date);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const day = map[name];
  if (day === undefined) throw new Error(`unexpected weekday ${name}`);
  return day;
}

export function istDateTime(date: string, time: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new RangeError(`invalid local date ${date}`);
  }
  if (!/^\d{2}:\d{2}$/.test(time)) {
    throw new RangeError(`invalid local time ${time}`);
  }
  return new Date(`${date}T${time}:00${IST_OFFSET}`);
}

export function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

export function addDays(dateString: string, days: number): string {
  const [year, month, day] = dateString.split('-').map(Number);
  const utc = Date.UTC(year, month - 1, day + days);
  const d = new Date(utc);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const da = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
}

/** Next Friday strictly after the IST calendar date of `from`. */
export function nextFridayAfter(from: Date): string {
  const start = istDateString(from);
  for (let i = 1; i <= 7; i += 1) {
    const candidate = addDays(start, i);
    if (istWeekday(istDateTime(candidate, '12:00')) === 5) return candidate;
  }
  throw new Error('failed to resolve next Friday');
}

export function thursdayBefore(friday: string): string {
  return addDays(friday, -1);
}

export function slotRange(date: string, window: SlotWindow): { startsAt: Date; endsAt: Date } {
  const times = SLOT_WINDOWS[window];
  return {
    startsAt: istDateTime(date, times.start),
    endsAt: istDateTime(date, times.end),
  };
}

export function bufferedRange(
  startsAt: Date,
  endsAt: Date,
  bufferHours: number,
): { bufferStartsAt: Date; bufferEndsAt: Date } {
  return {
    bufferStartsAt: addHours(startsAt, -bufferHours),
    bufferEndsAt: addHours(endsAt, bufferHours),
  };
}

export function rangesOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart.getTime() < bEnd.getTime() && aEnd.getTime() > bStart.getTime();
}

export function resolveTimePreference(
  startTime: string | null | undefined,
  preference: SlotWindow | 'exact' | undefined,
): SlotWindow {
  if (preference && preference !== 'exact') return preference;
  if (!startTime) return 'evening';
  const [hours] = startTime.split(':').map(Number);
  if (hours < 12) return 'morning';
  if (hours < 17) return 'afternoon';
  return 'evening';
}
