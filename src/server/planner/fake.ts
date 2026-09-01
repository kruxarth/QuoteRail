import {
  IST_TIME_ZONE,
  LOCKED_DEMO_BUDGET_PAISE,
  MAX_REQUEST_CHARS,
} from '@/shared/constants';
import { istDateString, nextFridayAfter, thursdayBefore, type Clock } from '@/shared/clock';
import { rupeesToPaise } from '@/shared/money';
import { looksLikeInjection } from '@/server/audit/redact';
import type { CandidatePlan, CandidateSet, ExtractedRequirements } from '@/shared/schemas';
import type { ModelAdapter, PlannerOfferingSummary } from '@/server/planner/types';

function parseBudgetPaise(text: string): number | null {
  const compact = text.replace(/,/g, '');
  const lakh = compact.match(/₹\s*(\d+(?:\.\d+)?)\s*lakh/i);
  if (lakh) return Number(rupeesToPaise(Math.round(Number(lakh[1]) * 100_000)));
  const rupee = compact.match(/₹\s*(\d+(?:\.\d+)?)/);
  if (rupee) {
    const value = Number(rupee[1]);
    return Number(value > 10_000 ? rupeesToPaise(Math.round(value)) : rupeesToPaise(Math.round(value)));
  }
  const under = compact.match(/under\s+(\d{4,})/i);
  if (under) return Number(rupeesToPaise(Number(under[1])));
  return null;
}

function parseAttendees(text: string): number | null {
  const match =
    text.match(/(\d{2,4})[-\s]*person/i) ||
    text.match(/(\d{2,4})\s+people/i) ||
    text.match(/(\d{2,4})\s+guests/i) ||
    text.match(/for\s+(\d{2,4})\b/i);
  return match ? Number(match[1]) : null;
}

function parseIsoDate(text: string, clock: Clock): { date: string | null; phrase: string } {
  const iso = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (iso) return { date: iso[1], phrase: iso[1] };
  if (/next friday/i.test(text)) {
    const friday = nextFridayAfter(clock.now());
    return { date: friday, phrase: 'next Friday' };
  }
  if (/thursday/i.test(text)) {
    return { date: thursdayBefore(nextFridayAfter(clock.now())), phrase: 'Thursday' };
  }
  if (/friday/i.test(text)) {
    return { date: nextFridayAfter(clock.now()), phrase: 'Friday' };
  }
  return { date: null, phrase: '' };
}

function parseTime(text: string): ExtractedRequirements['time_preference'] {
  if (/5\s*pm|17:00|evening/i.test(text)) return 'evening';
  if (/morning/i.test(text)) return 'morning';
  if (/afternoon/i.test(text)) return 'afternoon';
  return null;
}

function parseDiscountBps(text: string): number {
  const pct = text.match(/(\d{1,2})\s*%\s*discount/i);
  if (pct) return Number(pct[1]) * 100;
  if (/90%\s*discount|ninety percent/i.test(text)) return 9000;
  return 0;
}

export function fakeExtract(request: string, clock: Clock, history: string[] = []): ExtractedRequirements {
  const text = [request, ...history].join('\n').slice(0, MAX_REQUEST_CHARS);
  const attendees = parseAttendees(text);
  const budget = parseBudgetPaise(text);
  const { date, phrase } = parseIsoDate(text, clock);
  const time = parseTime(text);
  const jain = Number(text.match(/(\d+)\s+jain/i)?.[1] ?? 0);
  const vegan = Number(text.match(/(\d+)\s+vegan/i)?.[1] ?? 0);
  const dinner = /dinner|buffet|meal|catering/i.test(text);
  const missing: string[] = [];
  const questions: string[] = [];
  if (!attendees) {
    missing.push('attendee_count');
    questions.push('How many attendees should we plan for?');
  }
  if (!budget) {
    missing.push('budget_subunits');
    questions.push('What is the maximum budget in INR?');
  }
  if (!date) {
    missing.push('requested_date');
    questions.push('Which date do you need the venue?');
  }
  if (!time) {
    missing.push('time_preference');
    questions.push('Do you prefer morning, afternoon, or evening?');
  }
  const cityMatch = /bengaluru|bangalore/i.test(text) ? 'Bengaluru' : /mumbai|delhi|hyderabad/i.test(text) ? 'other' : 'Bengaluru';
  if (cityMatch !== 'Bengaluru') {
    missing.push('city');
    questions.push('QuoteRail currently supports Bengaluru only. Confirm Bengaluru or escalate.');
  }
  const required: string[] = ['theatre'];
  if (/led|professional/i.test(text)) required.push('professional_led', 'pa');
  if (dinner) required.push('dinner');
  if (/premium dinner|premium buffet/i.test(text)) required.push('premium_dinner');
  if (/valet/i.test(text)) required.push('valet');
  if (/branded stage|stage/i.test(text)) required.push('branded_stage');

  return {
    event_type: /launch/i.test(text) ? 'product_launch' : /workshop/i.test(text) ? 'workshop' : /conference/i.test(text) ? 'conference' : 'other',
    attendee_count: attendees,
    budget_subunits: budget,
    currency: 'INR',
    city: cityMatch === 'Bengaluru' ? 'Bengaluru' : cityMatch,
    requested_date: date,
    requested_date_phrase: phrase,
    time_preference: time,
    requested_start_time: time === 'evening' ? '17:00' : time === 'morning' ? '08:00' : time === 'afternoon' ? '14:30' : null,
    duration_hours: 6,
    layout: /theatre|theater/i.test(text) ? 'theatre' : /banquet/i.test(text) ? 'banquet' : 'theatre',
    required_capabilities: required,
    optional_capabilities: [],
    meal_requirements: dinner
      ? {
          total: attendees ?? 0,
          jain,
          vegan,
          vegetarian: 0,
          other_notes: '',
        }
      : null,
    parking_preference: /valet/i.test(text) ? 'valet' : /self-?park/i.test(text) ? 'self' : 'either',
    payment_preference: /40%|deposit/i.test(text) ? 'deposit' : /full/i.test(text) ? 'full' : 'either',
    priorities: ['date', 'service_level', 'budget', 'headcount'],
    notes: '',
    missing_required_fields: missing,
    clarification_questions: questions,
    requested_additional_discount_bps: Math.min(parseDiscountBps(text), 10_000),
    suspicious_instruction: looksLikeInjection(text),
  };
}

