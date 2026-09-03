import { SystemClock } from '@/shared/clock';
import { acceptQuote } from '@/server/quotes/accept';
import {
  buyerSubjectFromTicket,
  enquireError,
  jsonResponse,
  optionsResponse,
  ticketFrom,
} from '@/server/quotes/public-http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const clock = new SystemClock();

export function OPTIONS() {
  return optionsResponse();
}

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const ticket = ticketFrom(request, body);
    if (!ticket) return jsonResponse({ error: 'unauthorized', message: 'Missing ticket' }, 401);
    const buyerSubject = await buyerSubjectFromTicket(ticket, id);
    const quoteId = typeof body.quote_id === 'string' ? body.quote_id : '';
    const buyerName = typeof body.buyer_name === 'string' ? body.buyer_name : 'Purchasing agent';
    const buyerEmail = typeof body.buyer_email === 'string' ? body.buyer_email : undefined;
    const paymentTerm = body.payment_term === 'full' ? 'full' : 'deposit';
    if (!quoteId) return jsonResponse({ error: 'invalid_input', message: 'quote_id is required' }, 400);
    if (body.confirmed !== true) {
      return jsonResponse({ error: 'invalid_input', message: 'Set confirmed: true to accept.' }, 400);
    }
    const result = await acceptQuote({
      buyerSubject,
      quoteId,
      buyerName,
      buyerEmail,
      paymentTerm,
      confirmed: true,
      clock,
    });
    return jsonResponse({
      ...result,
      ticket,
      next_action: 'POST /api/enquire/{rfq_id}/checkout with { ticket, acceptance_id, confirmed: true }',
    });
  } catch (error) {
    return enquireError(error);
  }
}
