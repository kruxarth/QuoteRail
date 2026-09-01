import { describe, expect, it } from 'vitest';
import { priceCandidate, hallMultiplierBps } from '@/server/pricing/engine';
import { OFFERING_SEEDS } from '@/server/catalog/offerings';
import { offeringIdFor } from '@/server/catalog/seed';
import { rupeesToPaise } from '@/shared/money';
import { istDateTime } from '@/shared/clock';
import type { CandidatePlan } from '@/shared/schemas';

const offerings = OFFERING_SEEDS.map((seed) => ({
  id: offeringIdFor(seed.code),
  code: seed.code,
  name: seed.name,
  category: seed.category,
  pricingModel: seed.pricingModel,
  salePriceSubunits: rupeesToPaise(seed.saleRupees),
  costSubunits: rupeesToPaise(seed.costRupees),
  capacityUnits: seed.capacityUnits,
  capabilities: seed.capabilities,
  active: true,
}));

function meals(total: number) {
  return { total, jain: 30, vegan: 10, vegetarian: 0, other_notes: '' };
}

describe('locked demo pricing', () => {
  it('applies Friday evening hall multiplier only to the hall', () => {
    expect(hallMultiplierBps(istDateTime('2026-09-11', '17:00'), 'evening')).toBe(12_500n);
    expect(hallMultiplierBps(istDateTime('2026-09-11', '10:00'), 'morning')).toBe(11_000n);
    expect(hallMultiplierBps(istDateTime('2026-09-10', '17:00'), 'evening')).toBe(10_000n);
    expect(hallMultiplierBps(istDateTime('2026-09-12', '17:00'), 'evening')).toBe(13_500n);
  });

  it('prices option 1 at ₹1,96,000 with ₹78,400 deposit', () => {
    const candidate: CandidatePlan = {
      name: 'o1',
      event_date: '2026-09-11',
      start_time: '17:00',
      duration_hours: 6,
      attendee_count: 120,
      hall_code: 'HALL-GRAND',
      services: [
        { code: 'AV-STANDARD', quantity: 1 },
        { code: 'DINNER-STANDARD', quantity: 120 },
        { code: 'STAGE-BRANDED', quantity: 1 },
        { code: 'EVENT-OPS', quantity: 1 },
      ],
      meal_allocation: meals(120),
      original_constraints_satisfied: [],
      relaxed_constraints: [],
      assumptions: [],
      requested_additional_discount_bps: 0,
      rationale: '',
    };
    const priced = priceCandidate(candidate, offerings, istDateTime('2026-09-11', '17:00'), 'evening');
    expect(priced.totalPrice).toBe(19_600_000n);
    expect(priced.depositAmount).toBe(7_840_000n);
    expect(priced.totalCost).toBe(8_200_000n);
    expect(priced.grossMarginBps).toBe(5816);
  });

  it('prices option 2 at ₹2,03,000 with ₹81,200 deposit', () => {
    const candidate: CandidatePlan = {
      name: 'o2',
      event_date: '2026-09-10',
      start_time: '17:00',
      duration_hours: 6,
      attendee_count: 120,
      hall_code: 'HALL-STUDIO',
      services: [
        { code: 'AV-PRO', quantity: 1 },
        { code: 'DINNER-PREMIUM', quantity: 120 },
        { code: 'VALET-CREW', quantity: 1 },
        { code: 'STAGE-BRANDED', quantity: 1 },
        { code: 'EVENT-OPS', quantity: 1 },
      ],
      meal_allocation: meals(120),
      original_constraints_satisfied: [],
      relaxed_constraints: [],
      assumptions: [],
      requested_additional_discount_bps: 0,
      rationale: '',
    };
    const priced = priceCandidate(candidate, offerings, istDateTime('2026-09-10', '17:00'), 'evening');
    expect(priced.totalPrice).toBe(20_300_000n);
    expect(priced.depositAmount).toBe(8_120_000n);
    expect(priced.totalCost).toBe(9_500_000n);
    expect(priced.grossMarginBps).toBe(5320);
  });

  it('prices option 3 at ₹2,48,000', () => {
    const candidate: CandidatePlan = {
      name: 'o3',
      event_date: '2026-09-11',
      start_time: '17:00',
      duration_hours: 6,
      attendee_count: 120,
      hall_code: 'HALL-GRAND',
      services: [
        { code: 'AV-PRO', quantity: 1 },
        { code: 'DINNER-PREMIUM', quantity: 120 },
        { code: 'VALET-CREW', quantity: 1 },
        { code: 'STAGE-BRANDED', quantity: 1 },
        { code: 'EVENT-OPS', quantity: 1 },
      ],
      meal_allocation: meals(120),
      original_constraints_satisfied: [],
      relaxed_constraints: [],
      assumptions: [],
      requested_additional_discount_bps: 0,
      rationale: '',
    };
    const priced = priceCandidate(candidate, offerings, istDateTime('2026-09-11', '17:00'), 'evening');
    expect(priced.totalPrice).toBe(24_800_000n);
    expect(priced.totalCost).toBe(10_500_000n);
    expect(priced.grossMarginBps).toBe(5766);
  });
});