function meals(count: number, jain: number, vegan: number) {
  return {
    total: count,
    jain,
    vegan,
    vegetarian: 0,
    other_notes: '',
  };
}

function lockedDemoCandidates(req: ExtractedRequirements, friday: string, thursday: string): CandidatePlan[] {
  const attendees = req.attendee_count ?? 120;
  const jain = req.meal_requirements?.jain ?? 30;
  const vegan = req.meal_requirements?.vegan ?? 10;
  return [
    {
      name: 'Friday evening budget-preserving package',
      event_date: friday,
      start_time: '17:00',
      duration_hours: 6,
      attendee_count: attendees,
      hall_code: 'HALL-GRAND',
      services: [
        { code: 'AV-STANDARD', quantity: 1 },
        { code: 'DINNER-STANDARD', quantity: attendees },
        { code: 'STAGE-BRANDED', quantity: 1 },
        { code: 'EVENT-OPS', quantity: 1 },
      ],
      meal_allocation: meals(attendees, jain, vegan),
      original_constraints_satisfied: ['date', 'headcount', 'budget', 'dietary', 'stage', 'theatre'],
      relaxed_constraints: [
        { constraint: 'av', reason: 'Replaces professional LED wall and PA with standard projector and PA to stay under budget.' },
        { constraint: 'catering', reason: 'Replaces premium dinner with standard dinner while keeping Jain and vegan counts.' },
        { constraint: 'parking', reason: 'Replaces valet with self-parking.' },
        { constraint: 'service_level', reason: 'Standard AV, standard dinner, and self-parking preserve Friday evening.' },
      ],
      assumptions: ['Self-parking is included with the hall.'],
      requested_additional_discount_bps: req.suspicious_instruction ? 0 : req.requested_additional_discount_bps,
      rationale: 'Keeps Friday evening and 120 guests while reducing AV, catering, and parking to fit the budget.',
    },
    {
      name: 'Thursday Studio Hall premium package',
      event_date: thursday,
      start_time: '17:00',
      duration_hours: 6,
      attendee_count: attendees,
      hall_code: 'HALL-STUDIO',
      services: [
        { code: 'AV-PRO', quantity: 1 },
        { code: 'DINNER-PREMIUM', quantity: attendees },
        { code: 'VALET-CREW', quantity: 1 },
        { code: 'STAGE-BRANDED', quantity: 1 },
        { code: 'EVENT-OPS', quantity: 1 },
      ],
      meal_allocation: meals(attendees, jain, vegan),
      original_constraints_satisfied: ['headcount', 'budget', 'service_level', 'dietary', 'parking', 'stage'],
      relaxed_constraints: [
        { constraint: 'date', reason: 'Moves the event to Thursday evening when Studio Hall and premium services are free.' },
        { constraint: 'hall', reason: 'Uses Studio Hall at exact 120-guest capacity.' },
      ],
      assumptions: ['Studio Hall seats exactly 120 in theatre layout.'],
      requested_additional_discount_bps: req.suspicious_instruction ? 0 : req.requested_additional_discount_bps,
      rationale: 'Preserves every requested service and the budget by moving to Thursday evening in Studio Hall.',
    },
    {
      name: 'Exact Friday premium configuration',
      event_date: friday,
      start_time: '17:00',
      duration_hours: 6,
      attendee_count: attendees,
      hall_code: 'HALL-GRAND',
      services: [
        { code: 'AV-PRO', quantity: 1 },
        { code: 'DINNER-PREMIUM', quantity: attendees },
        { code: 'VALET-CREW', quantity: 1 },
        { code: 'STAGE-BRANDED', quantity: 1 },
        { code: 'EVENT-OPS', quantity: 1 },
      ],
      meal_allocation: meals(attendees, jain, vegan),
      original_constraints_satisfied: ['date', 'headcount', 'service_level', 'dietary', 'parking', 'stage', 'theatre'],
      relaxed_constraints: [
        { constraint: 'budget', reason: 'Keeps the exact requested configuration and requires a higher budget.' },
      ],
      assumptions: ['Grand Hall Friday evening is physically available for this configuration.'],
      requested_additional_discount_bps: req.suspicious_instruction ? 0 : req.requested_additional_discount_bps,
      rationale: 'Matches the requested Friday-evening premium package and raises the budget.',
    },
  ];
}

