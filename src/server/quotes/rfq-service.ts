import { and, desc, eq, inArray } from 'drizzle-orm';
import { db, type Database } from '@/db/client';
import {
  offerings,
  policyEvaluations,
  quoteItems,
  quotes,
  rfqMessages,
  rfqs,
} from '@/db/schema';
import { createId } from '@/shared/ids';
import {
  EXTRACTION_PROMPT_VERSION,
  MAX_PLANNING_CALLS,
  MAX_REQUEST_CHARS,
  MANDATORY_OPERATIONS_CODE,
  OFFER_VALIDITY_MINUTES,
  PLANNER_PROMPT_VERSION,
  POLICY_VERSION,
  RFQ_DEADLINE_MS,
  SELLER_MODEL,
  SETUP_BUFFER_HOURS,
} from '@/shared/constants';
import { addMinutes, bufferedRange, resolveTimePreference, slotRange, type Clock } from '@/shared/clock';
import { DomainError } from '@/shared/result';
import { looksLikeInjection, sanitizeRequestText } from '@/server/audit/redact';
import { appendAudit } from '@/server/audit/service';
import { createModelAdapter } from '@/server/planner/adapter';
import type { ModelAdapter } from '@/server/planner/types';
import type { CandidatePlan, ExtractedRequirements } from '@/shared/schemas';
import { extractedRequirementsSchema } from '@/shared/schemas';
import { priceCandidate, type PricingOffering } from '@/server/pricing/engine';
import { evaluatePolicy, policySnapshotHash, type AvailabilityEvidence } from '@/server/policy/engine';
import { evidenceForOffering, expireStaleReservations } from '@/server/availability/capacity';
import { assertRfqTransition, canContinueRfq } from '@/server/policy/transitions';
import { formatInr } from '@/shared/money';
import { MERCHANT_ID } from '@/server/catalog/seed';
import { logEvent } from '@/server/log';

export type QuotePublicOption = {
  quote_id: string;
  name: string;
  status: string;
  hall: string;
  event_starts_at: string;
  event_ends_at: string;
  attendee_count: number;
  line_items: Array<{ code: string; name: string; quantity: number; line_price: string }>;
  total_price: string;
  deposit_amount: string;
  currency: string;
  expires_at: string;
  rationale: string;
  assumptions: string[];
  tradeoffs: Array<{ constraint: string; reason: string }>;
  requires_approval: boolean;
};

function remainingMs(deadline: number): number {
  return Math.max(0, deadline - Date.now());
}

function providerErrorDetail(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message.slice(0, 400);
  return 'unknown provider error';
}

async function loadOfferings(database: Database): Promise<PricingOffering[]> {
  const rows = await database.select().from(offerings).where(eq(offerings.active, true));
  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    category: row.category,
    pricingModel: row.pricingModel,
    salePriceSubunits: row.salePriceSubunits,
    costSubunits: row.costSubunits,
    capacityUnits: row.capacityUnits,
    capabilities: row.capabilities ?? [],
    active: row.active,
  }));
}

async function availabilityForCandidate(
  database: Database,
  candidate: CandidatePlan,
  offeringsByCode: Map<string, PricingOffering>,
  window: ReturnType<typeof resolveTimePreference>,
): Promise<AvailabilityEvidence[]> {
  const evidence: AvailabilityEvidence[] = [];
  const hall = offeringsByCode.get(candidate.hall_code);
  if (hall) {
    evidence.push(
      await evidenceForOffering({
        db: database,
        offeringId: hall.id,
        offeringCode: hall.code,
        date: candidate.event_date,
        window,
        requestedUnits: 1,
        exclusive: true,
      }),
    );
  }
  for (const service of candidate.services) {
    const offering = offeringsByCode.get(service.code);
    if (!offering || offering.category === 'operations') continue;
    const units =
      offering.pricingModel === 'per_guest' ? candidate.attendee_count : service.quantity;
    evidence.push(
      await evidenceForOffering({
        db: database,
        offeringId: offering.id,
        offeringCode: offering.code,
        date: candidate.event_date,
        window,
        requestedUnits: units,
        exclusive: offering.category !== 'catering',
      }),
    );
  }
  return evidence;
}

