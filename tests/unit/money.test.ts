import { describe, expect, it } from 'vitest';
import {
  applyBpsFloor,
  applyBpsNearest,
  depositAmount,
  formatInr,
  grossMarginBps,
  rupeesToPaise,
} from '@/shared/money';

describe('money', () => {
  it('converts whole rupees to paise', () => {
    expect(rupeesToPaise(80_000)).toBe(8_000_000n);
  });

  it('formats INR with grouping', () => {
    expect(formatInr(19_600_000n)).toBe('₹1,96,000');
  });

  it('uses integer floor for bps', () => {
    expect(applyBpsFloor(8_000_000n, 12_500n)).toBe(10_000_000n);
  });

  it('rounds deposit to nearest paise', () => {
    expect(depositAmount(20_300_000n, 4_000n)).toBe(8_120_000n);
    expect(applyBpsNearest(100n, 4_000n)).toBe(40n);
  });

  it('computes margin with integer floor', () => {
    expect(grossMarginBps(19_600_000n, 8_200_000n)).toBe(5816);
    expect(grossMarginBps(20_300_000n, 9_500_000n)).toBe(5320);
    expect(grossMarginBps(24_800_000n, 10_500_000n)).toBe(5766);
  });
});
