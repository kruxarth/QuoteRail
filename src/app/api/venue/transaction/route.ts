import { readPaymentStatus } from '@/server/quotes/payment-status';
import {
  buyerSubjectFromTicket,
  enquireError,
  jsonResponse,
  optionsResponse,
  ticketFrom,
} from '@/server/quotes/public-http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function OPTIONS() {
  return optionsResponse();
}

export async function GET(request: Request) {
  try {
    const ticket = ticketFrom(request);
    if (!ticket) return jsonResponse({ error: 'unauthorized', message: 'Missing ticket' }, 401);
    const url = new URL(request.url);
    const buyerSubject = await buyerSubjectFromTicket(ticket);
    const result = await readPaymentStatus({
      buyerSubject,
      acceptanceId: url.searchParams.get('acceptance_id')?.trim() || undefined,
      paymentLinkId: url.searchParams.get('payment_link_id')?.trim() || undefined,
    });
    return jsonResponse(result);
  } catch (error) {
    return enquireError(error);
  }
}