function rankQuotes(
  options: Array<{ candidate: CandidatePlan; pricedTotal: bigint; margin: number }>,
  requirements: ExtractedRequirements,
) {
  const priorities = requirements.priorities ?? [];
  const score = (item: (typeof options)[number]) => {
    let value = 0;
    const codes = new Set([item.candidate.hall_code, ...item.candidate.services.map((s) => s.code)]);
    if (priorities.includes('budget') && requirements.budget_subunits) {
      if (item.pricedTotal <= BigInt(requirements.budget_subunits)) value += 8;
    }
    if (priorities.includes('date') && item.candidate.event_date === requirements.requested_date) value += 6;
    if (priorities.includes('headcount') && item.candidate.attendee_count === requirements.attendee_count) {
      value += 5;
    }
    if (priorities.includes('service_level') && codes.has('AV-PRO') && codes.has('DINNER-PREMIUM')) value += 4;
    if (priorities.includes('parking') && codes.has('VALET-CREW')) value += 2;
    return value;
  };
  return options.sort((a, b) => {
    const s = score(b) - score(a);
    if (s !== 0) return s;
    if (a.pricedTotal !== b.pricedTotal) return a.pricedTotal < b.pricedTotal ? -1 : 1;
    return b.margin - a.margin;
  });
}

async function persistQuotes(params: {
  database: Database;
  rfqId: string;
  traceId: string;
  now: Date;
  valid: Array<{
    candidate: CandidatePlan;
    priced: ReturnType<typeof priceCandidate>;
    policy: ReturnType<typeof evaluatePolicy>;
    window: ReturnType<typeof resolveTimePreference>;
    evidence: AvailabilityEvidence[];
  }>;
  requirements: ExtractedRequirements;
}) {
  const ranked = rankQuotes(
    params.valid.map((item) => ({
      candidate: item.candidate,
      pricedTotal: item.priced.totalPrice,
      margin: item.priced.grossMarginBps,
    })),
    params.requirements,
  );
  const ordered = ranked.map((row) => params.valid.find((item) => item.candidate === row.candidate)!).slice(0, 3);
  const created: QuotePublicOption[] = [];
  for (const item of ordered) {
    const range = slotRange(item.candidate.event_date, item.window);
    const status = item.policy.requiresMerchantApproval ? 'pending_approval' : 'offered';
    const quoteId = createId();
    const snapshot = policySnapshotHash(item.policy.rules);
    await params.database.insert(quotes).values({
      id: quoteId,
      rfqId: params.rfqId,
      parentQuoteId: null,
      version: 1,
      status,
      currency: 'INR',
      serviceSubtotal: item.priced.serviceSubtotal,
      hallSlotAdjustment: item.priced.hallSlotAdjustment,
      additionalDiscount: item.priced.additionalDiscount,
      totalPrice: item.priced.totalPrice,
      totalCost: item.priced.totalCost,
      grossMarginBps: item.priced.grossMarginBps,
      depositBps: Number(item.priced.depositBps),
      depositAmount: item.priced.depositAmount,
      eventStartsAt: range.startsAt,
      eventEndsAt: range.endsAt,
      attendeeCount: item.candidate.attendee_count,
      expiresAt: addMinutes(params.now, OFFER_VALIDITY_MINUTES),
      rationale: item.candidate.rationale,
      tradeoffs: item.candidate.relaxed_constraints,
      assumptions: item.candidate.assumptions,
      offeringSnapshotHash: item.priced.offeringSnapshotHash,
      policySnapshotHash: snapshot,
    });
    await params.database.insert(quoteItems).values(
      item.priced.lines.map((line) => ({
        id: createId(),
        quoteId,
        offeringId: line.offeringId,
        resourceSlotId: item.evidence.find((ev) => ev.offeringCode === line.code)?.slotId ?? null,
        code: line.code,
        name: line.name,
        category: line.category,
        pricingModel: line.pricingModel,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        unitCost: line.unitCost,
        multiplierBps: Number(line.multiplierBps),
        linePrice: line.linePrice,
        lineCost: line.lineCost,
        capabilities: line.capabilities,
      })),
    );
    await params.database.insert(policyEvaluations).values({
      id: createId(),
      quoteId,
      actionType: item.policy.action,
      allowed: item.policy.allowed,
      ruleResults: item.policy.rules,
      summary: item.policy.summary,
      policyVersion: POLICY_VERSION,
      traceId: params.traceId,
    });
    await appendAudit(params.database, {
      traceId: params.traceId,
      actorType: 'policy',
      eventType: 'policy.evaluated',
      entityType: 'quote',
      entityId: quoteId,
      summary: item.policy.summary,
      ruleIds: item.policy.rules.map((rule) => rule.id),
      output: item.policy.rules.map((rule) => ({ id: rule.id, passed: rule.passed })),
    });
    if (status === 'offered') {
      await appendAudit(params.database, {
        traceId: params.traceId,
        actorType: 'system',
        eventType: 'quote.offered',
        entityType: 'quote',
        entityId: quoteId,
        summary: `Offered ${item.candidate.name} at ${formatInr(item.priced.totalPrice)}`,
      });
    } else {
      await params.database.insert(policyEvaluations).values({
        id: createId(),
        quoteId,
        actionType: 'offer_quote',
        allowed: true,
        ruleResults: item.policy.rules,
        summary: 'Pending merchant approval',
        policyVersion: POLICY_VERSION,
        traceId: params.traceId,
      });
    }
    created.push({
      quote_id: quoteId,
      name: item.candidate.name,
      status,
      hall: item.candidate.hall_code,
      event_starts_at: range.startsAt.toISOString(),
      event_ends_at: range.endsAt.toISOString(),
      attendee_count: item.candidate.attendee_count,
      line_items: item.priced.lines.map((line) => ({
        code: line.code,
        name: line.name,
        quantity: line.quantity,
        line_price: line.linePrice.toString(),
      })),
      total_price: item.priced.totalPrice.toString(),
      deposit_amount: item.priced.depositAmount.toString(),
      currency: 'INR',
      expires_at: addMinutes(params.now, OFFER_VALIDITY_MINUTES).toISOString(),
      rationale: item.candidate.rationale,
      assumptions: item.candidate.assumptions,
      tradeoffs: item.candidate.relaxed_constraints,
      requires_approval: item.policy.requiresMerchantApproval,
    });
  }
  return created;
}

