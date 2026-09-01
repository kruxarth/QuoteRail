import {
  ABSOLUTE_CEILING_PAISE,
  AUTO_APPROVAL_CEILING_PAISE,
  DISCOUNT_AUTO_MAX_BPS,
  DISCOUNT_HARD_MAX_BPS,
  MARGIN_FLOOR_BPS,
  MAX_PAYMENT_FAILURES,
  MIN_BOOKING_LEAD_HOURS,
  POLICY_VERSION,
} from '@/shared/constants';
import { addHours } from '@/shared/clock';
import { formatInr } from '@/shared/money';
import { snapshotHash } from '@/shared/hash';
import type { CandidatePlan, ExtractedRequirements } from '@/shared/schemas';
import type { PricedQuote, PricingOffering } from '@/server/pricing/engine';
import { rule, type PolicyAction, type PolicyResult, type PolicyRuleResult } from '@/server/policy/rules';

export type AvailabilityEvidence = {
  offeringCode: string;
  slotId: string | null;
  availableUnits: number;
  requestedUnits: number;
  overlapConflict: boolean;
};

export type PolicyContext = {
  action: PolicyAction;
  now: Date;
  requirements: ExtractedRequirements;
  candidate: CandidatePlan;
  priced: PricedQuote;
  offerings: PricingOffering[];
  availability: AvailabilityEvidence[];
  eventStartsAt: Date;
  bufferStartsAt: Date;
  quoteStatus?: string;
  quoteExpiresAt?: Date;
  storedPolicySnapshotHash?: string;
  storedTotalPrice?: bigint;
  amountDueNow?: bigint;
  paymentTerm?: 'deposit' | 'full';
  reservationsActive?: boolean;
  acceptanceHashMatches?: boolean;
  existingLinkStatus?: string | null;
  failureCount?: number;
};

const NEGOTIABLE = new Set([
  'budget',
  'date',
  'time',
  'attendee_count',
  'hall',
  'av',
  'catering',
  'parking',
  'stage',
  'service_level',
]);

function detectMismatches(ctx: PolicyContext): string[] {
  const mismatches: string[] = [];
  const req = ctx.requirements;
  const cand = ctx.candidate;
  if (req.attendee_count && cand.attendee_count !== req.attendee_count) {
    mismatches.push('attendee_count');
  }
  if (req.requested_date && cand.event_date !== req.requested_date) {
    mismatches.push('date');
  }
  if (req.time_preference && req.time_preference !== 'exact') {
    const [hours] = cand.start_time.split(':').map(Number);
    const window =
      hours < 12 ? 'morning' : hours < 17 ? 'afternoon' : 'evening';
    if (window !== req.time_preference) mismatches.push('time');
  }
  if (req.budget_subunits && ctx.priced.totalPrice > BigInt(req.budget_subunits)) {
    mismatches.push('budget');
  }
  const codes = new Set([cand.hall_code, ...cand.services.map((s) => s.code)]);
  if (req.required_capabilities.includes('professional_led') && !codes.has('AV-PRO')) {
    mismatches.push('av');
  }
  if (req.required_capabilities.includes('dinner') || req.meal_requirements) {
    if (req.required_capabilities.includes('premium_dinner') && !codes.has('DINNER-PREMIUM')) {
      mismatches.push('catering');
    }
  }
  if (req.parking_preference === 'valet' && !codes.has('VALET-CREW')) {
    mismatches.push('parking');
  }
  if (
    (req.required_capabilities.includes('branded_stage') ||
      req.required_capabilities.includes('branded-stage')) &&
    !codes.has('STAGE-BRANDED')
  ) {
    mismatches.push('stage');
  }
  return mismatches;
}

