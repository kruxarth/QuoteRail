export const IST_TIME_ZONE = 'Asia/Kolkata';
export const IST_OFFSET = '+05:30';

export const SLOT_WINDOWS = {
  morning: { start: '08:00', end: '14:00' },
  afternoon: { start: '14:30', end: '20:30' },
  evening: { start: '17:00', end: '23:00' },
} as const;

export type SlotWindow = keyof typeof SLOT_WINDOWS;

export const SETUP_BUFFER_HOURS = 2;
export const OFFER_VALIDITY_MINUTES = 60;
export const PAYMENT_WINDOW_HOURS = 24;
export const MIN_BOOKING_LEAD_HOURS = 48;
export const RFQ_DEADLINE_MS = 50_000;
export const MAX_MODEL_CALLS = 3;
export const MAX_PLANNING_CALLS = 2;
export const MAX_REQUEST_CHARS = 4_000;
export const MAX_PAYMENT_FAILURES = 2;

export const BPS_PER_UNIT = 10_000n;
export const DEPOSIT_BPS = 4_000n;
export const MARGIN_FLOOR_BPS = 2_500n;
export const DISCOUNT_AUTO_MAX_BPS = 500n;
export const DISCOUNT_HARD_MAX_BPS = 1_000n;
export const AUTO_APPROVAL_CEILING_PAISE = 26_000_000n;
export const ABSOLUTE_CEILING_PAISE = 35_000_000n;

export const POLICY_VERSION = 'venue-policy.v1';
export const EXTRACTION_PROMPT_VERSION = 'extraction.v1';
export const PLANNER_PROMPT_VERSION = 'planner.v3';
export const SELLER_MODEL = 'gpt-5.6-luna';
export const OPENCODE_GO_BASE_URL = 'https://opencode.ai/zen/go/v1';

export const MERCHANT_SLUG = 'mosaic-events';
export const MERCHANT_NAME = 'Mosaic Events Bengaluru';
export const MERCHANT_CITY = 'Bengaluru';
export const CURRENCY = 'INR';

export const HALL_MULTIPLIER_BPS = {
  weekday: 10_000n,
  fridayDay: 11_000n,
  fridayEvening: 12_500n,
  weekend: 13_500n,
} as const;

export const MANDATORY_OPERATIONS_CODE = 'EVENT-OPS';

export const FROZEN_TEST_NOW = '2026-09-07T10:00:00+05:30';
export const FROZEN_DEMO_THURSDAY = '2026-09-10';
export const FROZEN_DEMO_FRIDAY = '2026-09-11';

export const LOCKED_DEMO_BUDGET_PAISE = 22_000_000n;

export const AUDIT_EVENTS = [
  'rfq.received',
  'rfq.requirements_extracted',
  'rfq.clarification_required',
  'rfq.clarification_answered',
  'rfq.retryable_error',
  'agent.candidates_proposed',
  'agent.candidates_revised',
  'agent.escalated',
  'agent.provider_unavailable',
  'agent.deadline_exceeded',
  'policy.evaluated',
  'quote.offered',
  'quote.revision_requested',
  'quote.revision_rejected',
  'security.buyer_instruction_detected',
  'approval.requested',
  'approval.approved',
  'approval.rejected',
  'quote.accepted',
  'quote.siblings_superseded',
  'resource.reserved',
  'resource.reservation_committed',
  'resource.reservation_released',
  'resource.reservation_expired',
  'resource.conflict_blocked',
  'checkout.requested',
  'checkout.link_created',
  'checkout.idempotent_reuse',
  'payment.attempt_failed',
  'payment.retry_allowed',
  'payment.retry_stopped',
  'payment.paid',
  'webhook.invalid_signature',
  'webhook.duplicate_ignored',
  'webhook.out_of_order_ignored',
  'system.integration_error',
] as const;

export type AuditEventType = (typeof AUDIT_EVENTS)[number];
