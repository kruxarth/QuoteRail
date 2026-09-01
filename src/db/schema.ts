import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
};

export const offeringCategoryEnum = pgEnum('offering_category', [
  'hall',
  'av',
  'catering',
  'parking',
  'staging',
  'operations',
]);
export const pricingModelEnum = pgEnum('pricing_model', ['hall_slot', 'fixed', 'per_guest']);
export const rfqStatusEnum = pgEnum('rfq_status', [
  'received',
  'needs_clarification',
  'planning',
  'retryable_error',
  'quoted',
  'escalated',
  'closed',
]);
export const rfqMessageRoleEnum = pgEnum('rfq_message_role', ['buyer', 'agent']);
export const rfqMessageKindEnum = pgEnum('rfq_message_kind', [
  'initial_request',
  'clarification_answer',
  'clarification_question',
  'revision_request',
]);
export const quoteStatusEnum = pgEnum('quote_status', [
  'draft',
  'policy_rejected',
  'pending_approval',
  'offered',
  'accepted',
  'expired',
  'superseded',
  'cancelled',
]);
export const reservationStatusEnum = pgEnum('reservation_status', [
  'active',
  'committed',
  'released',
  'expired',
]);
export const approvalStatusEnum = pgEnum('approval_status', [
  'pending',
  'approved',
  'rejected',
  'expired',
]);
export const paymentTermEnum = pgEnum('payment_term', ['deposit', 'full']);
export const paymentLinkStatusEnum = pgEnum('payment_link_status', [
  'creating',
  'issued',
  'paid',
  'cancelled',
  'expired',
  'stopped',
  'error',
]);
export const webhookStatusEnum = pgEnum('webhook_status', [
  'received',
  'processed',
  'duplicate',
  'ignored',
  'failed',
]);
export const actorTypeEnum = pgEnum('actor_type', [
  'buyer',
  'merchant',
  'model',
  'policy',
  'system',
  'razorpay',
]);

export const merchants = pgTable('merchants', {
  id: uuid('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  currency: text('currency').notNull(),
  active: boolean('active').notNull().default(true),
  ...timestamps,
});

export const offerings = pgTable(
  'offerings',
  {
    id: uuid('id').primaryKey(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id),
    code: text('code').notNull(),
    name: text('name').notNull(),
    description: text('description').notNull(),
    category: offeringCategoryEnum('category').notNull(),
    pricingModel: pricingModelEnum('pricing_model').notNull(),
    salePriceSubunits: bigint('sale_price_subunits', { mode: 'bigint' }).notNull(),
    costSubunits: bigint('cost_subunits', { mode: 'bigint' }).notNull(),
    capacityUnits: integer('capacity_units'),
    capacityLabel: text('capacity_label'),
    capabilities: jsonb('capabilities').$type<string[]>().notNull().default([]),
    active: boolean('active').notNull().default(true),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('offerings_merchant_code_idx').on(t.merchantId, t.code),
    index('offerings_category_idx').on(t.merchantId, t.category),
  ],
);

export const resourceSlots = pgTable(
  'resource_slots',
  {
    id: uuid('id').primaryKey(),
    offeringId: uuid('offering_id')
      .notNull()
      .references(() => offerings.id),
    startsAt: timestamp('starts_at', { withTimezone: true, mode: 'date' }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true, mode: 'date' }).notNull(),
    bufferStartsAt: timestamp('buffer_starts_at', { withTimezone: true, mode: 'date' }).notNull(),
    bufferEndsAt: timestamp('buffer_ends_at', { withTimezone: true, mode: 'date' }).notNull(),
    capacityTotal: integer('capacity_total').notNull(),
    blockedUnits: integer('blocked_units').notNull().default(0),
    blockReason: text('block_reason'),
    active: boolean('active').notNull().default(true),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('resource_slots_offering_range_idx').on(t.offeringId, t.startsAt, t.endsAt),
    index('resource_slots_time_idx').on(t.offeringId, t.startsAt, t.endsAt),
  ],
);

export const rfqs = pgTable(
  'rfqs',
  {
    id: uuid('id').primaryKey(),
    merchantId: uuid('merchant_id')
      .notNull()
      .references(() => merchants.id),
    buyerSubject: text('buyer_subject').notNull(),
    rawRequest: text('raw_request').notNull(),
    sanitizedRequest: text('sanitized_request').notNull(),
    parsedRequirements: jsonb('parsed_requirements').$type<Record<string, unknown>>(),
    status: rfqStatusEnum('status').notNull(),
    clarificationQuestions: jsonb('clarification_questions').$type<string[]>().default([]),
    promptVersion: text('prompt_version'),
    modelName: text('model_name'),
    traceId: uuid('trace_id').notNull(),
    ...timestamps,
  },
  (t) => [
    index('rfqs_created_at_idx').on(t.createdAt),
    index('rfqs_status_idx').on(t.status),
    index('rfqs_trace_id_idx').on(t.traceId),
  ],
);

