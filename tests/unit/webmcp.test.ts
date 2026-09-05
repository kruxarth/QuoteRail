import { describe, expect, it } from 'vitest';
import { idsFromPayload } from '@/lib/webmcp';
import { filterOfferings, merchantProfilePublic } from '@/server/quotes/venue-catalog';
import { FrozenClock } from '@/shared/clock';
import { FROZEN_TEST_NOW } from '@/shared/constants';
import { PUBLIC_MCP_TOOLS } from '@/server/mcp/tools';

describe('WebMCP session ids', () => {
  it('keeps the ticket and first quote id from an enquire payload', () => {
    const ticket = 'a'.repeat(64);
    expect(
      idsFromPayload({
        ticket,
        rfq_id: 'rfq-1',
        options: [{ quote_id: 'quote-1' }],
      }),
    ).toEqual({
      ticket,
      rfqId: 'rfq-1',
      quoteId: 'quote-1',
    });
  });

  it('ignores a truncated ticket', () => {
    expect(idsFromPayload({ ticket: 'abcd', rfq_id: 'rfq-1' })).toEqual({ rfqId: 'rfq-1' });
  });
});

describe('venue catalog', () => {
  it('exposes the locked site tools on the public profile', () => {
    const profile = merchantProfilePublic(new FrozenClock(new Date(FROZEN_TEST_NOW)));
    expect(profile.site_tools).toEqual([...PUBLIC_MCP_TOOLS]);
    expect(profile.demo_friday).toBe('2026-09-11');
    expect(profile.how_to_book).toMatch(/site tools/i);
  });

  it('filters halls by attendee count and query', () => {
    const rows = [
      {
        name: 'Grand Hall',
        description: 'One hundred and eighty',
        category: 'hall',
        capabilities: ['stage'],
        capacityUnits: 180,
      },
      {
        name: 'Studio Hall',
        description: 'Closer rooms',
        category: 'hall',
        capabilities: [],
        capacityUnits: 120,
      },
      {
        name: 'Valet',
        description: 'Cars',
        category: 'service',
        capabilities: [],
        capacityUnits: null,
      },
    ];
    expect(filterOfferings(rows, { attendee_count: 150 }).map((row) => row.name)).toEqual([
      'Grand Hall',
      'Valet',
    ]);
    expect(filterOfferings(rows, { query: 'studio' }).map((row) => row.name)).toEqual([
      'Studio Hall',
    ]);
  });
});
