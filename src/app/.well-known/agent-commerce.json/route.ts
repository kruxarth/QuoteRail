import { getEnv } from '@/env';
import { MERCHANT_CITY, MERCHANT_NAME, MAX_REQUEST_CHARS } from '@/shared/constants';
import { PUBLIC_MCP_TOOLS } from '@/server/mcp/tools';
import { jsonResponse, optionsResponse } from '@/server/quotes/public-http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function document(origin: string) {
  return {
    name: MERCHANT_NAME,
    city: MERCHANT_CITY,
    currency: 'INR',
    description:
      'Corporate venue in Bengaluru. Purchasing agents send a natural-language brief. No API token is required to enquire.',
    webmcp: {
      where:
        'This origin. Tools register on document.modelContext when the page is open in a WebMCP browser.',
      tools: [...PUBLIC_MCP_TOOLS],
      ticket:
        'After request_quote the tab stores the ticket and later site tools send it. Do not ask the human for MOSAIC_BUYER_TOKEN.',
    },
    enquire: {
      method: 'POST',
      url: `${origin}/api/enquire`,
      content_type: 'application/json',
      body: { request: 'Natural language event brief' },
      auth: 'none',
      note: 'HTTP fallback if the agent cannot use WebMCP site tools.',
    },
    ticket:
      'The response includes ticket. Send it as X-Mosaic-Ticket (or JSON ticket) on later continue, accept, and checkout calls. Do not ask the human for MOSAIC_BUYER_TOKEN.',
    continue: { method: 'POST', url: `${origin}/api/enquire/{rfq_id}` },
    read: { method: 'GET', url: `${origin}/api/enquire/{rfq_id}?ticket=` },
    accept: { method: 'POST', url: `${origin}/api/enquire/{rfq_id}/accept` },
    checkout: { method: 'POST', url: `${origin}/api/enquire/{rfq_id}/checkout` },
    mcp: `${origin}/api/mcp`,
    mcp_auth: 'Optional. Bearer is only for a saved buyer connector. Enquire works without it.',
    max_request_chars: MAX_REQUEST_CHARS,
    payment:
      'Card details are entered only on Razorpay. Mosaic never collects payment credentials.',
  };
}

function originFrom(request: Request): string {
  const env = getEnv();
  if (env.APP_BASE_URL) return env.APP_BASE_URL.replace(/\/$/, '');
  const host = request.headers.get('host') ?? 'localhost:3000';
  const proto = host.includes('localhost') ? 'http' : 'https';
  return `${proto}://${host}`;
}

export function GET(request: Request) {
  return jsonResponse(document(originFrom(request)));
}

export function OPTIONS() {
  return optionsResponse();
}
