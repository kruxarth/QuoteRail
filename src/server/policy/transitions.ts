import {
  rfqStatusEnum,
  quoteStatusEnum,
  paymentLinkStatusEnum,
  reservationStatusEnum,
} from '@/db/schema';
import { DomainError } from '@/shared/result';

type RfqStatus = (typeof rfqStatusEnum.enumValues)[number];
type QuoteStatus = (typeof quoteStatusEnum.enumValues)[number];
type PaymentStatus = (typeof paymentLinkStatusEnum.enumValues)[number];
type ReservationStatus = (typeof reservationStatusEnum.enumValues)[number];

const RFQ_TRANSITIONS: Record<RfqStatus, RfqStatus[]> = {
  received: ['needs_clarification', 'planning'],
  needs_clarification: ['planning'],
  planning: ['needs_clarification', 'retryable_error', 'quoted', 'escalated'],
  retryable_error: ['planning'],
  quoted: ['closed', 'planning'],
  escalated: [],
  closed: [],
};

const QUOTE_TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  draft: ['policy_rejected', 'pending_approval', 'offered', 'cancelled'],
  policy_rejected: [],
  pending_approval: ['offered', 'cancelled', 'superseded'],
  offered: ['accepted', 'expired', 'superseded', 'cancelled'],
  accepted: [],
  expired: [],
  superseded: [],
  cancelled: [],
};

const PAYMENT_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  creating: ['issued', 'error'],
  issued: ['paid', 'cancelled', 'expired', 'stopped'],
  paid: [],
  cancelled: [],
  expired: [],
  stopped: [],
  error: ['issued', 'error'],
};

const RESERVATION_TRANSITIONS: Record<ReservationStatus, ReservationStatus[]> = {
  active: ['committed', 'released', 'expired'],
  committed: [],
  released: [],
  expired: [],
};

function assertTransition<T extends string>(
  kind: string,
  from: T,
  to: T,
  table: Record<T, T[]>,
): void {
  if (!table[from]?.includes(to)) {
    throw new DomainError(
      'illegal_transition',
      `Illegal ${kind} transition ${from} -> ${to}`,
      409,
      { kind, from, to },
    );
  }
}

export function assertRfqTransition(from: RfqStatus, to: RfqStatus): void {
  assertTransition('rfq', from, to, RFQ_TRANSITIONS);
}

export function assertQuoteTransition(from: QuoteStatus, to: QuoteStatus): void {
  assertTransition('quote', from, to, QUOTE_TRANSITIONS);
}

export function assertPaymentTransition(from: PaymentStatus, to: PaymentStatus): void {
  assertTransition('payment_link', from, to, PAYMENT_TRANSITIONS);
}

export function isPaymentRegression(from: PaymentStatus, to: PaymentStatus): boolean {
  const rank: Record<PaymentStatus, number> = {
    creating: 0,
    issued: 1,
    error: 1,
    stopped: 2,
    cancelled: 3,
    expired: 3,
    paid: 4,
  };
  if (from === 'paid' && to !== 'paid') return true;
  return rank[to] < rank[from];
}

export function assertReservationTransition(from: ReservationStatus, to: ReservationStatus): void {
  assertTransition('reservation', from, to, RESERVATION_TRANSITIONS);
}

export function canContinueRfq(status: RfqStatus): boolean {
  return status === 'needs_clarification' || status === 'retryable_error';
}
