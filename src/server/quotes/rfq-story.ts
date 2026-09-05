import { formatInr } from '@/shared/money';

const RULE_COPY: Record<string, string> = {
  MIN_BOOKING_LEAD_TIME_48H: 'Too soon — setup must start at least 48 hours from now',
  REQUIRED_CAPABILITIES_SATISFIED: 'Requested services were missing or not declared as a trade-off',
  BUYER_RELAXATION_EXPLICIT: 'The package changed the ask without declaring that trade-off',
  OFFERING_CODE_EXISTS: 'Unknown or inactive service code',
  RESOURCE_SLOT_EXISTS: 'No matching hall/service slot on that date',
  RESOURCE_CAPACITY_AVAILABLE: 'That slot is already held or blocked',
  HALL_CAPACITY: 'Headcount exceeds hall capacity',
  MEAL_COUNTS_BALANCED: 'Meal counts do not add up',
  MARGIN_FLOOR_25_PERCENT: 'Margin would fall below the merchant floor',
  ADDITIONAL_DISCOUNT_MAX_10_PERCENT: 'Requested discount is above the allowed range',
};

export function ruleLabel(ruleId: string): string {
  return RULE_COPY[ruleId] ?? ruleId.replaceAll('_', ' ').toLowerCase();
}

export function eventLabel(eventType: string): string {
  const labels: Record<string, string> = {
    'rfq.received': 'Enquiry received',
    'rfq.requirements_extracted': 'Requirements extracted',
    'rfq.clarification_required': 'Asked the buyer for missing details',
    'rfq.clarification_answered': 'Buyer answered',
    'agent.candidates_proposed': 'Agent proposed packages',
    'agent.candidates_revised': 'Agent revised packages after policy',
    'agent.escalated': 'Handed to merchant — no safe package',
    'agent.provider_unavailable': 'Seller model unavailable',
    'agent.deadline_exceeded': 'Timed out while quoting',
    'quote.offered': 'Quote offered',
    'quote.accepted': 'Buyer accepted a quote',
    'checkout.link_created': 'Razorpay link created',
    'payment.paid': 'Deposit paid',
    'payment.attempt_failed': 'Payment attempt failed',
    'security.buyer_instruction_detected': 'Buyer tried to override seller rules',
  };
  return labels[eventType] ?? eventType;
}

export type EscalationAttempt = {
  name: string;
  blockers: string[];
};

export function parseEscalationAttempts(summary: string | null | undefined): EscalationAttempt[] {
  if (!summary?.trim()) return [];
  return summary
    .split(';')
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const [namePart, rest] = chunk.split(':');
      const name = (namePart ?? 'Package').trim();
      const bracket = rest?.match(/\[([^\]]+)\]/)?.[1];
      const fromList = bracket
        ? bracket
            .split(',')
            .map((id) => id.trim())
            .filter(Boolean)
        : [...(rest ?? '').matchAll(/[A-Z][A-Z0-9_]+/g)].map((match) => match[0]);
      const unique = [...new Set(fromList)].filter((id) => id !== 'Blocked');
      return { name, blockers: unique };
    });
}

export function humanizePlanningFailures(
  failures: string[],
  dates?: { friday: string; thursday: string },
): string {
  const blob = failures.join(' ');
  if (blob.includes('MIN_BOOKING_LEAD_TIME_48H')) {
    const next =
      dates != null
        ? ` Earliest auto-quotable Friday evening is ${dates.friday} (Thursday alternative ${dates.thursday}).`
        : '';
    return `No safe package: the requested evening is inside the 48-hour lead window (setup starts two hours before the event).${next} Mosaic should call or email the buyer, or they can send a new enquiry for a later date.`;
  }
  if (blob.includes('HALL_CAPACITY')) {
    return 'No hall in the catalog can seat this many guests. Mosaic needs to handle this enquiry by hand.';
  }
  return (
    failures.join('; ') ||
    'No safe package after two planning attempts. Mosaic should follow up directly.'
  );
}

export function buyerNextAction(status: string): string | undefined {
  switch (status) {
    case 'escalated':
      return 'This RFQ is closed to the agent. Mosaic follows up out of band. If the date or requirements can move, send a new request_quote. continue_rfq will be rejected.';
    case 'quoted':
      return 'Present the options. Accept one quote, then create_checkout. Do not invent a price.';
    case 'needs_clarification':
      return 'Answer clarification_questions with continue_rfq.';
    case 'retryable_error':
      return 'Retry with continue_rfq.';
    default:
      return undefined;
  }
}

