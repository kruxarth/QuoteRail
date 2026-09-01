import 'dotenv/config';
import { mkdirSync, writeFileSync } from 'node:fs';
import { getEnv, fakePaymentsEnabled } from '@/env';
import { RazorpayPaymentProvider } from '@/server/payments/razorpay';

function redactId(value: string): string {
  if (value.length <= 10) return `${value.slice(0, 4)}…`;
  return `${value.slice(0, 8)}…${value.slice(-4)}`;
}

async function main() {
  const env = getEnv();
  if (fakePaymentsEnabled(env) || !env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    throw new Error('Razorpay spike requires test keys and FAKE_PAYMENTS=false');
  }
  if (!env.RAZORPAY_KEY_ID.startsWith('rzp_test_')) {
    throw new Error('Refusing to run spike against a non-test Razorpay key');
  }

  const provider = new RazorpayPaymentProvider();
  const referenceId = `qr_spike_${Date.now().toString(36)}`;
  const expireBy = new Date(Date.now() + 60 * 60 * 1000);
  const created = await provider.createLink({
    amount: 100n,
    currency: 'INR',
    referenceId,
    description: 'QuoteRail Razorpay test-mode spike (₹1)',
    expireBy,
  });
  const fetched = await provider.fetchLink(created.id);

  const envAuth = Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString('base64');
  const listResponse = await fetch(
    `https://api.razorpay.com/v1/payment_links?reference_id=${encodeURIComponent(referenceId)}`,
    { headers: { Authorization: `Basic ${envAuth}` } },
  );
  const listBody = (await listResponse.json()) as Record<string, unknown>;
  const listKeys = Object.keys(listBody).sort();
  let referenceLookup: 'unique' | 'missing' | 'not_unique' | 'unsupported' = 'missing';
  try {
    const byRef = await provider.findByReferenceId(referenceId);
    if (byRef?.id === created.id) referenceLookup = 'unique';
    else if (!byRef) referenceLookup = 'missing';
  } catch {
    referenceLookup = 'unsupported';
  }
  await provider.cancelLink(created.id);
  const afterCancel = await provider.fetchLink(created.id);

  const report = {
    ok: true,
    mode: 'test',
    key_id_prefix: env.RAZORPAY_KEY_ID.slice(0, 12),
    created: {
      id: redactId(created.id),
      reference_id_prefix: referenceId.slice(0, 12),
      amount: created.amount.toString(),
      currency: created.currency,
      status: created.status,
      short_url_host: created.shortUrl ? new URL(created.shortUrl).host : null,
    },
    fetched_status: fetched?.status ?? null,
    list_http_status: listResponse.status,
    list_keys: listKeys,
    list_entity: typeof listBody.entity === 'string' ? listBody.entity : null,
    list_count: typeof listBody.count === 'number' ? listBody.count : null,
    reference_lookup: referenceLookup,
    cancelled_status: afterCancel?.status ?? null,
    create_timeout_strategy:
      referenceLookup === 'unique'
        ? 'reconcile by GET /payment_links?reference_id='
        : 'manual_reconciliation_required',
    generated_at: new Date().toISOString(),
  };
  mkdirSync('docs/fixtures', { recursive: true });
  writeFileSync('docs/fixtures/razorpay-spike.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
