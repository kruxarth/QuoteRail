import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { paymentLinks, quoteAcceptances, rfqs } from '@/db/schema';
import { MAX_PAYMENT_FAILURES } from '@/shared/constants';
import { DomainError } from '@/shared/result';

export async function readPaymentStatus(params: {
  acceptanceId?: string;
  paymentLinkId?: string;
  buyerSubject: string;
}) {
  if (!params.acceptanceId && !params.paymentLinkId) {
    throw new DomainError('invalid_input', 'acceptance_id or payment_link_id is required', 400);
  }
  let link;
  if (params.paymentLinkId) {
    [link] = await db
      .select()
      .from(paymentLinks)
      .where(eq(paymentLinks.id, params.paymentLinkId))
      .limit(1);
  } else if (params.acceptanceId) {
    [link] = await db
      .select()
      .from(paymentLinks)
      .where(eq(paymentLinks.acceptanceId, params.acceptanceId))
      .limit(1);
  }
  if (!link) throw new DomainError('not_found', 'Transaction not found', 404);
  const [acceptance] = await db
    .select()
    .from(quoteAcceptances)
    .where(eq(quoteAcceptances.id, link.acceptanceId))
    .limit(1);
  if (!acceptance) throw new DomainError('not_found', 'Transaction not found', 404);
  const [rfq] = await db.select().from(rfqs).where(eq(rfqs.id, acceptance.rfqId)).limit(1);
  if (!rfq || rfq.buyerSubject !== params.buyerSubject) {
    throw new DomainError('not_found', 'Transaction not found', 404);
  }
  return {
    status: link.status,
    failure_count: link.failureCount,
    retry_eligible: link.status === 'issued' && link.failureCount <= MAX_PAYMENT_FAILURES,
    amount: link.amount.toString(),
    currency: link.currency,
    updated_at: link.updatedAt.toISOString(),
  };
}
