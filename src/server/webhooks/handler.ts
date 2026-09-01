import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { paymentLinks, webhookEvents } from '@/db/schema';
import { getEnv } from '@/env';
import { createId } from '@/shared/ids';
import { SystemClock } from '@/shared/clock';
import { appendAudit } from '@/server/audit/service';
import { verifyRazorpaySignature, webhookBodyHash } from '@/server/webhooks/verify';
import { markPaid, recordPaymentFailure } from '@/server/payments/service';
import { isPaymentRegression } from '@/server/policy/transitions';
import { resourceReservations } from '@/db/schema';

function eventType(payload: Record<string, unknown>): string {
  return String(payload.event ?? 'unknown');
}

function entityOf(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') return {};
  const record = value as Record<string, unknown>;
  if (record.entity && typeof record.entity === 'object') return record.entity as Record<string, unknown>;
  return record;
}

function extractLinkId(payload: Record<string, unknown>): { providerId?: string; referenceId?: string } {
  const payloadObj = (payload.payload ?? payload) as Record<string, unknown>;
  const link = entityOf(payloadObj.payment_link);
  const payment = entityOf(payloadObj.payment);
  const notes = (payment.notes ?? {}) as Record<string, unknown>;
  const providerId =
    typeof link.id === 'string'
      ? link.id
      : typeof payment.payment_link_id === 'string'
        ? payment.payment_link_id
        : typeof notes.payment_link_id === 'string'
          ? notes.payment_link_id
          : undefined;
  const referenceId =
    typeof link.reference_id === 'string'
      ? link.reference_id
      : typeof notes.reference_id === 'string'
        ? notes.reference_id
        : undefined;
  return { providerId, referenceId };
}

export async function handleRazorpayWebhook(rawBody: string, signature: string | null): Promise<Response> {
  const env = getEnv();
  const clock = new SystemClock();
  const verified = verifyRazorpaySignature(rawBody, signature, env.RAZORPAY_WEBHOOK_SECRET || 'test-webhook-secret');
  if (!verified) {
    await appendAudit(db, {
      traceId: createId(),
      actorType: 'system',
      eventType: 'webhook.invalid_signature',
      entityType: 'webhook',
      entityId: 'razorpay',
      summary: 'Rejected webhook with invalid signature',
    });
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }

  const bodyHash = webhookBodyHash(rawBody);
  try {
    await db.insert(webhookEvents).values({
      id: createId(),
      provider: 'razorpay',
      bodyHash,
      eventType: 'pending',
      signatureVerified: true,
      payload: JSON.parse(rawBody),
      status: 'received',
    });
  } catch {
    await db
      .update(webhookEvents)
      .set({ status: 'duplicate', updatedAt: clock.now() })
      .where(eq(webhookEvents.bodyHash, bodyHash));
    await appendAudit(db, {
      traceId: createId(),
      actorType: 'system',
      eventType: 'webhook.duplicate_ignored',
      entityType: 'webhook',
      entityId: bodyHash,
      summary: 'Duplicate webhook ignored',
    });
    return new Response(JSON.stringify({ ok: true, duplicate: true }), { status: 200 });
  }

  const payload = JSON.parse(rawBody) as Record<string, unknown>;
  const type = eventType(payload);
  await db.update(webhookEvents).set({ eventType: type }).where(eq(webhookEvents.bodyHash, bodyHash));
  const ids = extractLinkId(payload);
  let link = ids.providerId
    ? (
        await db
          .select()
          .from(paymentLinks)
          .where(eq(paymentLinks.providerPaymentLinkId, ids.providerId))
          .limit(1)
      )[0]
    : undefined;
  if (!link && ids.referenceId) {
    link = (
      await db.select().from(paymentLinks).where(eq(paymentLinks.providerReferenceId, ids.referenceId)).limit(1)
    )[0];
  }

  if (!link) {
    await db
      .update(webhookEvents)
      .set({ status: 'ignored', processingError: 'unmapped', updatedAt: clock.now() })
      .where(eq(webhookEvents.bodyHash, bodyHash));
    return new Response(JSON.stringify({ ok: true, ignored: true }), { status: 200 });
  }

  const target =
    type === 'payment_link.paid' || type === 'payment.captured'
      ? 'paid'
      : type === 'payment.failed'
        ? 'issued'
        : type === 'payment_link.cancelled'
          ? 'cancelled'
          : type === 'payment_link.expired'
            ? 'expired'
            : null;

  if (target && isPaymentRegression(link.status, target === 'issued' ? 'issued' : target)) {
    await appendAudit(db, {
      traceId: createId(),
      actorType: 'razorpay',
      eventType: 'webhook.out_of_order_ignored',
      entityType: 'payment_link',
      entityId: link.id,
      summary: `Ignored out-of-order ${type} for status ${link.status}`,
    });
    await db.update(webhookEvents).set({ status: 'ignored' }).where(eq(webhookEvents.bodyHash, bodyHash));
    return new Response(JSON.stringify({ ok: true, ignored: true }), { status: 200 });
  }

  if (type === 'payment.failed') {
    await recordPaymentFailure({ paymentLinkId: link.id, failureCode: 'payment.failed', clock });
  } else if (type === 'payment_link.paid') {
    await markPaid({ paymentLinkId: link.id, clock });
  } else if (type === 'payment_link.cancelled' || type === 'payment_link.expired') {
    await db
      .update(paymentLinks)
      .set({ status: type === 'payment_link.cancelled' ? 'cancelled' : 'expired', updatedAt: clock.now() })
      .where(eq(paymentLinks.id, link.id));
    await db
      .update(resourceReservations)
      .set({ status: 'released', releasedAt: clock.now(), updatedAt: clock.now() })
      .where(eq(resourceReservations.quoteAcceptanceId, link.acceptanceId));
  }

  await db.update(webhookEvents).set({ status: 'processed', updatedAt: clock.now() }).where(eq(webhookEvents.bodyHash, bodyHash));
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}
