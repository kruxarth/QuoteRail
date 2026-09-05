import { MAX_REQUEST_CHARS } from '@/shared/constants';
import { SystemClock } from '@/shared/clock';
import { rateLimit, recordAttempt } from '@/server/auth/rate-limit';
import { reviseQuote } from '@/server/quotes/rfq-service';
import {
  buyerSubjectFromTicket,
  clientIp,
  enquireError,
  jsonResponse,
  optionsResponse,
  parseBrief,
  ticketFrom,
} from '@/server/quotes/public-http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const clock = new SystemClock();

export function OPTIONS() {
  return optionsResponse();
}

export async function POST(request: Request) {
  const ip = clientIp(request);
  const allowed = await rateLimit('enquire', ip, 12, 60_000);
  if (!allowed) {
    await recordAttempt('enquire', ip, false);
    return jsonResponse(
      { error: 'rate_limited', message: 'Too many enquiries. Try again shortly.' },
      429,
    );
  }
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const ticket = ticketFrom(request, body);
    if (!ticket) return jsonResponse({ error: 'unauthorized', message: 'Missing ticket' }, 401);
    const quoteId = typeof body.quote_id === 'string' ? body.quote_id : '';
    if (!quoteId)
      return jsonResponse({ error: 'invalid_input', message: 'quote_id is required' }, 400);
    const revision = parseBrief(body);
    if (!revision)
      return jsonResponse({ error: 'invalid_input', message: 'request is required' }, 400);
    if (revision.length > MAX_REQUEST_CHARS) {
      return jsonResponse(
        { error: 'input_too_large', message: 'Request exceeds 4000 characters.' },
        400,
      );
    }
    const buyerSubject = await buyerSubjectFromTicket(ticket);
    const result = await reviseQuote({ buyerSubject, quoteId, request: revision, clock });
    await recordAttempt('enquire', ip, true);
    return jsonResponse({ ...result, ticket });
  } catch (error) {
    await recordAttempt('enquire', ip, false);
    return enquireError(error);
  }
}