export function rfqStatusCopy(status: string): {
  title: string;
  tone: 'ok' | 'warn' | 'danger' | 'info' | 'neutral';
  what: string;
  sellerNext: string;
} {
  switch (status) {
    case 'escalated':
      return {
        title: 'Needs a person',
        tone: 'danger',
        what: 'Mosaic stopped instead of inventing a date, price, or package that would break policy. The buyer agent was told there is nothing to accept.',
        sellerNext:
          'Call or email the buyer. Mosaic does not chat with their agent — a bot message would just tell them to phone you. If they can move the date, they should send a new enquiry; this one cannot be continued.',
      };
    case 'quoted':
      return {
        title: 'Quoted',
        tone: 'ok',
        what: 'The buyer agent has bookable alternatives with server-owned prices.',
        sellerNext:
          'Watch this page. If they accept, you will see a hold and then a Razorpay deposit.',
      };
    case 'needs_clarification':
      return {
        title: 'Waiting on the buyer',
        tone: 'warn',
        what: 'Required details were missing, so Mosaic asked the buyer agent to continue the enquiry.',
        sellerNext: 'No action unless they go quiet. You can still call them.',
      };
    case 'retryable_error':
      return {
        title: 'Temporary seller-model failure',
        tone: 'warn',
        what: 'Extraction or planning hit a timeout or provider error.',
        sellerNext: 'The buyer can retry with continue_rfq. If it keeps failing, call them.',
      };
    case 'planning':
      return {
        title: 'Still planning',
        tone: 'info',
        what: 'The seller agent is proposing and checking packages.',
        sellerNext: 'Wait — this page refreshes on its own.',
      };
    case 'received':
      return {
        title: 'Just in',
        tone: 'info',
        what: 'The brief landed. Mosaic has not priced it yet.',
        sellerNext: 'Wait a moment — extraction and planning start on their own.',
      };
    case 'closed':
      return {
        title: 'Closed',
        tone: 'neutral',
        what: 'This enquiry is finished.',
        sellerNext: 'Nothing further on this RFQ.',
      };
    default:
      return {
        title: status.replaceAll('_', ' '),
        tone: 'info',
        what: 'The enquiry is in progress.',
        sellerNext: 'Watch the activity on the right.',
      };
  }
}

export function requirementFacts(requirements: unknown): Array<{ label: string; value: string }> {
  if (!requirements || typeof requirements !== 'object') return [];
  const req = requirements as Record<string, unknown>;
  const meals =
    req.meal_requirements && typeof req.meal_requirements === 'object'
      ? (req.meal_requirements as Record<string, unknown>)
      : null;
  const budget =
    typeof req.budget_subunits === 'number' ? formatInr(BigInt(req.budget_subunits)) : null;
  const caps = Array.isArray(req.required_capabilities)
    ? req.required_capabilities.map(String).join(', ')
    : '';
  const facts: Array<{ label: string; value: string }> = [];
  if (req.event_type)
    facts.push({ label: 'Event', value: String(req.event_type).replaceAll('_', ' ') });
  if (req.requested_date) {
    facts.push({
      label: 'When',
      value: `${req.requested_date}${req.requested_start_time ? ` · ${req.requested_start_time}` : ''} IST · ${req.duration_hours ?? '?'} hours`,
    });
  }
  if (req.attendee_count) facts.push({ label: 'Guests', value: String(req.attendee_count) });
  if (req.city) facts.push({ label: 'City', value: String(req.city) });
  if (req.layout) facts.push({ label: 'Layout', value: String(req.layout) });
  if (budget) facts.push({ label: 'Budget ceiling', value: budget });
  if (req.payment_preference) facts.push({ label: 'Pay', value: String(req.payment_preference) });
  if (req.parking_preference)
    facts.push({ label: 'Parking', value: String(req.parking_preference) });
  if (caps) facts.push({ label: 'Asked for', value: caps.replaceAll('_', ' ') });
  if (meals) {
    facts.push({
      label: 'Meals',
      value: `${meals.total ?? '—'} total · ${meals.jain ?? 0} Jain · ${meals.vegan ?? 0} vegan · ${meals.vegetarian ?? 0} vegetarian`,
    });
  }
  return facts;
}

export function enquiryDecision(input: {
  status: string;
  quotes: Array<{ status: string; totalPrice: bigint }>;
  itemNames: string[];
  accepted: boolean;
  depositPaid: boolean;
}): string {
  if (input.depositPaid) {
    const price = input.quotes[0] ? formatInr(input.quotes[0].totalPrice) : null;
    return price ? `Deposit paid · ${price}` : 'Deposit paid';
  }
  if (input.accepted) {
    const price = input.quotes.find((q) => q.status === 'accepted') ?? input.quotes[0];
    return price ? `Accepted · ${formatInr(price.totalPrice)}` : 'Accepted, awaiting deposit';
  }
  if (input.status === 'escalated') return 'Stopped — no safe package';
  if (input.status === 'needs_clarification') return 'Asked for missing details';
  if (input.status === 'planning') return 'Still pricing';
  if (input.status === 'retryable_error') return 'Seller model failed — they can retry';
  if (input.status === 'closed') return 'Closed';

  const live = input.quotes.filter((q) => q.status === 'offered' || q.status === 'accepted');
  if (live.length === 0) return 'No package yet';

  const hall = input.itemNames.find((name) => /hall/i.test(name));
  const extras = input.itemNames.filter((name) => name !== hall).slice(0, 2);
  const packageLine = [hall, extras.join(', ')].filter(Boolean).join(' · ');
  const cheapest = live.reduce((a, b) => (a.totalPrice <= b.totalPrice ? a : b));
  const from = formatInr(cheapest.totalPrice);
  if (live.length === 1)
    return packageLine ? `Quoted ${packageLine} · ${from}` : `Quoted · ${from}`;
  return packageLine
    ? `Quoted ${live.length} options · ${packageLine} · from ${from}`
    : `Quoted ${live.length} options · from ${from}`;
}

export function enquiryHeadline(raw: string, requirements: unknown): string {
  if (requirements && typeof requirements === 'object') {
    const req = requirements as Record<string, unknown>;
    const event = typeof req.event_type === 'string' ? req.event_type.replaceAll('_', ' ') : null;
    const guests = typeof req.attendee_count === 'number' ? `${req.attendee_count} guests` : null;
    const date = typeof req.requested_date === 'string' ? req.requested_date : null;
    const parts = [event, guests, date].filter(Boolean);
    if (parts.length >= 2) return parts.join(' · ');
  }
  const line = raw.trim().split('\n')[0] ?? 'Enquiry';
  return line.length > 90 ? `${line.slice(0, 87)}…` : line || 'Enquiry';
}
