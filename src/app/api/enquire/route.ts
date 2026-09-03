import { getEnv } from '@/env';
import { MAX_REQUEST_CHARS } from '@/shared/constants';
import { SystemClock } from '@/shared/clock';
import { DomainError } from '@/shared/result';
import { rateLimit, recordAttempt } from '@/server/auth/rate-limit';
import { issueCapability } from '@/server/quotes/capability';
import { requestQuote } from '@/server/quotes/rfq-service';
import {
  absoluteUrl,
  clientIp,
  jsonResponse,
  optionsResponse,
  readBrief,
} from '@/server/quotes/public-http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const clock = new SystemClock();

function origin(request: Request): string {
  const base = getEnv().APP_BASE_URL?.replace(/\/$/, '');
  if (base) return base;
  const host = request.headers.get('host') ?? 'localhost:3000';
  return `${host.includes('localhost') ? 'http' : 'https'}://${host}`;
}

export function OPTIONS() {
  return optionsResponse();
}

export async function POST(request: Request) {
  const ip = clientIp(request);
  const allowed = await rateLimit('enquire', ip, 12, 60_000);
  if (!allowed) {
    await recordAttempt('enquire', ip, false);
    return jsonResponse({ error: 'rate_limited', message: 'Too many enquiries. Try again shortly.' }, 429);
  }
  const brief = await readBrief(request);
  if (!brief) {
    return jsonResponse(
      { error: 'invalid_input', message: 'Send JSON { "request": "your event brief" } or plain text.' },
      400,
    );
  }
  if (brief.length > MAX_REQUEST_CHARS) {
    return jsonResponse({ error: 'input_too_large', message: 'Brief exceeds 4000 characters.' }, 400);
  }
  try {
    const { ticket, subject } = issueCapability();
    const result = await requestQuote({ buyerSubject: subject, request: brief, clock });
    await recordAttempt('enquire', ip, true);
    const base = origin(request);
    return jsonResponse({
      ...result,
      ticket,
      public_quote_url: result.public_quote_url ? absoluteUrl(result.public_quote_url, base) : undefined,
      ticket_note:
        'Keep this ticket for this conversation. Send it as X-Mosaic-Ticket or JSON { "ticket": "..." } on continue, accept, and checkout. Do not ask the human for an API token.',
    });
  } catch (error) {
    await recordAttempt('enquire', ip, false);
    if (error instanceof DomainError) {
      return jsonResponse({ error: error.code, message: error.message }, error.status);
    }
    return jsonResponse({ error: 'error', message: 'Enquiry failed' }, 500);
  }
}
