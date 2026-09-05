import { SystemClock } from '@/shared/clock';
import { jsonResponse, optionsResponse } from '@/server/quotes/public-http';
import { merchantProfilePublic } from '@/server/quotes/venue-catalog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const clock = new SystemClock();

export function OPTIONS() {
  return optionsResponse();
}

export function GET() {
  return jsonResponse(merchantProfilePublic(clock));
}
