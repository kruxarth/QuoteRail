import { describe, expect, it } from 'vitest';
import { FrozenClock, nextFridayAfter, thursdayBefore, istDateString, rangesOverlap, bufferedRange, istDateTime } from '@/shared/clock';
import { demoDates } from '@/server/availability/slots';
import { FROZEN_DEMO_FRIDAY, FROZEN_DEMO_THURSDAY, FROZEN_TEST_NOW } from '@/shared/constants';

describe('clock', () => {
  it('resolves next Friday after the frozen Monday', () => {
    const clock = new FrozenClock(new Date(FROZEN_TEST_NOW));
    expect(istDateString(clock.now())).toBe('2026-09-07');
    expect(nextFridayAfter(clock.now())).toBe(FROZEN_DEMO_FRIDAY);
    expect(thursdayBefore(FROZEN_DEMO_FRIDAY)).toBe(FROZEN_DEMO_THURSDAY);
  });

  it('skips a Friday whose evening slot misses the 48-hour lead gate', () => {
    const lateWednesday = new FrozenClock(new Date('2026-09-02T16:45:00+05:30'));
    expect(nextFridayAfter(lateWednesday.now())).toBe('2026-09-04');
    expect(demoDates(lateWednesday)).toEqual({ friday: '2026-09-11', thursday: '2026-09-10' });
  });

  it('detects overlapping buffered ranges', () => {
    const a = new Date('2026-09-11T15:00:00+05:30');
    const b = new Date('2026-09-12T01:00:00+05:30');
    const c = new Date('2026-09-11T12:30:00+05:30');
    const d = new Date('2026-09-11T22:30:00+05:30');
    expect(rangesOverlap(a, b, c, d)).toBe(true);
  });

  it('flags afternoon and evening buffers on the same day as overlapping', () => {
    const afternoon = bufferedRange(istDateTime('2026-09-11', '14:30'), istDateTime('2026-09-11', '20:30'), 2);
    const evening = bufferedRange(istDateTime('2026-09-11', '17:00'), istDateTime('2026-09-11', '23:00'), 2);
    expect(
      rangesOverlap(
        afternoon.bufferStartsAt,
        afternoon.bufferEndsAt,
        evening.bufferStartsAt,
        evening.bufferEndsAt,
      ),
    ).toBe(true);
  });
});
