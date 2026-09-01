export type CreatePaymentLinkInput = {
  amount: bigint;
  currency: 'INR';
  referenceId: string;
  description: string;
  expireBy: Date;
  callbackUrl?: string;
};

export type ProviderPaymentLink = {
  id: string;
  referenceId: string;
  shortUrl: string;
  amount: bigint;
  currency: string;
  status: string;
  expireBy: Date;
};

export interface PaymentProvider {
  createLink(input: CreatePaymentLinkInput): Promise<ProviderPaymentLink>;
  fetchLink(providerId: string): Promise<ProviderPaymentLink | null>;
  findByReferenceId(referenceId: string): Promise<ProviderPaymentLink | null>;
  cancelLink(providerId: string): Promise<void>;
}

export class ManualReconciliationRequired extends Error {
  readonly code = 'manual_reconciliation_required';
  constructor(message: string) {
    super(message);
    this.name = 'ManualReconciliationRequired';
  }
}