async function validateCandidates(params: {
  database: Database;
  candidates: CandidatePlan[];
  offerings: PricingOffering[];
  requirements: ExtractedRequirements;
  now: Date;
}) {
  const byCode = new Map(params.offerings.map((item) => [item.code, item]));
  const valid = [];
  const failures: string[] = [];
  for (const candidate of params.candidates) {
    if (!candidate.services.some((s) => s.code === MANDATORY_OPERATIONS_CODE)) {
      candidate.services.push({ code: MANDATORY_OPERATIONS_CODE, quantity: 1 });
    }
    const window = resolveTimePreference(candidate.start_time, 'exact');
    const range = slotRange(candidate.event_date, window);
    const buffered = bufferedRange(range.startsAt, range.endsAt, SETUP_BUFFER_HOURS);
    let priced;
    try {
      priced = priceCandidate(candidate, params.offerings, range.startsAt, window);
    } catch (error) {
      failures.push(`${candidate.name}: ${error instanceof Error ? error.message : 'pricing failed'}`);
      continue;
    }
    const evidence = await availabilityForCandidate(params.database, candidate, byCode, window);
    const policy = evaluatePolicy({
      action: 'offer_quote',
      now: params.now,
      requirements: params.requirements,
      candidate,
      priced,
      offerings: params.offerings,
      availability: evidence,
      eventStartsAt: range.startsAt,
      bufferStartsAt: buffered.bufferStartsAt,
    });
    if (!policy.allowed) {
      const failed = policy.rules.filter((r) => !r.passed).map((r) => r.id);
      failures.push(`${candidate.name}: ${policy.summary} [${failed.join(',')}]`);
      continue;
    }
    valid.push({ candidate, priced, policy, window, evidence });
  }
  return { valid, failures };
}