function declaredRelaxations(candidate: CandidatePlan): Set<string> {
  const set = new Set<string>();
  for (const item of candidate.relaxed_constraints) {
    const key = item.constraint.toLowerCase();
    for (const token of NEGOTIABLE) {
      if (key.includes(token) || key.includes(token.replace('_', ' '))) set.add(token);
    }
    if (key.includes('service')) set.add('service_level');
    if (key.includes('budget') || key.includes('price') || key.includes('cost ceiling')) {
      set.add('budget');
    }
  }
  return set;
}

export function evaluatePolicy(ctx: PolicyContext): PolicyResult {
  const rules: PolicyRuleResult[] = [];
  const byCode = new Map(ctx.offerings.map((item) => [item.code, item]));
  const codes = [ctx.candidate.hall_code, ...ctx.candidate.services.map((s) => s.code)];

  const missing = codes.filter((code) => {
    const offering = byCode.get(code);
    return !offering || !offering.active;
  });
  rules.push(
    rule(
      'OFFERING_CODE_EXISTS',
      missing.length === 0,
      'block',
      missing.join(',') || 'all codes active',
      'active merchant offering codes',
      missing.length ? `Unknown or inactive offering codes: ${missing.join(', ')}` : 'All offering codes exist',
    ),
  );

  const slotMissing = ctx.availability.filter((item) => !item.slotId);
  rules.push(
    rule(
      'RESOURCE_SLOT_EXISTS',
      slotMissing.length === 0,
      'block',
      slotMissing.map((s) => s.offeringCode).join(',') || 'slots resolved',
      'concrete resource_slots rows',
      slotMissing.length ? 'One or more requested slots do not exist' : 'Requested slots exist',
    ),
  );

  const unavailable = ctx.availability.filter((item) => item.availableUnits < item.requestedUnits);
  rules.push(
    rule(
      'RESOURCE_AVAILABLE',
      unavailable.length === 0,
      'block',
      unavailable.map((s) => `${s.offeringCode}:${s.availableUnits}/${s.requestedUnits}`).join(',') ||
        'available',
      'capacity minus blocked minus overlapping reservations',
      unavailable.length ? 'Requested resources are not available' : 'Resources are available',
    ),
  );

  const hall = byCode.get(ctx.candidate.hall_code);
  const hallOk = !!hall && (hall.capacityUnits ?? 0) >= ctx.candidate.attendee_count;
  rules.push(
    rule(
      'HALL_CAPACITY_SUFFICIENT',
      hallOk,
      'block',
      String(ctx.candidate.attendee_count),
      String(hall?.capacityUnits ?? 0),
      hallOk ? 'Hall capacity covers attendees' : 'Attendee count exceeds hall capacity',
    ),
  );

  const overlap = ctx.availability.some((item) => item.overlapConflict);
  rules.push(
    rule(
      'TIME_BUFFER_CONFLICT_FREE',
      !overlap,
      'block',
      overlap ? 'overlap' : 'clear',
      'no overlapping buffered reservations',
      overlap ? 'Setup or teardown buffer overlaps another booking' : 'No time-buffer conflict',
    ),
  );

  const leadDeadline = addHours(ctx.now, MIN_BOOKING_LEAD_HOURS);
  const leadOk = ctx.bufferStartsAt.getTime() >= leadDeadline.getTime();
  rules.push(
    rule(
      'MIN_BOOKING_LEAD_TIME_48H',
      leadOk,
      'block',
      ctx.bufferStartsAt.toISOString(),
      leadDeadline.toISOString(),
      leadOk
        ? 'Buffered setup start meets the 48-hour lead time'
        : 'Event is too soon; 48-hour lead time required',
    ),
  );

  const meals = ctx.candidate.meal_allocation;
  const mealBalanced =
    meals.jain + meals.vegan + meals.vegetarian <= meals.total &&
    meals.total === ctx.candidate.attendee_count;
  rules.push(
    rule(
      'MEAL_COUNTS_BALANCED',
      mealBalanced,
      'block',
      `jain=${meals.jain},vegan=${meals.vegan},veg=${meals.vegetarian},total=${meals.total}`,
      `dietary subcounts <= ${ctx.candidate.attendee_count}`,
      mealBalanced ? 'Meal counts are internally consistent' : 'Dietary subcounts exceed attendees or meal total',
    ),
  );

  const reqMeals = ctx.requirements.meal_requirements;
  const dietaryOk =
    !reqMeals ||
    (meals.jain >= reqMeals.jain &&
      meals.vegan >= reqMeals.vegan &&
      meals.total >= reqMeals.total);
  rules.push(
    rule(
      'DIETARY_REQUIREMENTS_SATISFIED',
      dietaryOk,
      'block',
      `jain=${meals.jain},vegan=${meals.vegan}`,
      reqMeals ? `jain>=${reqMeals.jain}, vegan>=${reqMeals.vegan}` : 'none declared',
      dietaryOk ? 'Declared dietary requirements are met' : 'Declared dietary requirements were dropped',
    ),
  );

  const capabilityCodes = new Set(ctx.priced.lines.flatMap((line) => line.capabilities));
  const capabilityMap: Record<string, string[]> = {
    professional_led: ['led-wall', 'professional_led'],
    pa: ['pa', 'professional-pa', 'standard-pa'],
    dinner: ['dinner'],
    premium_dinner: ['premium_dinner'],
    valet: ['valet'],
    branded_stage: ['branded-stage', 'branded_stage'],
    theatre: ['theatre'],
  };
  const missingCaps = (ctx.requirements.required_capabilities ?? []).filter((cap) => {
    const aliases = capabilityMap[cap] ?? [cap];
    return !aliases.some((alias) => capabilityCodes.has(alias));
  });
  const mismatches = detectMismatches(ctx);
  const declared = declaredRelaxations(ctx.candidate);
  const capabilityFailuresAreNegotiable = missingCaps.every((cap) => {
    if (cap === 'professional_led' || cap === 'pa') return declared.has('av') || declared.has('service_level');
    if (cap === 'dinner' || cap === 'premium_dinner') return declared.has('catering') || declared.has('service_level');
    if (cap === 'valet') return declared.has('parking');
    if (cap === 'branded_stage') return declared.has('stage') || declared.has('service_level');
    return declared.has(cap) || declared.has('service_level');
  });
  rules.push(
    rule(
      'REQUIRED_CAPABILITIES_SATISFIED',
      missingCaps.length === 0 || capabilityFailuresAreNegotiable,
      missingCaps.length && !capabilityFailuresAreNegotiable ? 'block' : 'info',
      missingCaps.join(',') || 'all matched',
      (ctx.requirements.required_capabilities ?? []).join(','),
      missingCaps.length
        ? `Missing capabilities: ${missingCaps.join(', ')}`
        : 'Required capabilities are present',
    ),
  );

  const undeclared = mismatches.filter((item) => !declared.has(item) && !declared.has('service_level'));
  rules.push(
    rule(
      'BUYER_RELAXATION_EXPLICIT',
      undeclared.length === 0,
      'block',
      mismatches.join(',') || 'none',
      'each negotiable mismatch must be declared',
      undeclared.length
        ? `Undeclared trade-offs: ${undeclared.join(', ')}`
        : 'All negotiable mismatches are declared',
    ),
  );

  rules.push(
    rule(
      'PRICE_SERVER_COMPUTED',
      ctx.priced.totalPrice > 0n,
      'block',
      ctx.priced.totalPrice.toString(),
      'server-owned paise total',
      'Totals are computed from catalog prices',
    ),
  );

  const marginOk = ctx.priced.grossMarginBps >= Number(MARGIN_FLOOR_BPS);
  rules.push(
    rule(
      'MARGIN_FLOOR_25_PERCENT',
      marginOk,
      'block',
      `${ctx.priced.grossMarginBps} bps`,
      `${MARGIN_FLOOR_BPS} bps`,
      marginOk ? 'Gross margin meets the floor' : 'Gross margin is below the merchant floor',
      marginOk ? undefined : 'This package cannot be offered under merchant commercial policy',
    ),
  );

  const discountBps = ctx.priced.additionalDiscountBps;
  const discountHardOk = discountBps <= DISCOUNT_HARD_MAX_BPS;
  rules.push(
    rule(
      'ADDITIONAL_DISCOUNT_MAX_10_PERCENT',
      discountHardOk,
      'block',
      `${discountBps} bps`,
      `${DISCOUNT_HARD_MAX_BPS} bps`,
      discountHardOk
        ? 'Requested discount is within the 10% ceiling'
        : 'Requested discount exceeds the merchant-authorized range',
      discountHardOk ? undefined : 'This discount exceeds the merchant-authorized range',
    ),
  );

  const discountNeedsApproval = discountBps > DISCOUNT_AUTO_MAX_BPS && discountHardOk;
  rules.push(
    rule(
      'DISCOUNT_APPROVAL_THRESHOLD_5_PERCENT',
      !discountNeedsApproval,
      'approval',
      `${discountBps} bps`,
      `${DISCOUNT_AUTO_MAX_BPS} bps automatic`,
      discountNeedsApproval
        ? 'Discount above 5% requires merchant approval'
        : 'Discount is within automatic range',
    ),
  );

  const autoLimitOk = ctx.priced.totalPrice <= AUTO_APPROVAL_CEILING_PAISE;
  rules.push(
    rule(
      'FULL_BOOKING_AUTO_LIMIT_260K',
      autoLimitOk,
      'approval',
      formatInr(ctx.priced.totalPrice),
      formatInr(AUTO_APPROVAL_CEILING_PAISE),
      autoLimitOk
        ? 'Full booking total is within automatic approval'
        : 'Full booking total requires merchant approval',
    ),
  );

  const absoluteOk = ctx.priced.totalPrice <= ABSOLUTE_CEILING_PAISE;
  rules.push(
    rule(
      'FULL_BOOKING_ABSOLUTE_LIMIT_350K',
      absoluteOk,
      'block',
      formatInr(ctx.priced.totalPrice),
      formatInr(ABSOLUTE_CEILING_PAISE),
      absoluteOk
        ? 'Full booking total is below the absolute ceiling'
        : 'Full booking total exceeds the absolute ceiling',
    ),
  );

  if (ctx.action === 'accept_quote' || ctx.action === 'create_checkout') {
    const statusOk = ctx.quoteStatus === 'offered' || ctx.quoteStatus === 'accepted';
    rules.push(
      rule(
        'QUOTE_STATUS_OFFERED',
        ctx.action === 'create_checkout' ? ctx.quoteStatus === 'accepted' : ctx.quoteStatus === 'offered',
        'block',
        ctx.quoteStatus ?? 'missing',
        ctx.action === 'create_checkout' ? 'accepted' : 'offered',
        'Quote status is valid for this action',
      ),
    );
    void statusOk;
    const unexpired = !ctx.quoteExpiresAt || ctx.now.getTime() <= ctx.quoteExpiresAt.getTime() || ctx.quoteStatus === 'accepted';
    rules.push(
      rule(
        'QUOTE_NOT_EXPIRED',
        ctx.action === 'create_checkout' ? true : !!ctx.quoteExpiresAt && ctx.now.getTime() <= ctx.quoteExpiresAt.getTime(),
        'block',
        ctx.quoteExpiresAt?.toISOString() ?? 'missing',
        ctx.now.toISOString(),
        unexpired ? 'Quote has not expired' : 'Quote offer window has expired',
      ),
    );
    const snapshotOk =
      !ctx.storedPolicySnapshotHash || ctx.storedPolicySnapshotHash === policySnapshotHash(rules);
    rules.push(
      rule(
        'QUOTE_POLICY_SNAPSHOT_MATCH',
        ctx.action === 'accept_quote' ? true : snapshotOk || ctx.action === 'create_checkout',
        'block',
        ctx.storedPolicySnapshotHash ?? 'n/a',
        'stored policy snapshot',
        'Policy snapshot is consistent',
      ),
    );
    rules.push(
      rule(
        'RESOURCE_CAPACITY_RECHECKED',
        unavailable.length === 0 && !overlap,
        'block',
        'rechecked',
        'atomic capacity recheck',
        unavailable.length || overlap ? 'Capacity recheck failed' : 'Capacity recheck passed',
      ),
    );
  }

  if (ctx.action === 'create_checkout') {
    rules.push(
      rule(
        'RESERVATION_ACTIVE',
        ctx.reservationsActive === true,
        'block',
        String(ctx.reservationsActive),
        'all required reservations active',
        ctx.reservationsActive ? 'Reservations are active' : 'Reservations are missing or expired',
      ),
    );
    rules.push(
      rule(
        'ACCEPTANCE_HASH_MATCH',
        ctx.acceptanceHashMatches !== false,
        'block',
        String(ctx.acceptanceHashMatches),
        'canonical acceptance hash',
        ctx.acceptanceHashMatches === false ? 'Acceptance hash mismatch' : 'Acceptance hash matches',
      ),
    );
    const termOk = ctx.paymentTerm === 'deposit' || ctx.paymentTerm === 'full';
    const dueOk =
      ctx.paymentTerm === 'deposit'
        ? ctx.amountDueNow === ctx.priced.depositAmount
        : ctx.amountDueNow === ctx.priced.totalPrice;
    rules.push(
      rule(
        'PAYMENT_TERM_ALLOWED',
        termOk && dueOk,
        'block',
        `${ctx.paymentTerm}:${ctx.amountDueNow?.toString() ?? 'n/a'}`,
        'deposit or full; amount_due_now from stored quote',
        termOk && dueOk ? 'Payment term and amount match the accepted quote' : 'Payment term or amount is invalid',
      ),
    );
    const linkOk =
      !ctx.existingLinkStatus ||
      ctx.existingLinkStatus === 'creating' ||
      ctx.existingLinkStatus === 'issued';
    rules.push(
      rule(
        'ONE_ACTIVE_LINK_PER_ACCEPTANCE',
        linkOk,
        'block',
        ctx.existingLinkStatus ?? 'none',
        'at most one Payment Link',
        linkOk ? 'Checkout is idempotent' : 'A terminal Payment Link already exists',
      ),
    );
    const retryOk = (ctx.failureCount ?? 0) <= MAX_PAYMENT_FAILURES;
    rules.push(
      rule(
        'PAYMENT_RETRY_LIMIT',
        retryOk,
        'block',
        String(ctx.failureCount ?? 0),
        String(MAX_PAYMENT_FAILURES),
        retryOk ? 'Retries remain' : 'Retry limit reached',
      ),
    );
  }

  const hardBlock = rules.filter((item) => !item.passed && item.severity === 'block');
  const approvalNeeded = rules.some((item) => !item.passed && item.severity === 'approval');
  const allowed = hardBlock.length === 0;
  return {
    allowed,
    action: ctx.action,
    summary: allowed
      ? approvalNeeded
        ? 'Offerable pending merchant approval'
        : 'Policy passed'
      : `Blocked by ${hardBlock.map((item) => item.id).join(', ')}`,
    rules,
    requiresMerchantApproval: allowed && approvalNeeded,
  };
}

export function policySnapshotHash(rules: PolicyRuleResult[]): string {
  return snapshotHash({
    version: POLICY_VERSION,
    rules: rules.map((item) => ({ id: item.id, passed: item.passed, severity: item.severity })),
  });
}

export function buyerFacingRules(result: PolicyResult): Array<{
  id: string;
  passed: boolean;
  reason: string;
}> {
  return result.rules.map((item) => ({
    id: item.id,
    passed: item.passed,
    reason: item.buyerFacingReason ?? (item.passed ? item.reason : item.reason),
  }));
}
