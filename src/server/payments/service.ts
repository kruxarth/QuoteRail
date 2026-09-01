import { eq } from 'drizzle-orm';
import { db, type Database } from '@/db/client';
import { paymentLinks, quoteAcceptances, quotes, resourceReservations, rfqs } from '@/db/schema';
import { getEnv, fakePaymentsEnabled } from '@/env';
import { createId } from '@/shared/ids';
import { MAX_PAYMENT_FAILURES } from '@/shared/constants';
import { DomainError, isUniqueViolation } from '@/shared/result';
import { appendAudit } from '@/server/audit/service';
import { providerReferenceId } from '@/server/quotes/acceptance-hash';
import { getFakePaymentProvider } from '@/server/payments/fake';
import { RazorpayPaymentProvider } from '@/server/payments/razorpay';
import { ManualReconciliationRequired, type PaymentProvider } from '@/server/payments/types';
import { assertPaymentTransition } from '@/server/policy/transitions';
import type { Clock } from '@/shared/clock';

export function createPaymentProvider(): PaymentProvider {
  if (fakePaymentsEnabled(getEnv())) return getFakePaymentProvider();
  return new RazorpayPaymentProvider();
}

export async function createCheckout(params: {
  database?: Database;
  buyerSubject: string;
  acceptanceId: string;
  confirmed: true;
  clock: Clock;
  provider?: PaymentProvider;
}) {
  const database = params.database ?? db;
  const provider = params.provider ?? createPaymentProvider();
  const now = params.clock.now();
  const env = getEnv();

  let acceptance: typeof quoteAcceptances.$inferSelect;
  let rfq: typeof rfqs.$inferSelect;
  let quote: typeof quotes.$inferSelect;
  let inserted: typeof paymentLinks.$inferSelect;
  try {
    const locked = await database.transaction(async (tx) => {
      const [acc] = await tx
        .select()
        .from(quoteAcceptances)
        .where(eq(quoteAcceptances.id, params.acceptanceId))
        .for('update')
        .limit(1);
      if (!acc) throw new DomainError('not_found', 'Acceptance not found', 404);
      const [ownedRfq] = await tx.select().from(rfqs).where(eq(rfqs.id, acc.rfqId)).limit(1);
      if (!ownedRfq || ownedRfq.buyerSubject !== params.buyerSubject) {
        throw new DomainError('not_found', 'Acceptance not found', 404);
      }
      const [ownedQuote] = await tx.select().from(quotes).where(eq(quotes.id, acc.quoteId)).limit(1);
      if (!ownedQuote) throw new DomainError('not_found', 'Accepted quote missing', 500);
      const reservations = await tx
        .select()
        .from(resourceReservations)
        .where(eq(resourceReservations.quoteAcceptanceId, acc.id));
      const active = reservations.filter((row) => row.status === 'active' && row.expiresAt.getTime() >= now.getTime());
      if (active.length === 0) {
        throw new DomainError('reservation_inactive', 'Resource reservations are not active', 409);
      }
      const [existing] = await tx
        .select()
        .from(paymentLinks)
        .where(eq(paymentLinks.acceptanceId, acc.id))
        .limit(1);
      if (existing) {
        return { acceptance: acc, rfq: ownedRfq, quote: ownedQuote, inserted: existing, reused: true as const };
      }
      const referenceId = providerReferenceId(acc.id);
      const [created] = await tx
        .insert(paymentLinks)
        .values({
          id: createId(),
          acceptanceId: acc.id,
          provider: 'razorpay',
          providerReferenceId: referenceId,
          currency: ownedQuote.currency,
          amount: acc.amountDueNow,
          status: 'creating',
          expiresAt: acc.paymentExpiresAt,
        })
        .returning();
      return { acceptance: acc, rfq: ownedRfq, quote: ownedQuote, inserted: created, reused: false as const };
    });
    acceptance = locked.acceptance;
    rfq = locked.rfq;
    quote = locked.quote;
    inserted = locked.inserted;
    if (locked.reused) {
      if (inserted.status === 'creating' || inserted.status === 'issued') {
        await appendAudit(database, {
          traceId: rfq.traceId,
          actorType: 'system',
          eventType: 'checkout.idempotent_reuse',
          entityType: 'payment_link',
          entityId: inserted.id,
          summary: 'Returned existing Payment Link',
        });
      }
      return publicLink(inserted, acceptance.paymentTerm);
    }
  } catch (error) {
    if (error instanceof DomainError) throw error;
    if (isUniqueViolation(error)) {
      const [existing] = await database
        .select()
        .from(paymentLinks)
        .where(eq(paymentLinks.acceptanceId, params.acceptanceId))
        .limit(1);
      const [acc] = await database
        .select()
        .from(quoteAcceptances)
        .where(eq(quoteAcceptances.id, params.acceptanceId))
        .limit(1);
      if (existing && acc) return publicLink(existing, acc.paymentTerm);
    }
    throw error;
  }

  const referenceId = inserted.providerReferenceId;

  await appendAudit(database, {
    traceId: rfq.traceId,
    actorType: 'buyer',
    eventType: 'checkout.requested',
    entityType: 'payment_link',
    entityId: inserted.id,
    summary: 'Checkout requested from accepted quote',
  });

  try {
    const created = await provider.createLink({
      amount: acceptance.amountDueNow,
      currency: 'INR',
      referenceId,
      description: `${acceptance.paymentTerm} for quote ${quote.id.slice(0, 8)}`,
      expireBy: acceptance.paymentExpiresAt,
      callbackUrl: `${env.APP_BASE_URL}/quote/${quote.id}`,
    });
    await database
      .update(paymentLinks)
      .set({
        providerPaymentLinkId: created.id,
        shortUrl: created.shortUrl,
        status: 'issued',
        updatedAt: now,
      })
      .where(eq(paymentLinks.id, inserted.id));
    await appendAudit(database, {
      traceId: rfq.traceId,
      actorType: 'system',
      eventType: 'checkout.link_created',
      entityType: 'payment_link',
      entityId: inserted.id,
      summary: 'Razorpay Payment Link issued',
      output: { provider_payment_link_id: created.id, reference_id: referenceId },
    });
    return publicLink(
      { ...inserted, providerPaymentLinkId: created.id, shortUrl: created.shortUrl, status: 'issued' },
      acceptance.paymentTerm,
    );
  } catch (error) {
    try {
      const recovered = await provider.findByReferenceId(referenceId);
      if (recovered) {
        await database
          .update(paymentLinks)
          .set({
            providerPaymentLinkId: recovered.id,
            shortUrl: recovered.shortUrl,
            status: 'issued',
            updatedAt: now,
          })
          .where(eq(paymentLinks.id, inserted.id));
        return publicLink(
          { ...inserted, providerPaymentLinkId: recovered.id, shortUrl: recovered.shortUrl, status: 'issued' },
          acceptance.paymentTerm,
        );
      }
    } catch (lookupError) {
      const manual = lookupError instanceof ManualReconciliationRequired;
      await database
        .update(paymentLinks)
        .set({
          status: 'error',
          errorCode: manual ? 'manual_reconciliation_required' : 'create_failed',
          updatedAt: now,
        })
        .where(eq(paymentLinks.id, inserted.id));
      await appendAudit(database, {
        traceId: rfq.traceId,
        actorType: 'system',
        eventType: 'system.integration_error',
        entityType: 'payment_link',
        entityId: inserted.id,
        summary: manual
          ? 'Payment link creation is uncertain; manual reconciliation required'
          : error instanceof Error
            ? error.message
            : 'Payment link creation failed',
      });
      throw new DomainError(
        manual ? 'manual_reconciliation_required' : 'checkout_failed',
        'Checkout could not be created safely',
        503,
      );
    }
    await database
      .update(paymentLinks)
      .set({ status: 'error', errorCode: 'create_failed', updatedAt: now })
      .where(eq(paymentLinks.id, inserted.id));
    throw new DomainError('checkout_failed', 'Checkout provider failed', 503);
  }
}

