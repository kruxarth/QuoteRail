import { MAX_REQUEST_CHARS } from '@/shared/constants';
import { SystemClock } from '@/shared/clock';
import { getRfqPublic, continueRfq } from '@/server/quotes/rfq-service';
import {
  absoluteUrl,
  buyerSubjectFromTicket,
  enquireError,
  jsonResponse,
  optionsResponse,
  originFrom,
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

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const ticket = ticketFrom(request);
    if (!ticket) return jsonResponse({ error: 'unauthorized', message: 'Missing ticket' }, 401);
    const buyerSubject = await buyerSubjectFromTicket(ticket, id);
    const result = await getRfqPublic({ buyerSubject, rfqId: id });
    const base = originFrom(request);
    return jsonResponse({
      ...result,
      public_quote_url: result.options[0] ? absoluteUrl(`/quote/${result.options[0].quote_id}`, base) : undefined,
    });
  } catch (error) {
    return enquireError(error);
  }
}

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const contentType = request.headers.get('content-type') ?? '';
    const body = contentType.includes('application/json') ? ((await request.json()) as Record<string, unknown>) : {};
    const ticket = ticketFrom(request, body);
    if (!ticket) return jsonResponse({ error: 'unauthorized', message: 'Missing ticket' }, 401);
    const buyerSubject = await buyerSubjectFromTicket(ticket, id);
    const answers = parseBrief(body, typeof body.answers === 'string' ? body.answers : '');
    if (answers.length > MAX_REQUEST_CHARS) {
      return jsonResponse({ error: 'input_too_large', message: 'Answers exceed 4000 characters.' }, 400);
    }
    const result = await continueRfq({ buyerSubject, rfqId: id, answers, clock });
    const base = originFrom(request);
    return jsonResponse({
      ...result,
      ticket,
      public_quote_url: result.public_quote_url ? absoluteUrl(result.public_quote_url, base) : undefined,
    });
  } catch (error) {
    return enquireError(error);
  }
}
