import { SystemClock } from '@/shared/clock';
import { createCheckout } from '@/server/payments/service';
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
    await buyerSubjectFromTicket(ticket, id);
    const acceptanceId = typeof body.acceptance_id === 'string' ? body.acceptance_id : '';
    if (!acceptanceId) return jsonResponse({ error: 'invalid_input', message: 'acceptance_id is required' }, 400);
    if (body.confirmed !== true) {
      return jsonResponse({ error: 'invalid_input', message: 'Set confirmed: true to create checkout.' }, 400);
    }
    const buyerSubject = await buyerSubjectFromTicket(ticket, id);
    const result = await createCheckout({
      buyerSubject,
      acceptanceId,
      confirmed: true,
      clock,
    });
    return jsonResponse({
      ...result,
      ticket_note: 'Give the human the checkout_url. They pay on Razorpay. Do not collect card details.',
    });
  } catch (error) {
    return enquireError(error);
  }
}
