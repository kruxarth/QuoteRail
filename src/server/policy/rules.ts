export const RULE_IDS = [
  'OFFERING_CODE_EXISTS',
  'RESOURCE_SLOT_EXISTS',
  'RESOURCE_AVAILABLE',
  'HALL_CAPACITY_SUFFICIENT',
  'TIME_BUFFER_CONFLICT_FREE',
  'MIN_BOOKING_LEAD_TIME_48H',
  'MEAL_COUNTS_BALANCED',
  'DIETARY_REQUIREMENTS_SATISFIED',
  'REQUIRED_CAPABILITIES_SATISFIED',
  'BUYER_RELAXATION_EXPLICIT',
  'PRICE_SERVER_COMPUTED',
  'MARGIN_FLOOR_25_PERCENT',
  'ADDITIONAL_DISCOUNT_MAX_10_PERCENT',
  'DISCOUNT_APPROVAL_THRESHOLD_5_PERCENT',
  'FULL_BOOKING_AUTO_LIMIT_260K',
  'FULL_BOOKING_ABSOLUTE_LIMIT_350K',
  'QUOTE_STATUS_OFFERED',
  'QUOTE_NOT_EXPIRED',
  'QUOTE_POLICY_SNAPSHOT_MATCH',
  'RESOURCE_CAPACITY_RECHECKED',
  'RESERVATION_ACTIVE',
  'ACCEPTANCE_HASH_MATCH',
  'PAYMENT_TERM_ALLOWED',
  'ONE_ACTIVE_LINK_PER_ACCEPTANCE',
  'PAYMENT_RETRY_LIMIT',
] as const;

export type RuleId = (typeof RULE_IDS)[number];

export const MERCHANT_INVARIANT_RULES: ReadonlySet<RuleId> = new Set([
  'OFFERING_CODE_EXISTS',
  'RESOURCE_SLOT_EXISTS',
  'RESOURCE_AVAILABLE',
  'HALL_CAPACITY_SUFFICIENT',
  'TIME_BUFFER_CONFLICT_FREE',
  'MIN_BOOKING_LEAD_TIME_48H',
  'MEAL_COUNTS_BALANCED',
  'DIETARY_REQUIREMENTS_SATISFIED',
  'PRICE_SERVER_COMPUTED',
  'MARGIN_FLOOR_25_PERCENT',
  'ADDITIONAL_DISCOUNT_MAX_10_PERCENT',
  'FULL_BOOKING_ABSOLUTE_LIMIT_350K',
  'QUOTE_STATUS_OFFERED',
  'QUOTE_NOT_EXPIRED',
  'QUOTE_POLICY_SNAPSHOT_MATCH',
  'RESOURCE_CAPACITY_RECHECKED',
  'RESERVATION_ACTIVE',
  'ACCEPTANCE_HASH_MATCH',
  'PAYMENT_TERM_ALLOWED',
  'ONE_ACTIVE_LINK_PER_ACCEPTANCE',
  'PAYMENT_RETRY_LIMIT',
]);

export type PolicyAction = 'offer_quote' | 'revise_quote' | 'accept_quote' | 'create_checkout';

export type PolicyRuleResult = {
  id: RuleId;
  passed: boolean;
  severity: 'info' | 'approval' | 'block';
  observed: string;
  limit: string;
  reason: string;
  buyerFacingReason?: string;
};

export type PolicyResult = {
  allowed: boolean;
  action: PolicyAction;
  summary: string;
  rules: PolicyRuleResult[];
  requiresMerchantApproval: boolean;
};

export function rule(
  id: RuleId,
  passed: boolean,
  severity: PolicyRuleResult['severity'],
  observed: string,
  limit: string,
  reason: string,
  buyerFacingReason?: string,
): PolicyRuleResult {
  return { id, passed, severity, observed, limit, reason, buyerFacingReason };
}
