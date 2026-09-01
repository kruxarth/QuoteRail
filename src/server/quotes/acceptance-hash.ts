import { sha256Hex, stableJson } from '@/shared/hash';

export type AcceptanceHashInput = {
  quoteId: string;
  quoteVersion: number;
  totalPrice: bigint;
  paymentTerm: 'deposit' | 'full';
  amountDueNow: bigint;
  offerExpiresAt: Date;
  paymentExpiresAt: Date;
  policySnapshotHash: string;
};

export function computeAcceptanceHash(input: AcceptanceHashInput): string {
  return sha256Hex(
    stableJson({
      quoteId: input.quoteId,
      quoteVersion: input.quoteVersion,
      totalPrice: input.totalPrice.toString(),
      paymentTerm: input.paymentTerm,
      amountDueNow: input.amountDueNow.toString(),
      offerExpiresAt: input.offerExpiresAt.toISOString(),
      paymentExpiresAt: input.paymentExpiresAt.toISOString(),
      policySnapshotHash: input.policySnapshotHash,
    }),
  );
}

export function acceptanceHashPrefix(hash: string): string {
  return hash.slice(0, 12);
}

export function providerReferenceId(acceptanceId: string): string {
  return `qr_${acceptanceId.replace(/-/g, '').slice(0, 32)}`;
}
