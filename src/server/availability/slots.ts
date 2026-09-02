import { MIN_BOOKING_LEAD_HOURS, SETUP_BUFFER_HOURS } from '@/shared/constants';
import {
  addDays,
  addHours,
  bufferedRange,
  nextFridayAfter,
  slotRange,
  thursdayBefore,
  type SlotWindow,
} from '@/shared/clock';
import type { Clock } from '@/shared/clock';

export const DEMO_WINDOWS: SlotWindow[] = ['morning', 'afternoon', 'evening'];

export function eveningSlotMeetsLead(date: string, now: Date): boolean {
  const range = slotRange(date, 'evening');
  const buffered = bufferedRange(range.startsAt, range.endsAt, SETUP_BUFFER_HOURS);
  return buffered.bufferStartsAt.getTime() >= addHours(now, MIN_BOOKING_LEAD_HOURS).getTime();
}

export function demoDates(clock: Clock): { friday: string; thursday: string } {
  let friday = nextFridayAfter(clock.now());
  for (let week = 0; week < 4; week += 1) {
    if (eveningSlotMeetsLead(friday, clock.now())) {
      return { friday, thursday: thursdayBefore(friday) };
    }
    friday = addDays(friday, 7);
  }
  return { friday, thursday: thursdayBefore(friday) };
}

export function seedSlotCalendar(clock: Clock, days = 21): Array<{
  date: string;
  window: SlotWindow;
  startsAt: Date;
  endsAt: Date;
  bufferStartsAt: Date;
  bufferEndsAt: Date;
}> {
  const start = demoDates(clock).thursday;
  const out = [];
  for (let i = -3; i < days; i += 1) {
    const date = addDays(start, i);
    for (const window of DEMO_WINDOWS) {
      const range = slotRange(date, window);
      const buffered = bufferedRange(range.startsAt, range.endsAt, SETUP_BUFFER_HOURS);
      out.push({
        date,
        window,
        startsAt: range.startsAt,
        endsAt: range.endsAt,
        bufferStartsAt: buffered.bufferStartsAt,
        bufferEndsAt: buffered.bufferEndsAt,
      });
    }
  }
  return out;
}

export function isStudioFridayEveningBlock(date: string, window: SlotWindow, friday: string): boolean {
  return date === friday && window === 'evening';
}
