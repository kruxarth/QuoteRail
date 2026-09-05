import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { offerings } from '@/db/schema';
import { MERCHANT_ID } from '@/server/catalog/seed';
import { demoDates } from '@/server/availability/slots';
import { PUBLIC_MCP_TOOLS } from '@/server/mcp/tools';
import type { Clock } from '@/shared/clock';
import { MERCHANT_CITY, MERCHANT_NAME, OFFER_VALIDITY_MINUTES } from '@/shared/constants';

export function merchantProfilePublic(clock: Clock) {
  const dates = demoDates(clock);
  return {
    name: MERCHANT_NAME,
    city: MERCHANT_CITY,
    currency: 'INR',
    quote_validity_minutes: OFFER_VALIDITY_MINUTES,
    payment_terms: ['deposit', 'full'] as const,
    deposit: '40% of the accepted full quote total',
    halls: ['Grand Hall (180)', 'Studio Hall (120)'],
    services: ['AV', 'catering', 'valet', 'branded stage', 'event operations'],
    demo_friday: dates.friday,
    site_tools: [...PUBLIC_MCP_TOOLS],
    how_to_book:
      'You are already on Mosaic Events. Use the site tools in this tab. Call request_quote with a natural-language brief. Do not invent HTTP GET or POST. Do not ask the human for MOSAIC_BUYER_TOKEN. After accept_quote, call create_checkout and give the human checkout_url. Card details stay on Razorpay.',
  };
}

export type VenueSearchInput = {
  query?: string;
  categories?: string[];
  capabilities?: string[];
  attendee_count?: number;
  requested_date?: string;
};

export function filterOfferings<
  T extends {
    name: string;
    description: string;
    category: string;
    capabilities: string[];
    capacityUnits: number | null;
  },
>(rows: T[], input: VenueSearchInput): T[] {
  return rows.filter((row) => {
    if (input.categories?.length && !input.categories.includes(row.category)) return false;
    if (
      input.query &&
      !`${row.name} ${row.description}`.toLowerCase().includes(input.query.toLowerCase())
    ) {
      return false;
    }
    if (
      input.attendee_count &&
      row.category === 'hall' &&
      (row.capacityUnits ?? 0) < input.attendee_count
    ) {
      return false;
    }
    return true;
  });
}

export async function searchVenueServices(input: VenueSearchInput) {
  const rows = await db.select().from(offerings).where(eq(offerings.merchantId, MERCHANT_ID));
  return {
    services: filterOfferings(rows, input).map((row) => ({
      code: row.code,
      name: row.name,
      category: row.category,
      capabilities: row.capabilities,
      capacity_label: row.capacityLabel,
    })),
    availability_note: 'Date availability is advisory until atomic acceptance.',
  };
}