export function fakePlan(input: {
  requirements: ExtractedRequirements;
  offerings: PlannerOfferingSummary[];
  clock: Clock;
  feedback?: string;
}): CandidateSet {
  const req = input.requirements;
  if ((req.attendee_count ?? 0) > 180) {
    return {
      candidates: [],
      cannot_proceed: true,
      escalation_reason: 'No hall can seat this many guests under the seeded catalog.',
    };
  }
  const friday = req.requested_date ?? nextFridayAfter(input.clock.now());
  const thursday = thursdayBefore(friday);
  const looksLikeDemo =
    (req.attendee_count === 120 || req.budget_subunits === Number(LOCKED_DEMO_BUDGET_PAISE)) &&
    (req.required_capabilities.includes('professional_led') || req.required_capabilities.includes('valet'));
  if (looksLikeDemo) {
    return { candidates: lockedDemoCandidates(req, friday, thursday), cannot_proceed: false, escalation_reason: '' };
  }
  const hall = (req.attendee_count ?? 0) > 120 ? 'HALL-GRAND' : 'HALL-STUDIO';
  const dinner = req.required_capabilities.includes('premium_dinner') ? 'DINNER-PREMIUM' : 'DINNER-STANDARD';
  const av = req.required_capabilities.includes('professional_led') ? 'AV-PRO' : 'AV-STANDARD';
  const services = [
    { code: av, quantity: 1 },
    ...(req.required_capabilities.includes('dinner') || req.meal_requirements
      ? [{ code: dinner, quantity: req.attendee_count ?? 1 }]
      : []),
    ...(req.parking_preference === 'valet' ? [{ code: 'VALET-CREW', quantity: 1 }] : []),
    ...(req.required_capabilities.includes('branded_stage') ? [{ code: 'STAGE-BRANDED', quantity: 1 }] : []),
    { code: 'EVENT-OPS', quantity: 1 },
  ];
  const candidate: CandidatePlan = {
    name: 'Primary feasible package',
    event_date: friday,
    start_time: req.requested_start_time ?? '17:00',
    duration_hours: req.duration_hours ?? 6,
    attendee_count: req.attendee_count ?? 20,
    hall_code: hall,
    services,
    meal_allocation: req.meal_requirements ?? meals(req.attendee_count ?? 20, 0, 0),
    original_constraints_satisfied: ['date', 'headcount'],
    relaxed_constraints: [],
    assumptions: [],
    requested_additional_discount_bps: req.suspicious_instruction
      ? 0
      : req.requested_additional_discount_bps,
    rationale: 'Deterministic fallback package from extracted requirements.',
  };
  return { candidates: [candidate], cannot_proceed: false, escalation_reason: '' };
}

export class FakeModelAdapter implements ModelAdapter {
  async extract(input: { request: string; clock: Clock; history?: string[] }): Promise<ExtractedRequirements> {
    return fakeExtract(input.request, input.clock, input.history);
  }
  async plan(input: {
    requirements: ExtractedRequirements;
    offerings: PlannerOfferingSummary[];
    availableSlots: Array<{ code: string; date: string; window: string; available: boolean }>;
    feedback?: string;
    clock: Clock;
  }): Promise<CandidateSet> {
    void input.availableSlots;
    return fakePlan({
      requirements: input.requirements,
      offerings: input.offerings,
      clock: input.clock,
      feedback: input.feedback,
    });
  }
}

export function fakeClockContext(clock: Clock) {
  return {
    now: clock.now().toISOString(),
    calendarDate: istDateString(clock.now()),
    timeZone: IST_TIME_ZONE,
  };
}