export async function runPlanner(params: {
  database?: Database;
  rfqId: string;
  buyerSubject: string;
  clock: Clock;
  adapter?: ModelAdapter;
  history?: string[];
  revisionText?: string;
}): Promise<{
  rfq_id: string;
  status: string;
  clarification_questions: string[];
  options: QuotePublicOption[];
  public_quote_url?: string;
  reason?: string;
}> {
  const database = params.database ?? db;
  const adapter = params.adapter ?? createModelAdapter();
  const deadline = Date.now() + RFQ_DEADLINE_MS;
  const [loaded] = await database.select().from(rfqs).where(eq(rfqs.id, params.rfqId)).limit(1);
  if (!loaded) throw new DomainError('not_found', 'RFQ not found', 404);
  const now = params.clock.now();
  await expireStaleReservations(database, now);

  let rfq = loaded;
  if (rfq.status !== 'planning') {
    assertRfqTransition(rfq.status, 'planning');
    await database.update(rfqs).set({ status: 'planning', updatedAt: now }).where(eq(rfqs.id, rfq.id));
    rfq = { ...rfq, status: 'planning' };
  }

  const signal = AbortSignal.timeout(remainingMs(deadline));
  let requirements: ExtractedRequirements;
  try {
    const extracted = await adapter.extract({
      request: params.revisionText ? `${rfq.rawRequest}\n${params.revisionText}` : rfq.rawRequest,
      clock: params.clock,
      history: params.history,
      signal,
    });
    requirements = extractedRequirementsSchema.parse(extracted);
  } catch (error) {
    const deadlineHit = Date.now() >= deadline || (error instanceof Error && error.name === 'TimeoutError');
    const detail = providerErrorDetail(error);
    logEvent(deadlineHit ? 'rfq.extract_deadline' : 'rfq.extract_failed', {
      rfq_id: rfq.id,
      message: detail,
    });
    assertRfqTransition(rfq.status, 'retryable_error');
    await database.update(rfqs).set({ status: 'retryable_error', updatedAt: now }).where(eq(rfqs.id, rfq.id));
    await appendAudit(database, {
      traceId: rfq.traceId,
      actorType: 'system',
      eventType: deadlineHit ? 'agent.deadline_exceeded' : 'agent.provider_unavailable',
      entityType: 'rfq',
      entityId: rfq.id,
      summary: deadlineHit
        ? 'RFQ processing hit the 50-second deadline during extraction'
        : 'Model provider failed during extraction',
      reason: detail,
    });
    return {
      rfq_id: rfq.id,
      status: 'retryable_error',
      clarification_questions: [],
      options: [],
      reason: 'Seller planner is temporarily unavailable. Retry with continue_rfq.',
    };
  }

  await database
    .update(rfqs)
    .set({
      parsedRequirements: requirements,
      promptVersion: `${EXTRACTION_PROMPT_VERSION}+${PLANNER_PROMPT_VERSION}`,
      modelName: SELLER_MODEL,
      updatedAt: now,
    })
    .where(eq(rfqs.id, rfq.id));
  await appendAudit(database, {
    traceId: rfq.traceId,
    actorType: 'model',
    eventType: 'rfq.requirements_extracted',
    entityType: 'rfq',
    entityId: rfq.id,
    summary: 'Requirements extracted',
    output: {
      attendee_count: requirements.attendee_count,
      budget_subunits: requirements.budget_subunits,
      requested_date: requirements.requested_date,
    },
  });

  if (requirements.missing_required_fields.length > 0) {
    if (rfq.status !== 'needs_clarification') assertRfqTransition(rfq.status, 'needs_clarification');
    await database
      .update(rfqs)
      .set({
        status: 'needs_clarification',
        clarificationQuestions: requirements.clarification_questions,
        updatedAt: now,
      })
      .where(eq(rfqs.id, rfq.id));
    await appendAudit(database, {
      traceId: rfq.traceId,
      actorType: 'system',
      eventType: 'rfq.clarification_required',
      entityType: 'rfq',
      entityId: rfq.id,
      summary: 'Clarification required before planning',
      output: requirements.clarification_questions,
    });
    return {
      rfq_id: rfq.id,
      status: 'needs_clarification',
      clarification_questions: requirements.clarification_questions,
      options: [],
    };
  }

  const catalog = await loadOfferings(database);
  let feedback: string | undefined;
  let valid: Awaited<ReturnType<typeof validateCandidates>>['valid'] = [];
  let planningCalls = 0;
  let lastFailures: string[] = [];
  try {
    while (planningCalls < MAX_PLANNING_CALLS && remainingMs(deadline) > 2_000) {
      planningCalls += 1;
      const planned = await adapter.plan({
        requirements,
        offerings: catalog.map((item) => ({
          code: item.code,
          name: item.name,
          category: item.category,
          capacityUnits: item.capacityUnits,
          capabilities: item.capabilities,
        })),
        availableSlots: [],
        feedback,
        clock: params.clock,
        signal,
      });
      await appendAudit(database, {
        traceId: rfq.traceId,
        actorType: 'model',
        eventType: planningCalls === 1 ? 'agent.candidates_proposed' : 'agent.candidates_revised',
        entityType: 'rfq',
        entityId: rfq.id,
        summary: `Planner returned ${planned.candidates.length} candidates`,
      });
      if (planned.cannot_proceed || planned.candidates.length === 0) {
        lastFailures = [planned.escalation_reason || 'Planner returned no candidates'];
        feedback = [
          'Do not escalate for budget, date, or service-tier tension.',
          'Propose 2-3 candidates using the required trade-offs: reduce service tier on the requested date, change date or hall to keep features, or keep the exact spec and relax budget.',
          `Previous planner response: ${lastFailures.join('; ')}`,
        ].join('\n');
        continue;
      }
      const checked = await validateCandidates({
        database,
        candidates: planned.candidates,
        offerings: catalog,
        requirements,
        now,
      });
      valid = checked.valid;
      lastFailures = checked.failures;
      if (valid.length >= 2) break;
      feedback = `Validation failures:\n${checked.failures.join('\n')}`;
    }
  } catch (error) {
    const deadlineHit = Date.now() >= deadline || (error instanceof Error && /timeout|abort/i.test(error.message));
    const detail = providerErrorDetail(error);
    logEvent(deadlineHit ? 'rfq.plan_deadline' : 'rfq.plan_failed', { rfq_id: rfq.id, message: detail });
    assertRfqTransition('planning', 'retryable_error');
    await database.update(rfqs).set({ status: 'retryable_error', updatedAt: now }).where(eq(rfqs.id, rfq.id));
    await appendAudit(database, {
      traceId: rfq.traceId,
      actorType: 'system',
      eventType: deadlineHit ? 'agent.deadline_exceeded' : 'agent.provider_unavailable',
      entityType: 'rfq',
      entityId: rfq.id,
      summary: deadlineHit ? 'Deadline exceeded during planning' : 'Provider unavailable during planning',
      reason: detail,
    });
    return {
      rfq_id: rfq.id,
      status: 'retryable_error',
      clarification_questions: [],
      options: [],
      reason: 'Seller planner is temporarily unavailable. Retry with continue_rfq.',
    };
  }
  void signal;

  if (valid.length === 0) {
    assertRfqTransition('planning', 'escalated');
    await database.update(rfqs).set({ status: 'escalated', updatedAt: now }).where(eq(rfqs.id, rfq.id));
    await appendAudit(database, {
      traceId: rfq.traceId,
      actorType: 'system',
      eventType: 'agent.escalated',
      entityType: 'rfq',
      entityId: rfq.id,
      summary: lastFailures.join('; ') || 'No safe feasible option',
    });
    return {
      rfq_id: rfq.id,
      status: 'escalated',
      clarification_questions: [],
      options: [],
      reason: lastFailures.join('; ') || 'No safe feasible option after bounded planning',
    };
  }

  const options = await persistQuotes({
    database,
    rfqId: rfq.id,
    traceId: rfq.traceId,
    now,
    valid,
    requirements,
  });
  assertRfqTransition('planning', 'quoted');
  await database.update(rfqs).set({ status: 'quoted', updatedAt: now }).where(eq(rfqs.id, rfq.id));
  return {
    rfq_id: rfq.id,
    status: 'quoted',
    clarification_questions: [],
    options,
    public_quote_url: options[0] ? `/quote/${options[0].quote_id}` : undefined,
  };
}

