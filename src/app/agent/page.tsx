import { headers } from 'next/headers';
import { SystemClock } from '@/shared/clock';
import { demoDates } from '@/server/availability/slots';
import { getEnv } from '@/env';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CopyRfq } from '@/app/agent/copy-rfq';

export default async function AgentPage() {
  const env = getEnv();
  const dates = demoDates(new SystemClock());
  const host = (await headers()).get('host') ?? 'localhost:3000';
  const proto = env.APP_BASE_URL.startsWith('https') ? 'https' : 'http';
  const mcpUrl = `${env.APP_BASE_URL || `${proto}://${host}`}/api/mcp`;
  const rfq = `We need a Bengaluru venue for a 120-person product launch on Friday, ${dates.friday}, from 5 PM to 11 PM. We need theatre seating, a professional LED wall and PA, premium dinner with 30 Jain and 10 vegan meals, valet parking, and a branded stage. Keep the total under ₹2,20,000. We can pay a 40% deposit today.`;
  const snippet = `{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "mosaic": {
      "type": "remote",
      "url": "${mcpUrl}",
      "enabled": true,
      "oauth": false,
      "headers": {
        "Authorization": "Bearer {env:MOSAIC_BUYER_TOKEN}"
      },
      "timeout": 60000
    }
  }
}`;

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <p className="text-sm uppercase tracking-[0.2em] text-[var(--muted)]">Corporate bookings</p>
      <h1 className="mt-3 font-serif text-5xl leading-tight">Book Mosaic with the agent you already use.</h1>
      <p className="mt-5 text-lg text-[var(--muted)]">
        Send a brief. Mosaic returns packages with prices. You accept one and pay the deposit on Razorpay — card details
        stay on Razorpay.
      </p>

      <Card className="mt-12">
        <CardHeader>
          <CardTitle>Example brief</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-[var(--muted)]">
          <p>
            A 120-person Friday evening launch, under ₹2,20,000. Mosaic will offer a tighter Friday package, a Thursday
            premium, and the exact ask if it runs over budget.
          </p>
          <CopyRfq text={rfq} />
        </CardContent>
      </Card>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Connect OpenCode</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-[var(--muted)]">
            Point your purchasing agent at Mosaic. Set <code className="rounded bg-[var(--background)] px-1">MOSAIC_BUYER_TOKEN</code>{' '}
            to the token operations issued you.
          </p>
          <p>
            Endpoint{' '}
            <code className="rounded bg-[var(--background)] px-1 break-all">{mcpUrl}</code>
          </p>
          <pre className="overflow-auto rounded-xl bg-[#1c1914] p-4 text-xs text-amber-50">{snippet}</pre>
        </CardContent>
      </Card>
    </main>
  );
}
