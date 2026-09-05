import { jsonResponse, optionsResponse, enquireError } from '@/server/quotes/public-http';
import { searchVenueServices } from '@/server/quotes/venue-catalog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function OPTIONS() {
  return optionsResponse();
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const attendee = url.searchParams.get('attendee_count');
    const attendeeCount = attendee ? Number(attendee) : undefined;
    if (attendee && (!Number.isInteger(attendeeCount) || Number(attendeeCount) < 1)) {
      return jsonResponse(
        { error: 'invalid_input', message: 'attendee_count must be a positive integer' },
        400,
      );
    }
    const categories = url.searchParams
      .get('categories')
      ?.split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    const capabilities = url.searchParams
      .get('capabilities')
      ?.split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    const result = await searchVenueServices({
      query: url.searchParams.get('query')?.trim() || undefined,
      categories: categories?.length ? categories : undefined,
      capabilities: capabilities?.length ? capabilities : undefined,
      attendee_count: attendeeCount,
      requested_date: url.searchParams.get('requested_date')?.trim() || undefined,
    });
    return jsonResponse(result);
  } catch (error) {
    return enquireError(error);
  }
}
