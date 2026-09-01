import { BPS_PER_UNIT } from '@/shared/constants';

export const PAISE_PER_RUPEE = 100n;

export function assertPaise(value: bigint, label = 'amount'): bigint {
  if (typeof value !== 'bigint') {
    throw new TypeError(`${label} must be bigint paise`);
  }
  if (value < 0n) {
    throw new RangeError(`${label} cannot be negative`);
  }
  return value;
}

export function rupeesToPaise(rupees: bigint | number): bigint {
  if (typeof rupees === 'number') {
    if (!Number.isInteger(rupees)) {
      throw new RangeError('rupee amounts must be whole numbers');
    }
    return BigInt(rupees) * PAISE_PER_RUPEE;
  }
  return rupees * PAISE_PER_RUPEE;
}

export function paiseToRupees(paise: bigint): bigint {
  return assertPaise(paise) / PAISE_PER_RUPEE;
}

export function formatInr(paise: bigint): string {
  const negative = paise < 0n;
  const abs = negative ? -paise : paise;
  const rupees = abs / PAISE_PER_RUPEE;
  const remainder = abs % PAISE_PER_RUPEE;
  const grouped = formatIndianGrouping(rupees.toString());
  const decimals = remainder === 0n ? '' : `.${remainder.toString().padStart(2, '0')}`;
  return `${negative ? '-' : ''}₹${grouped}${decimals}`;
}

function formatIndianGrouping(digits: string): string {
  if (digits.length <= 3) return digits;
  const last3 = digits.slice(-3);
  let rest = digits.slice(0, -3);
  const parts: string[] = [];
  while (rest.length > 2) {
    parts.unshift(rest.slice(-2));
    rest = rest.slice(0, -2);
  }
  if (rest) parts.unshift(rest);
  return `${parts.join(',')},${last3}`;
}

export function paiseToJson(paise: bigint): string {
  return paise.toString();
}

export function jsonToPaise(value: string | number | bigint): bigint {
  if (typeof value === 'bigint') return assertPaise(value);
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) {
      throw new RangeError('unsafe numeric paise value');
    }
    return assertPaise(BigInt(value));
  }
  if (!/^-?\d+$/.test(value)) {
    throw new RangeError(`invalid paise string: ${value}`);
  }
  return assertPaise(BigInt(value));
}

/** Integer floor of amount * bps / 10000. */
export function applyBpsFloor(amount: bigint, bps: bigint): bigint {
  assertPaise(amount);
  if (bps < 0n) throw new RangeError('bps cannot be negative');
  return (amount * bps) / BPS_PER_UNIT;
}

/** Round half-up of amount * bps / 10000 to the nearest paise. */
export function applyBpsNearest(amount: bigint, bps: bigint): bigint {
  assertPaise(amount);
  if (bps < 0n) throw new RangeError('bps cannot be negative');
  const numerator = amount * bps;
  const quotient = numerator / BPS_PER_UNIT;
  const remainder = numerator % BPS_PER_UNIT;
  if (remainder * 2n >= BPS_PER_UNIT) return quotient + 1n;
  return quotient;
}

export function depositAmount(totalPaise: bigint, depositBps = 4_000n): bigint {
  return applyBpsNearest(totalPaise, depositBps);
}

/** Integer-floor basis points: ((price - cost) * 10000) / price. */
export function grossMarginBps(finalPrice: bigint, totalCost: bigint): number {
  assertPaise(finalPrice, 'finalPrice');
  assertPaise(totalCost, 'totalCost');
  if (finalPrice === 0n) {
    throw new RangeError('finalPrice must be positive to compute margin');
  }
  return Number(((finalPrice - totalCost) * BPS_PER_UNIT) / finalPrice);
}

export function discountAmount(preDiscountTotal: bigint, discountBps: bigint): bigint {
  return applyBpsFloor(preDiscountTotal, discountBps);
}
