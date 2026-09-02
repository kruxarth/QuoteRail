import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { db, sql } from '@/db/client';
import { FrozenClock } from '@/shared/clock';
import { FROZEN_TEST_NOW } from '@/shared/constants';
import { resetDemo } from '@/server/catalog/seed';
import { requestQuote, continueRfq, getRfqPublic } from '@/server/quotes/rfq-service';
import { FakeModelAdapter } from '@/server/planner/fake';
import { acceptQuote } from '@/server/quotes/accept';
import { createCheckout } from '@/server/payments/service';
import { resetFakePaymentProvider } from '@/server/payments/fake';
import { handleRazorpayWebhook } from '@/server/webhooks/handler';
import { quotes, quoteAcceptances, resourceReservations, paymentLinks } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { createHmac } from 'node:crypto';

const clock = new FrozenClock(new Date(FROZEN_TEST_NOW));
const buyer = 'buyer:test';

describe('rfq integration', () => {
  beforeAll(async () => {
    process.env.RAZORPAY_WEBHOOK_SECRET = 'test-webhook-secret';
    await resetDemo(db, clock);
    resetFakePaymentProvider();
  });

  afterAll(async () => {
    await sql.end({ timeout: 1 });
  });

  it('quotes the locked demo RFQ, accepts Thursday option, and handles payment retry', async () => {
    const rfqText = `We need a Bengaluru venue for a 120-person product launch on Friday, 2026-09-11, from 5 PM to 11 PM. We need theatre seating, a professional LED wall and PA, premium dinner with 30 Jain and 10 vegan meals, valet parking, and a branded stage. Keep the total under ₹2,20,000. We can pay a 40% deposit today.`;
    const quoted = await requestQuote({
      buyerSubject: buyer,
      request: rfqText,
      clock,
      adapter: new FakeModelAdapter(),
    });
    expect(quoted.status).toBe('quoted');
    expect(quoted.options.length).toBeGreaterThanOrEqual(2);
    const totals = quoted.options.map((o) => o.total_price).sort();
    expect(totals).toContain('19600000');
    expect(totals).toContain('20300000');
    expect(totals).toContain('24800000');

    const thursday = quoted.options.find((o) => o.total_price === '20300000');
    expect(thursday).toBeTruthy();
    const accepted = await acceptQuote({
      buyerSubject: buyer,
      quoteId: thursday!.quote_id,
      buyerName: 'Asha Rao',
      paymentTerm: 'deposit',
      confirmed: true,
      clock,
    });
    expect(accepted.amount_due_now).toBe('8120000');
    const siblings = await db.select().from(quotes).where(eq(quotes.rfqId, quoted.rfq_id));
    expect(siblings.filter((q) => q.status === 'accepted')).toHaveLength(1);
    expect(siblings.filter((q) => q.status === 'superseded').length).toBeGreaterThanOrEqual(1);
    const holds = await db
      .select()
      .from(resourceReservations)
      .where(eq(resourceReservations.quoteAcceptanceId, accepted.acceptance_id));
    expect(holds.every((h) => h.status === 'active')).toBe(true);

    const checkout = await createCheckout({
      buyerSubject: buyer,
      acceptanceId: accepted.acceptance_id,
      confirmed: true,
      clock,
    });
    expect(checkout.status).toBe('issued');
    const again = await createCheckout({
      buyerSubject: buyer,
      acceptanceId: accepted.acceptance_id,
      confirmed: true,
      clock,
    });
    expect(again.payment_link_id).toBe(checkout.payment_link_id);

    const [link] = await db
      .select()
      .from(paymentLinks)
      .where(eq(paymentLinks.id, checkout.payment_link_id!))
      .limit(1);
    const failedBody = JSON.stringify({
      event: 'payment.failed',
      payload: {
        payment_link: { entity: { id: link.providerPaymentLinkId, reference_id: link.providerReferenceId } },
      },
    });
    const sig = createHmac('sha256', 'test-webhook-secret').update(failedBody).digest('hex');
    const failRes = await handleRazorpayWebhook(failedBody, sig);
    expect(failRes.status).toBe(200);
    const [afterFail] = await db.select().from(paymentLinks).where(eq(paymentLinks.id, link.id));
    expect(afterFail.status).toBe('issued');
    expect(afterFail.failureCount).toBe(1);

    const invalid = await handleRazorpayWebhook(failedBody, 'deadbeef');
    expect(invalid.status).toBe(401);

    const paidBody = JSON.stringify({
      event: 'payment_link.paid',
      payload: {
        payment_link: { entity: { id: link.providerPaymentLinkId, reference_id: link.providerReferenceId } },
      },
    });
    const paidSig = createHmac('sha256', 'test-webhook-secret').update(paidBody).digest('hex');
    expect((await handleRazorpayWebhook(paidBody, paidSig)).status).toBe(200);
    const [paid] = await db.select().from(paymentLinks).where(eq(paymentLinks.id, link.id));
    expect(paid.status).toBe('paid');
    const committed = await db
      .select()
      .from(resourceReservations)
      .where(eq(resourceReservations.quoteAcceptanceId, accepted.acceptance_id));
    expect(committed.every((r) => r.status === 'committed')).toBe(true);
    void quoteAcceptances;
  }, 30_000);

  it('marks retryable_error when extraction fails instead of throwing illegal_transition', async () => {
    await resetDemo(db, clock);
    const adapter = {
      extract: async () => {
        throw new Error('OpenCode Go unavailable');
      },
      plan: async () => {
        throw new Error('should not plan');
      },
    };
    const result = await requestQuote({
      buyerSubject: buyer,
      request: 'We need a Bengaluru venue for 120 people on Friday.',
      clock,
      adapter,
    });
    expect(result.status).toBe('retryable_error');
    expect(result.rfq_id).toBeTruthy();
    expect(result.options).toEqual([]);
    const continued = await continueRfq({
      buyerSubject: buyer,
      rfqId: result.rfq_id,
      answers: '',
      clock,
      adapter: new FakeModelAdapter(),
    });
    expect(['quoted', 'needs_clarification']).toContain(continued.status);
  });

  it('revises planning when the first valid set is entirely over budget', async () => {
    await resetDemo(db, clock);
    const fake = new FakeModelAdapter();
    let calls = 0;
    const quoted = await requestQuote({
      buyerSubject: buyer,
      request: `We need a Bengaluru venue for a 120-person product launch on Friday, 2026-09-11, from 5 PM to 11 PM. We need theatre seating, a professional LED wall and PA, premium dinner with 30 Jain and 10 vegan meals, valet parking, and a branded stage. Keep the total under ₹2,20,000. We can pay a 40% deposit today.`,
      clock,
      adapter: {
        extract: (input) => fake.extract(input),
        plan: async (input) => {
          calls += 1;
          const full = await fake.plan(input);
          if (calls === 1) {
            const exact = full.candidates.find((candidate) => candidate.name.includes('Exact'));
            if (!exact) throw new Error('expected exact candidate');
            return {
              cannot_proceed: false,
              escalation_reason: '',
              candidates: [
                exact,
                {
                  ...exact,
                  name: 'Thursday Grand premium over budget',
                  event_date: '2026-09-10',
                  hall_code: 'HALL-GRAND',
                  services: exact.services.map((service) => ({ ...service })),
                  relaxed_constraints: [
                    { constraint: 'budget', reason: 'Keeps premium services over the stated budget.' },
                    { constraint: 'date', reason: 'Moves to Thursday evening.' },
                  ],
                },
              ],
            };
          }
          expect(input.feedback ?? '').toMatch(/exceeded the buyer budget/i);
          return full;
        },
      },
    });
    expect(calls).toBe(2);
    expect(quoted.status).toBe('quoted');
    const totals = quoted.options.map((option) => option.total_price);
    expect(totals).toContain('19600000');
    expect(totals).toContain('20300000');
    expect(totals.some((total) => BigInt(total) <= 22_000_000n)).toBe(true);
  });

  it('asks for clarification when the RFQ is incomplete', async () => {
    await resetDemo(db, clock);
    const result = await requestQuote({
      buyerSubject: buyer,
      request: 'We need a venue in Bengaluru sometime soon.',
      clock,
      adapter: new FakeModelAdapter(),
    });
    expect(result.status).toBe('needs_clarification');
    expect(result.rfq_id).toBeTruthy();
  });

  it('continues a clarification turn and reads the RFQ back', async () => {
    await resetDemo(db, clock);
    const started = await requestQuote({
      buyerSubject: buyer,
      request: 'We need a venue in Bengaluru sometime soon.',
      clock,
      adapter: new FakeModelAdapter(),
    });
    const continued = await continueRfq({
      buyerSubject: buyer,
      rfqId: started.rfq_id,
      answers:
        '120 people, Friday 2026-09-11 evening, theatre, budget ₹2,20,000, premium dinner 30 Jain 10 vegan, LED, valet, branded stage, 40% deposit.',
      clock,
      adapter: new FakeModelAdapter(),
    });
    expect(continued.status).toBe('quoted');
    const readBack = await getRfqPublic({ buyerSubject: buyer, rfqId: started.rfq_id });
    expect(readBack.status).toBe('quoted');
    expect(readBack.options.length).toBeGreaterThanOrEqual(2);
    await expect(getRfqPublic({ buyerSubject: 'buyer:other', rfqId: started.rfq_id })).rejects.toMatchObject({
      status: 404,
    });
  });

  it('creates exactly one acceptance under concurrent sibling accepts', async () => {
    await resetDemo(db, clock);
    resetFakePaymentProvider();
    const quoted = await requestQuote({
      buyerSubject: buyer,
      request: `We need a Bengaluru venue for a 120-person product launch on Friday, 2026-09-11, from 5 PM to 11 PM. We need theatre seating, a professional LED wall and PA, premium dinner with 30 Jain and 10 vegan meals, valet parking, and a branded stage. Keep the total under ₹2,20,000. We can pay a 40% deposit today.`,
      clock,
      adapter: new FakeModelAdapter(),
    });
    const [first, second] = quoted.options;
    const results = await Promise.allSettled([
      acceptQuote({
        buyerSubject: buyer,
        quoteId: first.quote_id,
        buyerName: 'Asha Rao',
        paymentTerm: 'deposit',
        confirmed: true,
        clock,
      }),
      acceptQuote({
        buyerSubject: buyer,
        quoteId: second.quote_id,
        buyerName: 'Asha Rao',
        paymentTerm: 'deposit',
        confirmed: true,
        clock,
      }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const accepts = await db.select().from(quoteAcceptances).where(eq(quoteAcceptances.rfqId, quoted.rfq_id));
    expect(accepts).toHaveLength(1);
  });

  it('reuses one Payment Link for concurrent checkout and reconciles a provider timeout', async () => {
    await resetDemo(db, clock);
    const provider = resetFakePaymentProvider();
    const quoted = await requestQuote({
      buyerSubject: buyer,
      request: `We need a Bengaluru venue for a 120-person product launch on Friday, 2026-09-11, from 5 PM to 11 PM. We need theatre seating, a professional LED wall and PA, premium dinner with 30 Jain and 10 vegan meals, valet parking, and a branded stage. Keep the total under ₹2,20,000. We can pay a 40% deposit today.`,
      clock,
      adapter: new FakeModelAdapter(),
    });
    const thursday = quoted.options.find((o) => o.total_price === '20300000')!;
    const accepted = await acceptQuote({
      buyerSubject: buyer,
      quoteId: thursday.quote_id,
      buyerName: 'Asha Rao',
      paymentTerm: 'deposit',
      confirmed: true,
      clock,
    });
    const [a, b] = await Promise.all([
      createCheckout({
        buyerSubject: buyer,
        acceptanceId: accepted.acceptance_id,
        confirmed: true,
        clock,
        provider,
      }),
      createCheckout({
        buyerSubject: buyer,
        acceptanceId: accepted.acceptance_id,
        confirmed: true,
        clock,
        provider,
      }),
    ]);
    expect(a.payment_link_id).toBe(b.payment_link_id);
    expect(provider.createCalls).toBe(1);

    await resetDemo(db, clock);
    const timeoutProvider = resetFakePaymentProvider();
    timeoutProvider.timeoutNextCreate = true;
    const quotedAgain = await requestQuote({
      buyerSubject: buyer,
      request: `We need a Bengaluru venue for a 120-person product launch on Friday, 2026-09-11, from 5 PM to 11 PM. We need theatre seating, a professional LED wall and PA, premium dinner with 30 Jain and 10 vegan meals, valet parking, and a branded stage. Keep the total under ₹2,20,000. We can pay a 40% deposit today.`,
      clock,
      adapter: new FakeModelAdapter(),
    });
    const option = quotedAgain.options.find((o) => o.total_price === '20300000')!;
    const acceptedAgain = await acceptQuote({
      buyerSubject: buyer,
      quoteId: option.quote_id,
      buyerName: 'Asha Rao',
      paymentTerm: 'deposit',
      confirmed: true,
      clock,
    });
    const recovered = await createCheckout({
      buyerSubject: buyer,
      acceptanceId: acceptedAgain.acceptance_id,
      confirmed: true,
      clock,
      provider: timeoutProvider,
    });
    expect(recovered.status).toBe('issued');
    expect(recovered.checkout_url).toBeTruthy();
  });

  it('rejects an expired offer and overlapping hall acceptance', async () => {
    await resetDemo(db, clock);
    const quoted = await requestQuote({
      buyerSubject: 'buyer:alpha',
      request: `We need a Bengaluru venue for a 120-person product launch on Friday, 2026-09-11, from 5 PM to 11 PM. We need theatre seating, a professional LED wall and PA, premium dinner with 30 Jain and 10 vegan meals, valet parking, and a branded stage. Keep the total under ₹2,20,000. We can pay a 40% deposit today.`,
      clock,
      adapter: new FakeModelAdapter(),
    });
    const friday = quoted.options.find((o) => o.total_price === '19600000')!;
    await acceptQuote({
      buyerSubject: 'buyer:alpha',
      quoteId: friday.quote_id,
      buyerName: 'Asha Rao',
      paymentTerm: 'deposit',
      confirmed: true,
      clock,
    });
    const second = await requestQuote({
      buyerSubject: 'buyer:beta',
      request: `We need a Bengaluru venue for a 120-person product launch on Friday, 2026-09-11, from 5 PM to 11 PM. We need theatre seating, a professional LED wall and PA, premium dinner with 30 Jain and 10 vegan meals, valet parking, and a branded stage. Keep the total under ₹2,20,000. We can pay a 40% deposit today.`,
      clock,
      adapter: new FakeModelAdapter(),
    });
    const colliding = second.options.find((o) => o.total_price === '19600000');
    if (colliding) {
      await expect(
        acceptQuote({
          buyerSubject: 'buyer:beta',
          quoteId: colliding.quote_id,
          buyerName: 'Dev Patel',
          paymentTerm: 'deposit',
          confirmed: true,
          clock,
        }),
      ).rejects.toMatchObject({ code: 'resource_conflict' });
    } else {
      expect(second.options.some((o) => o.total_price === '19600000')).toBe(false);
    }

    await resetDemo(db, clock);
    const fresh = await requestQuote({
      buyerSubject: 'buyer:gamma',
      request: `We need a Bengaluru venue for a 120-person product launch on Friday, 2026-09-11, from 5 PM to 11 PM. We need theatre seating, a professional LED wall and PA, premium dinner with 30 Jain and 10 vegan meals, valet parking, and a branded stage. Keep the total under ₹2,20,000. We can pay a 40% deposit today.`,
      clock,
      adapter: new FakeModelAdapter(),
    });
    const expiredClock = new FrozenClock(new Date('2026-09-07T12:00:00+05:30'));
    await expect(
      acceptQuote({
        buyerSubject: 'buyer:gamma',
        quoteId: fresh.options[0]!.quote_id,
        buyerName: 'Dev Patel',
        paymentTerm: 'deposit',
        confirmed: true,
        clock: expiredClock,
      }),
    ).rejects.toMatchObject({ code: 'quote_expired' });
  });

  it('ignores duplicate and out-of-order webhooks after paid', async () => {
    await resetDemo(db, clock);
    resetFakePaymentProvider();
    const quoted = await requestQuote({
      buyerSubject: buyer,
      request: `We need a Bengaluru venue for a 120-person product launch on Friday, 2026-09-11, from 5 PM to 11 PM. We need theatre seating, a professional LED wall and PA, premium dinner with 30 Jain and 10 vegan meals, valet parking, and a branded stage. Keep the total under ₹2,20,000. We can pay a 40% deposit today.`,
      clock,
      adapter: new FakeModelAdapter(),
    });
    const thursday = quoted.options.find((o) => o.total_price === '20300000')!;
    const accepted = await acceptQuote({
      buyerSubject: buyer,
      quoteId: thursday.quote_id,
      buyerName: 'Asha Rao',
      paymentTerm: 'deposit',
      confirmed: true,
      clock,
    });
    const checkout = await createCheckout({
      buyerSubject: buyer,
      acceptanceId: accepted.acceptance_id,
      confirmed: true,
      clock,
    });
    const [link] = await db
      .select()
      .from(paymentLinks)
      .where(eq(paymentLinks.id, checkout.payment_link_id!))
      .limit(1);
    const paidBody = JSON.stringify({
      event: 'payment_link.paid',
      payload: {
        payment_link: { entity: { id: link.providerPaymentLinkId, reference_id: link.providerReferenceId } },
      },
    });
    const paidSig = createHmac('sha256', 'test-webhook-secret').update(paidBody).digest('hex');
    expect((await handleRazorpayWebhook(paidBody, paidSig)).status).toBe(200);
    expect((await handleRazorpayWebhook(paidBody, paidSig)).status).toBe(200);
    const [paid] = await db.select().from(paymentLinks).where(eq(paymentLinks.id, link.id));
    expect(paid.status).toBe('paid');

    const failedBody = JSON.stringify({
      event: 'payment.failed',
      payload: {
        payment_link: { entity: { id: link.providerPaymentLinkId, reference_id: link.providerReferenceId } },
      },
    });
    const failSig = createHmac('sha256', 'test-webhook-secret').update(failedBody).digest('hex');
    expect((await handleRazorpayWebhook(failedBody, failSig)).status).toBe(200);
    const [stillPaid] = await db.select().from(paymentLinks).where(eq(paymentLinks.id, link.id));
    expect(stillPaid.status).toBe('paid');
  });
});