export async function requestQuote(params: {
  database?: Database;
  buyerSubject: string;
  request: string;
  clock: Clock;
  adapter?: ModelAdapter;
}) {
  const database = params.database ?? db;
  if (params.request.length > MAX_REQUEST_CHARS) {
    throw new DomainError('input_too_large', 'Request exceeds 4000 characters', 400);
  }
  const rfqId = createId();
  const traceId = createId();
  await database.insert(rfqs).values({
    id: rfqId,
    merchantId: MERCHANT_ID,
    buyerSubject: params.buyerSubject,
    rawRequest: params.request,
    sanitizedRequest: sanitizeRequestText(params.request),
    status: 'received',
    clarificationQuestions: [],
    promptVersion: EXTRACTION_PROMPT_VERSION,
    modelName: SELLER_MODEL,
    traceId,
  });
  await database.insert(rfqMessages).values({
    id: createId(),
    rfqId,
    buyerSubject: params.buyerSubject,
    role: 'buyer',
    kind: 'initial_request',
    content: params.request,
  });
  await appendAudit(database, {
    traceId,
    actorType: 'buyer',
    actorId: params.buyerSubject,
    eventType: 'rfq.received',
    entityType: 'rfq',
    entityId: rfqId,
    summary: 'RFQ received',
    input: { request: sanitizeRequestText(params.request) },
  });
  if (looksLikeInjection(params.request)) {
    await appendAudit(database, {
      traceId,
      actorType: 'system',
      actorId: params.buyerSubject,
      eventType: 'security.buyer_instruction_detected',
      entityType: 'rfq',
      entityId: rfqId,
      summary: 'Buyer text contains instruction-like content; treated as data',
    });
  }
  return runPlanner({
    database,
    rfqId,
    buyerSubject: params.buyerSubject,
    clock: params.clock,
    adapter: params.adapter,
  });
}

