import { and, asc, eq, inArray } from 'drizzle-orm';
import { db, type Database } from '@/db/client';
import {
  quoteAcceptances,
  quoteItems,
  quotes,
  resourceReservations,
  resourceSlots,
  rfqs,
} from '@/db/schema';
import { createId } from '@/shared/ids';
import { PAYMENT_WINDOW_HOURS, SETUP_BUFFER_HOURS } from '@/shared/constants';
import { addHours, bufferedRange, type Clock } from '@/shared/clock';
import { DomainError, isUniqueViolation } from '@/shared/result';
import { appendAudit } from '@/server/audit/service';
import { expireStaleReservations } from '@/server/availability/capacity';
import { computeAcceptanceHash } from '@/server/quotes/acceptance-hash';
import { assertQuoteTransition } from '@/server/policy/transitions';

export async function acceptQuote(params: {
  database?: Database;
  buyerSubject: string;
  quoteId: string;
  buyerName: string;
  buyerEmail?: string;
  paymentTerm: 'deposit' | 'full';
  confirmed: true;
  clock: Clock;
}) {
  const database = params.database ?? db;
  const now = params.clock.now();
  try {
    return await database.transaction(async (tx) => {
    const [quoted] = await tx.select().from(quotes).where(eq(quotes.id, params.quoteId)).limit(1);
    if (!quoted) throw new DomainError('not_found', 'Quote not found', 404);
    const [rfq] = await tx.select().from(rfqs).where(eq(rfqs.id, quoted.rfqId)).for('update').limit(1);
    if (!rfq || rfq.buyerSubject !== params.buyerSubject) {
      throw new DomainError('not_found', 'Quote not found', 404);
    }
    const [quote] = await tx.select().from(quotes).where(eq(quotes.id, params.quoteId)).limit(1);
    if (!quote) throw new DomainError('not_found', 'Quote not found', 404);
    if (quote.status !== 'offered') {
      throw new DomainError('illegal_transition', `Quote cannot be accepted from ${quote.status}`, 409);
    }
    if (quote.expiresAt.getTime() < now.getTime()) {
      await tx.update(quotes).set({ status: 'expired', updatedAt: now }).where(eq(quotes.id, quote.id));
      throw new DomainError('quote_expired', 'Quote offer has expired', 409);
    }
    const expiredIds = await expireStaleReservations(tx, now);
    for (const id of expiredIds) {
      await appendAudit(tx, {
        traceId: rfq.traceId,
        actorType: 'system',
        eventType: 'resource.reservation_expired',
        entityType: 'resource_reservation',
        entityId: id,
        summary: 'Stale reservation expired before acceptance',
      });
    }

    const items = await tx.select().from(quoteItems).where(eq(quoteItems.quoteId, quote.id));
    const slotIds = items.map((item) => item.resourceSlotId).filter((id): id is string => !!id);
    if (slotIds.length) {
      const slots = await tx
        .select()
        .from(resourceSlots)
        .where(inArray(resourceSlots.id, slotIds))
        .orderBy(asc(resourceSlots.id))
        .for('update');
      for (const slot of slots) {
        const buffered = bufferedRange(slot.startsAt, slot.endsAt, SETUP_BUFFER_HOURS);
        const overlapping = await tx
          .select()
          .from(resourceReservations)
          .where(
            and(
              eq(resourceReservations.offeringId, slot.offeringId),
              inArray(resourceReservations.status, ['active', 'committed']),
            ),
          );
        const used = overlapping
          .filter(
            (row) =>
              row.reservedStartsAt.getTime() < buffered.bufferEndsAt.getTime() &&
              row.reservedEndsAt.getTime() > buffered.bufferStartsAt.getTime(),
          )
          .reduce((sum, row) => sum + row.units, 0);
        const item = items.find((row) => row.resourceSlotId === slot.id);
        const requested = item?.quantity ?? 1;
        if (slot.capacityTotal - slot.blockedUnits - used < requested) {
          await appendAudit(tx, {
            traceId: rfq.traceId,
            actorType: 'policy',
            eventType: 'resource.conflict_blocked',
            entityType: 'quote',
            entityId: quote.id,
            summary: `Resource ${slot.id} no longer has capacity`,
          });
          throw new DomainError('resource_conflict', 'Selected resources are no longer available', 409);
        }
      }
    }

    const paymentExpiresAt = addHours(now, PAYMENT_WINDOW_HOURS);
    const amountDueNow = params.paymentTerm === 'deposit' ? quote.depositAmount : quote.totalPrice;
    const acceptanceHash = computeAcceptanceHash({
      quoteId: quote.id,
      quoteVersion: quote.version,
      totalPrice: quote.totalPrice,
      paymentTerm: params.paymentTerm,
      amountDueNow,
      offerExpiresAt: quote.expiresAt,
      paymentExpiresAt,
      policySnapshotHash: quote.policySnapshotHash,
    });
    const acceptanceId = createId();
    await tx.insert(quoteAcceptances).values({
      id: acceptanceId,
      rfqId: rfq.id,
      quoteId: quote.id,
      buyerName: params.buyerName,
      buyerEmail: params.buyerEmail ?? null,
      paymentTerm: params.paymentTerm,
      amountDueNow,
      paymentExpiresAt,
      acceptanceHash,
      acceptedAt: now,
      traceId: rfq.traceId,
    });
    assertQuoteTransition(quote.status, 'accepted');
    await tx.update(quotes).set({ status: 'accepted', updatedAt: now }).where(eq(quotes.id, quote.id));
    const siblings = await tx
      .select()
      .from(quotes)
      .where(
        and(eq(quotes.rfqId, rfq.id), inArray(quotes.status, ['offered', 'pending_approval'])),
      );
    for (const sibling of siblings) {
      if (sibling.id === quote.id) continue;
      await tx.update(quotes).set({ status: 'superseded', updatedAt: now }).where(eq(quotes.id, sibling.id));
    }
    await appendAudit(tx, {
      traceId: rfq.traceId,
      actorType: 'buyer',
      actorId: params.buyerSubject,
      eventType: 'quote.accepted',
      entityType: 'quote_acceptance',
      entityId: acceptanceId,
      summary: `Accepted quote ${quote.id} with ${params.paymentTerm}`,
      output: { amountDueNow: amountDueNow.toString(), paymentTerm: params.paymentTerm },
    });
    if (siblings.length) {
      await appendAudit(tx, {
        traceId: rfq.traceId,
        actorType: 'system',
        eventType: 'quote.siblings_superseded',
        entityType: 'rfq',
        entityId: rfq.id,
        summary: `Superseded ${siblings.length} sibling quotes`,
      });
    }
    for (const item of items) {
      if (!item.resourceSlotId) continue;
      const [slot] = await tx.select().from(resourceSlots).where(eq(resourceSlots.id, item.resourceSlotId)).limit(1);
      if (!slot) continue;
      const exclusive = item.category !== 'catering' && item.category !== 'operations';
      const reserved = exclusive
        ? bufferedRange(slot.startsAt, slot.endsAt, SETUP_BUFFER_HOURS)
        : { bufferStartsAt: slot.startsAt, bufferEndsAt: slot.endsAt };
      const reservationId = createId();
      await tx.insert(resourceReservations).values({
        id: reservationId,
        quoteAcceptanceId: acceptanceId,
        offeringId: item.offeringId,
        resourceSlotId: item.resourceSlotId,
        units: item.quantity,
        reservedStartsAt: reserved.bufferStartsAt,
        reservedEndsAt: reserved.bufferEndsAt,
        status: 'active',
        expiresAt: paymentExpiresAt,
      });
      await appendAudit(tx, {
        traceId: rfq.traceId,
        actorType: 'system',
        eventType: 'resource.reserved',
        entityType: 'resource_reservation',
        entityId: reservationId,
        summary: `Reserved ${item.code} x${item.quantity} for 24 hours`,
      });
    }
    return {
      acceptance_id: acceptanceId,
      quote_id: quote.id,
      amount_due_now: amountDueNow.toString(),
      currency: quote.currency,
      payment_term: params.paymentTerm,
      acceptance_hash_prefix: acceptanceHash.slice(0, 12),
      payment_expires_at: paymentExpiresAt.toISOString(),
      checkout_allowed: true,
      total_price: quote.totalPrice.toString(),
    };
  });
  } catch (error) {
    if (error instanceof DomainError) throw error;
    if (isUniqueViolation(error)) {
      throw new DomainError('already_accepted', 'This RFQ already has an accepted quote', 409);
    }
    throw error;
  }
}