export async function recordPaymentFailure(params: {
  database?: Database;
  paymentLinkId: string;
  failureCode?: string;
  clock: Clock;
}) {
  const database = params.database ?? db;
  const now = params.clock.now();
  const [link] = await database.select().from(paymentLinks).where(eq(paymentLinks.id, params.paymentLinkId)).limit(1);
  if (!link) return;
  const nextCount = link.failureCount + 1;
  const [acceptance] = await database
    .select()
    .from(quoteAcceptances)
    .where(eq(quoteAcceptances.id, link.acceptanceId))
    .limit(1);
  if (nextCount > MAX_PAYMENT_FAILURES) {
    assertPaymentTransition(link.status, 'stopped');
    await database
      .update(paymentLinks)
      .set({
        status: 'stopped',
        failureCount: nextCount,
        lastFailureCode: params.failureCode ?? 'payment_failed',
        updatedAt: now,
      })
      .where(eq(paymentLinks.id, link.id));
    await database
      .update(resourceReservations)
      .set({ status: 'released', releasedAt: now, updatedAt: now })
      .where(eq(resourceReservations.quoteAcceptanceId, link.acceptanceId));
    if (acceptance) {
      await appendAudit(database, {
        traceId: acceptance.traceId,
        actorType: 'razorpay',
        eventType: 'payment.retry_stopped',
        entityType: 'payment_link',
        entityId: link.id,
        summary: 'Third failed attempt stopped retries and released resources',
      });
      await appendAudit(database, {
        traceId: acceptance.traceId,
        actorType: 'system',
        eventType: 'resource.reservation_released',
        entityType: 'quote_acceptance',
        entityId: acceptance.id,
        summary: 'Reservations released after retry stop',
      });
    }
    const provider = createPaymentProvider();
    if (link.providerPaymentLinkId) {
      try {
        await provider.cancelLink(link.providerPaymentLinkId);
      } catch {
        /* cancel is best-effort */
      }
    }
    return;
  }
  await database
    .update(paymentLinks)
    .set({
      failureCount: nextCount,
      lastFailureCode: params.failureCode ?? 'payment_failed',
      updatedAt: now,
    })
    .where(eq(paymentLinks.id, link.id));
  if (acceptance) {
    await appendAudit(database, {
      traceId: acceptance.traceId,
      actorType: 'razorpay',
      eventType: 'payment.attempt_failed',
      entityType: 'payment_link',
      entityId: link.id,
      summary: `Payment attempt failed (${nextCount})`,
    });
    await appendAudit(database, {
      traceId: acceptance.traceId,
      actorType: 'system',
      eventType: 'payment.retry_allowed',
      entityType: 'payment_link',
      entityId: link.id,
      summary: 'Same Payment Link remains issued for retry',
    });
  }
}