export async function continueRfq(params: {
  database?: Database;
  buyerSubject: string;
  rfqId: string;
  answers: string;
  clock: Clock;
  adapter?: ModelAdapter;
}) {
  const database = params.database ?? db;
  const [rfq] = await database.select().from(rfqs).where(eq(rfqs.id, params.rfqId)).limit(1);
  if (!rfq || rfq.buyerSubject !== params.buyerSubject) {
    throw new DomainError('not_found', 'RFQ not found', 404);
  }
  if (!canContinueRfq(rfq.status)) {
    throw new DomainError('illegal_transition', `Cannot continue RFQ in status ${rfq.status}`, 409);
  }
  if (rfq.status === 'needs_clarification' && !params.answers.trim()) {
    throw new DomainError('invalid_input', 'Clarification answers are required', 400);
  }
  if (params.answers.length > MAX_REQUEST_CHARS) {
    throw new DomainError('input_too_large', 'Answers exceed 4000 characters', 400);
  }
  if (params.answers.trim()) {
    await database.insert(rfqMessages).values({
      id: createId(),
      rfqId: rfq.id,
      buyerSubject: params.buyerSubject,
      role: 'buyer',
      kind: 'clarification_answer',
      content: params.answers,
    });
    await appendAudit(database, {
      traceId: rfq.traceId,
      actorType: 'buyer',
      actorId: params.buyerSubject,
      eventType: 'rfq.clarification_answered',
      entityType: 'rfq',
      entityId: rfq.id,
      summary: 'Buyer answered clarification',
    });
  }
  const historyRows = await database
    .select()
    .from(rfqMessages)
    .where(eq(rfqMessages.rfqId, rfq.id))
    .orderBy(rfqMessages.createdAt);
  return runPlanner({
    database,
    rfqId: rfq.id,
    buyerSubject: params.buyerSubject,
    clock: params.clock,
    adapter: params.adapter,
    history: historyRows.map((row) => `${row.kind}: ${row.content}`),
  });
}

