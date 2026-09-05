import { desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import {
  approvals,
  auditEvents,
  offerings,
  paymentLinks,
  policyEvaluations,
  quoteAcceptances,
  quoteItems,
  quotes,
  resourceReservations,
  resourceSlots,
  rfqs,
} from '@/db/schema';
import { MERCHANT_ID } from '@/server/catalog/seed';
import { expireStaleReservations } from '@/server/availability/capacity';

export async function merchantDashboard(now = new Date()) {
  await expireStaleReservations(db, now);
  const allRfqs = await db.select().from(rfqs).orderBy(desc(rfqs.createdAt));
  const allQuotes = await db.select().from(quotes);
  const allAccept = await db.select().from(quoteAcceptances);
  const allLinks = await db.select().from(paymentLinks);
  const allRes = await db.select().from(resourceReservations);
  const recentAudit = await db
    .select()
    .from(auditEvents)
    .orderBy(desc(auditEvents.createdAt))
    .limit(20);
  const quotedValue = allQuotes
    .filter((q) => q.status === 'offered' || q.status === 'accepted')
    .reduce((sum, q) => sum + q.totalPrice, 0n);
  const held = allRes
    .filter((r) => r.status === 'active')
    .reduce((sum, r) => sum + BigInt(r.units), 0n);
  const paid = allLinks
    .filter((l) => l.status === 'paid')
    .reduce((sum, l) => sum + l.amountPaid, 0n);
  const blocked = recentAudit.filter(
    (e) => e.eventType.includes('blocked') || e.eventType.includes('security'),
  ).length;
  const quoteIds = allQuotes.map((q) => q.id);
  const items = quoteIds.length
    ? await db.select().from(quoteItems).where(inArray(quoteItems.quoteId, quoteIds))
    : [];
  return {
    kpis: {
      activeEnquiries: allRfqs.filter((r) => !['closed', 'escalated'].includes(r.status)).length,
      quotedValue,
      heldBookingUnits: held,
      depositsPaid: paid,
      blockedUnsafe: blocked,
    },
    rfqs: allRfqs.slice(0, 20),
    quotes: allQuotes,
    items,
    acceptances: allAccept,
    links: allLinks,
    audit: recentAudit,
  };
}

export async function merchantRfqDetail(id: string, now = new Date()) {
  await expireStaleReservations(db, now);
  const [rfq] = await db.select().from(rfqs).where(eq(rfqs.id, id)).limit(1);
  if (!rfq) return null;
  const rfqQuotes = await db.select().from(quotes).where(eq(quotes.rfqId, id));
  const items = rfqQuotes.length
    ? await db
        .select()
        .from(quoteItems)
        .where(
          inArray(
            quoteItems.quoteId,
            rfqQuotes.map((q) => q.id),
          ),
        )
    : [];
  const evals: unknown[] = [];
  const evaluations = rfqQuotes.length
    ? await db
        .select()
        .from(policyEvaluations)
        .where(
          inArray(
            policyEvaluations.quoteId,
            rfqQuotes.map((q) => q.id),
          ),
        )
    : [];
  const acceptance = rfqQuotes.find((q) => q.status === 'accepted')
    ? (await db.select().from(quoteAcceptances).where(eq(quoteAcceptances.rfqId, id)).limit(1))[0]
    : undefined;
  const link = acceptance
    ? (
        await db
          .select()
          .from(paymentLinks)
          .where(eq(paymentLinks.acceptanceId, acceptance.id))
          .limit(1)
      )[0]
    : undefined;
  const reservations = acceptance
    ? await db
        .select()
        .from(resourceReservations)
        .where(eq(resourceReservations.quoteAcceptanceId, acceptance.id))
    : [];
  const pendingApprovals = rfqQuotes.length
    ? await db
        .select()
        .from(approvals)
        .where(
          inArray(
            approvals.quoteId,
            rfqQuotes.map((q) => q.id),
          ),
        )
    : [];
  const timeline = await db
    .select()
    .from(auditEvents)
    .where(eq(auditEvents.traceId, rfq.traceId))
    .orderBy(auditEvents.createdAt);
  void evals;
  return {
    rfq,
    quotes: rfqQuotes,
    items,
    evaluations,
    acceptance,
    link,
    reservations,
    approvals: pendingApprovals,
    timeline,
  };
}

export async function hallCalendar(now = new Date()) {
  await expireStaleReservations(db, now);
  const halls = await db.select().from(offerings).where(eq(offerings.merchantId, MERCHANT_ID));
  const hallIds = halls.filter((h) => h.category === 'hall').map((h) => h.id);
  const slots = hallIds.length
    ? await db.select().from(resourceSlots).where(inArray(resourceSlots.offeringId, hallIds))
    : [];
  const reservations = hallIds.length
    ? await db
        .select()
        .from(resourceReservations)
        .where(inArray(resourceReservations.offeringId, hallIds))
    : [];
  return halls
    .filter((h) => h.category === 'hall')
    .map((hall) => ({
      hall,
      slots: slots
        .filter((s) => s.offeringId === hall.id)
        .map((slot) => {
          const overlapping = reservations.filter(
            (r) =>
              r.resourceSlotId === slot.id && (r.status === 'active' || r.status === 'committed'),
          );
          const state = overlapping.some((r) => r.status === 'committed')
            ? ('committed' as const)
            : overlapping.some((r) => r.status === 'active')
              ? ('held' as const)
              : slot.blockedUnits > 0
                ? ('blocked' as const)
                : ('available' as const);
          return { slot, state };
        })
        .sort((a, b) => a.slot.startsAt.getTime() - b.slot.startsAt.getTime())
        .slice(0, 42),
    }));
}

export async function publicQuote(id: string) {
  const [quote] = await db.select().from(quotes).where(eq(quotes.id, id)).limit(1);
  if (!quote) return null;
  const items = await db.select().from(quoteItems).where(eq(quoteItems.quoteId, id));
  const [acceptance] = await db
    .select()
    .from(quoteAcceptances)
    .where(eq(quoteAcceptances.quoteId, id))
    .limit(1);
  const [link] = acceptance
    ? await db
        .select()
        .from(paymentLinks)
        .where(eq(paymentLinks.acceptanceId, acceptance.id))
        .limit(1)
    : [undefined];
  return {
    quote: {
      id: quote.id,
      status: quote.status,
      currency: quote.currency,
      totalPrice: quote.totalPrice,
      depositAmount: quote.depositAmount,
      eventStartsAt: quote.eventStartsAt,
      eventEndsAt: quote.eventEndsAt,
      attendeeCount: quote.attendeeCount,
      expiresAt: quote.expiresAt,
      rationale: quote.rationale,
      tradeoffs: quote.tradeoffs,
      assumptions: quote.assumptions,
    },
    items: items.map((item) => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      linePrice: item.linePrice,
    })),
    link: link
      ? {
          status: link.status,
          shortUrl: link.shortUrl,
          amount: link.amount,
          currency: link.currency,
        }
      : undefined,
  };
}

export { sql };