export async function markPaid(params: {
  database?: Database;
  paymentLinkId: string;
  clock: Clock;
}) {
  const database = params.database ?? db;
  const now = params.clock.now();
  const [link] = await database.select().from(paymentLinks).where(eq(paymentLinks.id, params.paymentLinkId)).limit(1);
  if (!link) return;
  if (link.status === 'paid') return;
  assertPaymentTransition(link.status === 'stopped' ? 'issued' : link.status, 'paid');
  await database
    .update(paymentLinks)
    .set({ status: 'paid', amountPaid: link.amount, paidAt: now, updatedAt: now })
    .where(eq(paymentLinks.id, link.id));
  await database
    .update(resourceReservations)
    .set({ status: 'committed', committedAt: now, updatedAt: now })
    .where(eq(resourceReservations.quoteAcceptanceId, link.acceptanceId));
  const [acceptance] = await database
    .select()
    .from(quoteAcceptances)
    .where(eq(quoteAcceptances.id, link.acceptanceId))
    .limit(1);
  if (acceptance) {
    await appendAudit(database, {
      traceId: acceptance.traceId,
      actorType: 'razorpay',
      eventType: 'payment.paid',
      entityType: 'payment_link',
      entityId: link.id,
      summary: 'Verified payment marked paid',
    });
    await appendAudit(database, {
      traceId: acceptance.traceId,
      actorType: 'system',
      eventType: 'resource.reservation_committed',
      entityType: 'quote_acceptance',
      entityId: acceptance.id,
      summary: 'Reservations committed after paid webhook',
    });
  }
}

function publicLink(
  link: typeof paymentLinks.$inferSelect,
  paymentTerm: 'deposit' | 'full',
) {
  return {
    checkout_url: link.shortUrl,
    amount_due_now: link.amount.toString(),
    currency: link.currency,
    payment_term: paymentTerm,
    expiry: link.expiresAt.toISOString(),
    status: link.status,
    payment_link_id: link.id,
    statement: 'Review and complete payment on Razorpay. QuoteRail never collects payment credentials.',
  };
}