export async function reviseQuote(params: {
  database?: Database;
  buyerSubject: string;
  quoteId: string;
  request: string;
  clock: Clock;
  adapter?: ModelAdapter;
}) {
  const database = params.database ?? db;
  const [quote] = await database.select().from(quotes).where(eq(quotes.id, params.quoteId)).limit(1);
  if (!quote) throw new DomainError('not_found', 'Quote not found', 404);
  const [rfq] = await database.select().from(rfqs).where(eq(rfqs.id, quote.rfqId)).limit(1);
  if (!rfq || rfq.buyerSubject !== params.buyerSubject) {
    throw new DomainError('not_found', 'Quote not found', 404);
  }
  await database.insert(rfqMessages).values({
    id: createId(),
    rfqId: rfq.id,
    buyerSubject: params.buyerSubject,
    role: 'buyer',
    kind: 'revision_request',
    content: params.request,
  });
  await appendAudit(database, {
    traceId: rfq.traceId,
    actorType: 'buyer',
    eventType: 'quote.revision_requested',
    entityType: 'quote',
    entityId: quote.id,
    summary: 'Buyer requested a revision',
  });
  const result = await runPlanner({
    database,
    rfqId: rfq.id,
    buyerSubject: params.buyerSubject,
    clock: params.clock,
    adapter: params.adapter,
    revisionText: params.request,
    history: [`prior_quote:${quote.id}`],
  });
  if (result.status === 'quoted' && result.options.length > 0) {
    const newIds = new Set(result.options.map((o) => o.quote_id));
    const siblings = await database.select().from(quotes).where(eq(quotes.rfqId, rfq.id));
    for (const sibling of siblings) {
      if (!newIds.has(sibling.id) && (sibling.status === 'offered' || sibling.status === 'pending_approval')) {
        await database
          .update(quotes)
          .set({ status: 'superseded', updatedAt: params.clock.now() })
          .where(eq(quotes.id, sibling.id));
      }
    }
  } else if (result.status === 'escalated') {
    await appendAudit(database, {
      traceId: rfq.traceId,
      actorType: 'policy',
      eventType: 'quote.revision_rejected',
      entityType: 'quote',
      entityId: quote.id,
      summary: result.reason ?? 'Revision rejected',
    });
  }
  return result;
}

export async function getRfqPublic(params: {
  database?: Database;
  buyerSubject: string;
  rfqId: string;
}) {
  const database = params.database ?? db;
  const [rfq] = await database.select().from(rfqs).where(eq(rfqs.id, params.rfqId)).limit(1);
  if (!rfq || rfq.buyerSubject !== params.buyerSubject) {
    throw new DomainError('not_found', 'RFQ not found', 404);
  }
  const offered = await database
    .select()
    .from(quotes)
    .where(and(eq(quotes.rfqId, rfq.id), inArray(quotes.status, ['offered', 'pending_approval', 'accepted'])))
    .orderBy(desc(quotes.createdAt));
  return {
    rfq_id: rfq.id,
    status: rfq.status,
    requirements: rfq.parsedRequirements,
    clarification_questions: rfq.clarificationQuestions ?? [],
    options: offered.map((quote) => ({
      quote_id: quote.id,
      status: quote.status,
      hall: undefined,
      event_starts_at: quote.eventStartsAt.toISOString(),
      event_ends_at: quote.eventEndsAt.toISOString(),
      attendee_count: quote.attendeeCount,
      total_price: quote.totalPrice.toString(),
      deposit_amount: quote.depositAmount.toString(),
      currency: quote.currency,
      expires_at: quote.expiresAt.toISOString(),
      rationale: quote.rationale,
      tradeoffs: quote.tradeoffs,
      assumptions: quote.assumptions,
    })),
  };
}
