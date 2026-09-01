import {
  DEPOSIT_BPS,
  HALL_MULTIPLIER_BPS,
  MANDATORY_OPERATIONS_CODE,
} from '@/shared/constants';
import { istWeekday } from '@/shared/clock';
import { applyBpsFloor, depositAmount, discountAmount, grossMarginBps } from '@/shared/money';
import { snapshotHash } from '@/shared/hash';
import type { SlotWindow } from '@/shared/constants';
import type { CandidatePlan } from '@/shared/schemas';

export type PricingOffering = {
  id: string;
  code: string;
  name: string;
  category: 'hall' | 'av' | 'catering' | 'parking' | 'staging' | 'operations';
  pricingModel: 'hall_slot' | 'fixed' | 'per_guest';
  salePriceSubunits: bigint;
  costSubunits: bigint;
  capacityUnits: number | null;
  capabilities: string[];
  active: boolean;
};

export type PricedLine = {
  offeringId: string;
  code: string;
  name: string;
  category: PricingOffering['category'];
  pricingModel: PricingOffering['pricingModel'];
  quantity: number;
  unitPrice: bigint;
  unitCost: bigint;
  multiplierBps: bigint;
  linePrice: bigint;
  lineCost: bigint;
  capabilities: string[];
};

export type PricedQuote = {
  lines: PricedLine[];
  serviceSubtotal: bigint;
  hallSlotAdjustment: bigint;
  additionalDiscount: bigint;
  additionalDiscountBps: bigint;
  totalPrice: bigint;
  totalCost: bigint;
  grossMarginBps: number;
  depositBps: bigint;
  depositAmount: bigint;
  offeringSnapshotHash: string;
};

export function hallMultiplierBps(eventStartsAt: Date, window: SlotWindow): bigint {
  const weekday = istWeekday(eventStartsAt);
  if (weekday === 0 || weekday === 6) return HALL_MULTIPLIER_BPS.weekend;
  if (weekday === 5) {
    return window === 'evening' ? HALL_MULTIPLIER_BPS.fridayEvening : HALL_MULTIPLIER_BPS.fridayDay;
  }
  return HALL_MULTIPLIER_BPS.weekday;
}

export function priceCandidate(
  candidate: CandidatePlan,
  offerings: PricingOffering[],
  eventStartsAt: Date,
  window: SlotWindow,
): PricedQuote {
  const byCode = new Map(offerings.map((item) => [item.code, item]));
  const requested = new Map<string, number>();
  requested.set(candidate.hall_code, 1);
  for (const service of candidate.services) {
    requested.set(service.code, (requested.get(service.code) ?? 0) + service.quantity);
  }
  if (!requested.has(MANDATORY_OPERATIONS_CODE)) {
    requested.set(MANDATORY_OPERATIONS_CODE, 1);
  }

  const hall = byCode.get(candidate.hall_code);
  if (!hall) throw new Error(`unknown hall ${candidate.hall_code}`);
  const multiplier = hallMultiplierBps(eventStartsAt, window);

  const lines: PricedLine[] = [];
  let serviceSubtotal = 0n;
  let hallSlotAdjustment = 0n;
  let totalCost = 0n;

  for (const [code, quantity] of requested) {
    const offering = byCode.get(code);
    if (!offering) throw new Error(`unknown offering ${code}`);
    const isHall = offering.pricingModel === 'hall_slot';
    const qty =
      offering.pricingModel === 'per_guest' ? candidate.attendee_count : quantity;
    const lineMultiplier = isHall ? multiplier : 10_000n;
    const unitPrice = offering.salePriceSubunits;
    const unitCost = offering.costSubunits;
    const baseLine = unitPrice * BigInt(qty);
    const linePrice = isHall ? applyBpsFloor(baseLine, multiplier) : baseLine;
    const lineCost = unitCost * BigInt(qty);
    if (isHall) {
      hallSlotAdjustment += linePrice - baseLine;
      serviceSubtotal += baseLine;
    } else {
      serviceSubtotal += linePrice;
    }
    totalCost += lineCost;
    lines.push({
      offeringId: offering.id,
      code: offering.code,
      name: offering.name,
      category: offering.category,
      pricingModel: offering.pricingModel,
      quantity: qty,
      unitPrice,
      unitCost,
      multiplierBps: lineMultiplier,
      linePrice,
      lineCost,
      capabilities: offering.capabilities,
    });
  }

  const preDiscount = serviceSubtotal + hallSlotAdjustment;
  const additionalDiscountBps = BigInt(candidate.requested_additional_discount_bps);
  const additionalDiscount = discountAmount(preDiscount, additionalDiscountBps);
  const totalPrice = preDiscount - additionalDiscount;
  return {
    lines,
    serviceSubtotal,
    hallSlotAdjustment,
    additionalDiscount,
    additionalDiscountBps,
    totalPrice,
    totalCost,
    grossMarginBps: grossMarginBps(totalPrice, totalCost),
    depositBps: DEPOSIT_BPS,
    depositAmount: depositAmount(totalPrice, DEPOSIT_BPS),
    offeringSnapshotHash: snapshotHash(
      lines.map((line) => ({
        code: line.code,
        quantity: line.quantity,
        unitPrice: line.unitPrice.toString(),
        unitCost: line.unitCost.toString(),
        multiplierBps: line.multiplierBps.toString(),
        linePrice: line.linePrice.toString(),
      })),
    ),
  };
}
