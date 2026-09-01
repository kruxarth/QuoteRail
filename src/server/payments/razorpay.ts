import { getEnv } from '@/env';
import {
  ManualReconciliationRequired,
  type CreatePaymentLinkInput,
  type PaymentProvider,
  type ProviderPaymentLink,
} from '@/server/payments/types';

function basicAuth(keyId: string, keySecret: string): string {
  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`;
}

export class RazorpayPaymentProvider implements PaymentProvider {
  constructor(
    private readonly keyId = getEnv().RAZORPAY_KEY_ID,
    private readonly keySecret = getEnv().RAZORPAY_KEY_SECRET,
    private readonly baseUrl = 'https://api.razorpay.com/v1',
  ) {}

  private async request(path: string, init?: RequestInit): Promise<Response> {
    return fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: basicAuth(this.keyId, this.keySecret),
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });
  }

  async createLink(input: CreatePaymentLinkInput): Promise<ProviderPaymentLink> {
    const expireBy = Math.floor(input.expireBy.getTime() / 1000);
    const response = await this.request('/payment_links', {
      method: 'POST',
      body: JSON.stringify({
        amount: Number(input.amount),
        currency: input.currency,
        accept_partial: false,
        reference_id: input.referenceId,
        description: input.description,
        expire_by: expireBy,
        reminder_enable: false,
        notify: { sms: false, email: false },
        callback_url: input.callbackUrl,
        callback_method: input.callbackUrl ? 'get' : undefined,
      }),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Razorpay create failed: ${response.status} ${text.slice(0, 200)}`);
    }
    const body = (await response.json()) as Record<string, unknown>;
    return this.map(body);
  }

  async fetchLink(providerId: string): Promise<ProviderPaymentLink | null> {
    const response = await this.request(`/payment_links/${providerId}`);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Razorpay fetch failed: ${response.status}`);
    return this.map((await response.json()) as Record<string, unknown>);
  }

  async findByReferenceId(referenceId: string): Promise<ProviderPaymentLink | null> {
    const response = await this.request(`/payment_links?reference_id=${encodeURIComponent(referenceId)}`);
    if (!response.ok) {
      throw new ManualReconciliationRequired('Razorpay reference lookup is not reliable');
    }
    const body = (await response.json()) as {
      payment_links?: Record<string, unknown>[];
      items?: Record<string, unknown>[];
    };
    const items = body.payment_links ?? body.items ?? [];
    if (items.length === 1) return this.map(items[0]);
    if (items.length === 0) return null;
    throw new ManualReconciliationRequired('Multiple Payment Links share the same reference_id');
  }

  async cancelLink(providerId: string): Promise<void> {
    const response = await this.request(`/payment_links/${providerId}/cancel`, { method: 'POST' });
    if (!response.ok && response.status !== 404) {
      throw new Error(`Razorpay cancel failed: ${response.status}`);
    }
  }

  private map(body: Record<string, unknown>): ProviderPaymentLink {
    return {
      id: String(body.id),
      referenceId: String(body.reference_id ?? ''),
      shortUrl: String(body.short_url ?? ''),
      amount: BigInt(String(body.amount ?? 0)),
      currency: String(body.currency ?? 'INR'),
      status: String(body.status ?? 'created'),
      expireBy: new Date(Number(body.expire_by ?? 0) * 1000),
    };
  }
}
