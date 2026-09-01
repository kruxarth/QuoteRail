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
    "quoterail": {
      "type": "remote",
      "url": "${mcpUrl}",
      "enabled": true,
      "oauth": false,
      "headers": {
        "Authorization": "Bearer {env:QUOTERAIL_BUYER_TOKEN}"
      },
      "timeout": 60000
    }
  }
}`;

  return (
    <main className="mx-auto max-w-3xl px-6 py-12 space-y-8">
      <div>
        <h1 className="text-3xl font-semibold">Bring your existing AI agent</h1>
        <p className="mt-3 text-slate-600">
          QuoteRail does not ship a buyer-side agent. Connect OpenCode (or any Streamable HTTP MCP client) with the
          demo bearer token configured out of band. Payment credentials are entered only on Razorpay.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>MCP endpoint</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            URL: <code className="rounded bg-slate-100 px-1">{mcpUrl}</code>
          </p>
          <p>
            Token placeholder: <code className="rounded bg-slate-100 px-1">QUOTERAIL_BUYER_TOKEN</code>
          </p>
          <p className="text-slate-500">The production page never renders the real bearer token.</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>OpenCode remote MCP</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="overflow-auto rounded-md bg-slate-950 p-4 text-xs text-slate-100">{snippet}</pre>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Locked demo RFQ</CardTitle>
        </CardHeader>
        <CardContent>
          <CopyRfq text={rfq} />
        </CardContent>
      </Card>
    </main>
  );
}