export const rfqMessages = pgTable(
  'rfq_messages',
  {
    id: uuid('id').primaryKey(),
    rfqId: uuid('rfq_id')
      .notNull()
      .references(() => rfqs.id),
    buyerSubject: text('buyer_subject').notNull(),
    role: rfqMessageRoleEnum('role').notNull(),
    kind: rfqMessageKindEnum('kind').notNull(),
    content: text('content').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [index('rfq_messages_rfq_created_idx').on(t.rfqId, t.createdAt)],
);

export const quotes = pgTable(
  'quotes',
  {
    id: uuid('id').primaryKey(),
    rfqId: uuid('rfq_id')
      .notNull()
      .references(() => rfqs.id),
    parentQuoteId: uuid('parent_quote_id'),
    version: integer('version').notNull().default(1),
    status: quoteStatusEnum('status').notNull(),
    currency: text('currency').notNull(),
    serviceSubtotal: bigint('service_subtotal', { mode: 'bigint' }).notNull(),
    hallSlotAdjustment: bigint('hall_slot_adjustment', { mode: 'bigint' }).notNull(),
    additionalDiscount: bigint('additional_discount', { mode: 'bigint' }).notNull(),
    totalPrice: bigint('total_price', { mode: 'bigint' }).notNull(),
    totalCost: bigint('total_cost', { mode: 'bigint' }).notNull(),
    grossMarginBps: integer('gross_margin_bps').notNull(),
    depositBps: integer('deposit_bps').notNull(),
    depositAmount: bigint('deposit_amount', { mode: 'bigint' }).notNull(),
    eventStartsAt: timestamp('event_starts_at', { withTimezone: true, mode: 'date' }).notNull(),
    eventEndsAt: timestamp('event_ends_at', { withTimezone: true, mode: 'date' }).notNull(),
    attendeeCount: integer('attendee_count').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    rationale: text('rationale').notNull(),
    tradeoffs: jsonb('tradeoffs').$type<Array<{ constraint: string; reason: string }>>().notNull(),
    assumptions: jsonb('assumptions').$type<string[]>().notNull(),
    offeringSnapshotHash: text('offering_snapshot_hash').notNull(),
    policySnapshotHash: text('policy_snapshot_hash').notNull(),
    ...timestamps,
  },
  (t) => [
    index('quotes_rfq_idx').on(t.rfqId),
    index('quotes_status_idx').on(t.status),
    index('quotes_expires_at_idx').on(t.expiresAt),
  ],
);

export const quoteItems = pgTable('quote_items', {
  id: uuid('id').primaryKey(),
  quoteId: uuid('quote_id')
    .notNull()
    .references(() => quotes.id),
  offeringId: uuid('offering_id')
    .notNull()
    .references(() => offerings.id),
  resourceSlotId: uuid('resource_slot_id').references(() => resourceSlots.id),
  code: text('code').notNull(),
  name: text('name').notNull(),
  category: offeringCategoryEnum('category').notNull(),
  pricingModel: pricingModelEnum('pricing_model').notNull(),
  quantity: integer('quantity').notNull(),
  unitPrice: bigint('unit_price', { mode: 'bigint' }).notNull(),
  unitCost: bigint('unit_cost', { mode: 'bigint' }).notNull(),
  multiplierBps: integer('multiplier_bps').notNull(),
  linePrice: bigint('line_price', { mode: 'bigint' }).notNull(),
  lineCost: bigint('line_cost', { mode: 'bigint' }).notNull(),
  capabilities: jsonb('capabilities').$type<string[]>().notNull(),
});

export const quoteAcceptances = pgTable('quote_acceptances', {
  id: uuid('id').primaryKey(),
  rfqId: uuid('rfq_id')
    .notNull()
    .unique()
    .references(() => rfqs.id),
  quoteId: uuid('quote_id')
    .notNull()
    .unique()
    .references(() => quotes.id),
  buyerName: text('buyer_name').notNull(),
  buyerEmail: text('buyer_email'),
  paymentTerm: paymentTermEnum('payment_term').notNull(),
  amountDueNow: bigint('amount_due_now', { mode: 'bigint' }).notNull(),
  paymentExpiresAt: timestamp('payment_expires_at', { withTimezone: true, mode: 'date' }).notNull(),
  acceptanceHash: text('acceptance_hash').notNull().unique(),
  acceptedAt: timestamp('accepted_at', { withTimezone: true, mode: 'date' }).notNull(),
  traceId: uuid('trace_id').notNull(),
});

export const resourceReservations = pgTable(
  'resource_reservations',
  {
    id: uuid('id').primaryKey(),
    quoteAcceptanceId: uuid('quote_acceptance_id')
      .notNull()
      .references(() => quoteAcceptances.id),
    offeringId: uuid('offering_id')
      .notNull()
      .references(() => offerings.id),
    resourceSlotId: uuid('resource_slot_id')
      .notNull()
      .references(() => resourceSlots.id),
    units: integer('units').notNull(),
    reservedStartsAt: timestamp('reserved_starts_at', { withTimezone: true, mode: 'date' }).notNull(),
    reservedEndsAt: timestamp('reserved_ends_at', { withTimezone: true, mode: 'date' }).notNull(),
    status: reservationStatusEnum('status').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    committedAt: timestamp('committed_at', { withTimezone: true, mode: 'date' }),
    releasedAt: timestamp('released_at', { withTimezone: true, mode: 'date' }),
    ...timestamps,
  },
  (t) => [
    index('reservations_offering_idx').on(t.offeringId),
    index('reservations_slot_idx').on(t.resourceSlotId),
    index('reservations_status_idx').on(t.status),
    index('reservations_range_idx').on(t.reservedStartsAt, t.reservedEndsAt),
  ],
);

export const policyEvaluations = pgTable('policy_evaluations', {
  id: uuid('id').primaryKey(),
  quoteId: uuid('quote_id').references(() => quotes.id),
  actionType: text('action_type').notNull(),
  allowed: boolean('allowed').notNull(),
  ruleResults: jsonb('rule_results').notNull(),
  summary: text('summary').notNull(),
  policyVersion: text('policy_version').notNull(),
  traceId: uuid('trace_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

export const approvals = pgTable('approvals', {
  id: uuid('id').primaryKey(),
  quoteId: uuid('quote_id')
    .notNull()
    .references(() => quotes.id),
  reason: text('reason').notNull(),
  status: approvalStatusEnum('status').notNull(),
  requestedAt: timestamp('requested_at', { withTimezone: true, mode: 'date' }).notNull(),
  decidedAt: timestamp('decided_at', { withTimezone: true, mode: 'date' }),
  decidedBy: text('decided_by'),
  decisionNote: text('decision_note'),
});

export const paymentLinks = pgTable(
  'payment_links',
  {
    id: uuid('id').primaryKey(),
    acceptanceId: uuid('acceptance_id')
      .notNull()
      .unique()
      .references(() => quoteAcceptances.id),
    provider: text('provider').notNull(),
    providerPaymentLinkId: text('provider_payment_link_id').unique(),
    providerReferenceId: text('provider_reference_id').notNull().unique(),
    shortUrl: text('short_url'),
    currency: text('currency').notNull(),
    amount: bigint('amount', { mode: 'bigint' }).notNull(),
    amountPaid: bigint('amount_paid', { mode: 'bigint' }).notNull().default(sql`0`),
    status: paymentLinkStatusEnum('status').notNull(),
    failureCount: integer('failure_count').notNull().default(0),
    lastFailureCode: text('last_failure_code'),
    errorCode: text('error_code'),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    paidAt: timestamp('paid_at', { withTimezone: true, mode: 'date' }),
    ...timestamps,
  },
  (t) => [
    index('payment_links_provider_id_idx').on(t.providerPaymentLinkId),
    index('payment_links_reference_idx').on(t.providerReferenceId),
    index('payment_links_status_idx').on(t.status),
  ],
);

export const webhookEvents = pgTable(
  'webhook_events',
  {
    id: uuid('id').primaryKey(),
    provider: text('provider').notNull(),
    bodyHash: text('body_hash').notNull().unique(),
    eventType: text('event_type').notNull(),
    signatureVerified: boolean('signature_verified').notNull(),
    payload: jsonb('payload').notNull(),
    status: webhookStatusEnum('status').notNull(),
    processingError: text('processing_error'),
    ...timestamps,
  },
  (t) => [index('webhook_events_type_idx').on(t.eventType)],
);

export const auditEvents = pgTable(
  'audit_events',
  {
    id: uuid('id').primaryKey(),
    traceId: uuid('trace_id').notNull(),
    actorType: actorTypeEnum('actor_type').notNull(),
    actorId: text('actor_id'),
    eventType: text('event_type').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    summary: text('summary').notNull(),
    reason: text('reason'),
    inputRedacted: jsonb('input_redacted'),
    outputRedacted: jsonb('output_redacted'),
    ruleIds: text('rule_ids').array().notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    index('audit_events_trace_idx').on(t.traceId),
    index('audit_events_entity_idx').on(t.entityId),
    index('audit_events_created_idx').on(t.createdAt),
  ],
);

export const authAttempts = pgTable(
  'auth_attempts',
  {
    id: uuid('id').primaryKey(),
    kind: text('kind').notNull(),
    subject: text('subject').notNull(),
    succeeded: boolean('succeeded').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [index('auth_attempts_subject_idx').on(t.kind, t.subject, t.createdAt)],
);

export const schema = {
  merchants,
  offerings,
  resourceSlots,
  rfqs,
  rfqMessages,
  quotes,
  quoteItems,
  quoteAcceptances,
  resourceReservations,
  policyEvaluations,
  approvals,
  paymentLinks,
  webhookEvents,
  auditEvents,
  authAttempts,
};
