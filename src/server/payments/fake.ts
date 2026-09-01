import {
  ManualReconciliationRequired,
  type CreatePaymentLinkInput,
  type PaymentProvider,
  type ProviderPaymentLink,
} from '@/server/payments/types';

export class FakePaymentProvider implements PaymentProvider {
  readonly links = new Map<string, ProviderPaymentLink>();
  createCalls = 0;
  failNextCreate = false;
  timeoutNextCreate = false;
  uniqueReference = true;

  async createLink(input: CreatePaymentLinkInput): Promise<ProviderPaymentLink> {
    this.createCalls += 1;
    if (this.timeoutNextCreate) {
      this.timeoutNextCreate = false;
      const created: ProviderPaymentLink = {
        id: `plink_fake_${this.createCalls}`,
        referenceId: input.referenceId,
        shortUrl: `https://rzp.io/i/fake-${this.createCalls}`,
        amount: input.amount,
        currency: input.currency,
        status: 'issued',
        expireBy: input.expireBy,
      };
      this.links.set(created.id, created);
      throw new Error('provider timeout after remote creation');
    }
    if (this.failNextCreate) {
      this.failNextCreate = false;
      throw new Error('provider unavailable');
    }
    const existing = [...this.links.values()].find((item) => item.referenceId === input.referenceId);
    if (existing) return existing;
    const created: ProviderPaymentLink = {
      id: `plink_fake_${crypto.randomUUID().slice(0, 8)}`,
      referenceId: input.referenceId,
      shortUrl: `https://rzp.io/i/${input.referenceId}`,
      amount: input.amount,
      currency: input.currency,
      status: 'created',
      expireBy: input.expireBy,
    };
    this.links.set(created.id, created);
    return created;
  }

  async fetchLink(providerId: string): Promise<ProviderPaymentLink | null> {
    return this.links.get(providerId) ?? null;
  }

  async findByReferenceId(referenceId: string): Promise<ProviderPaymentLink | null> {
    if (!this.uniqueReference) throw new ManualReconciliationRequired('reference lookup is not unique');
    return [...this.links.values()].find((item) => item.referenceId === referenceId) ?? null;
  }

  async cancelLink(providerId: string): Promise<void> {
    const link = this.links.get(providerId);
    if (link) link.status = 'cancelled';
  }
}

let singleton: FakePaymentProvider | null = null;
export function getFakePaymentProvider(): FakePaymentProvider {
  singleton ??= new FakePaymentProvider();
  return singleton;
}

export function resetFakePaymentProvider(): FakePaymentProvider {
  singleton = new FakePaymentProvider();
  return singleton;
}
