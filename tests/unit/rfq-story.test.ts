import { describe, expect, it } from 'vitest';
import {
  buyerNextAction,
  enquiryHeadline,
  humanizePlanningFailures,
  parseEscalationAttempts,
  rfqStatusCopy,
} from '@/server/quotes/rfq-story';

const SAMPLE =
  'Budget-preserving standard package: Blocked by MIN_BOOKING_LEAD_TIME_48H, REQUIRED_CAPABILITIES_SATISFIED, BUYER_RELAXATION_EXPLICIT [MIN_BOOKING_LEAD_TIME_48H,REQUIRED_CAPABILITIES_SATISFIED,BUYER_RELAXATION_EXPLICIT]; Feature-preserving Thursday package: Blocked by MIN_BOOKING_LEAD_TIME_48H [MIN_BOOKING_LEAD_TIME_48H]; Exact-specification package: Blocked by MIN_BOOKING_LEAD_TIME_48H [MIN_BOOKING_LEAD_TIME_48H]';

describe('merchant RFQ story', () => {
  it('parses blocked package attempts from the audit summary', () => {
    const attempts = parseEscalationAttempts(SAMPLE);
    expect(attempts).toHaveLength(3);
    expect(attempts[0]?.name).toBe('Budget-preserving standard package');
    expect(attempts[0]?.blockers).toEqual([
      'MIN_BOOKING_LEAD_TIME_48H',
      'REQUIRED_CAPABILITIES_SATISFIED',
      'BUYER_RELAXATION_EXPLICIT',
    ]);
    expect(attempts[1]?.name).toBe('Feature-preserving Thursday package');
  });

  it('explains lead-time escalations in English and tells the buyer not to continue', () => {
    const copy = humanizePlanningFailures(['MIN_BOOKING_LEAD_TIME_48H'], {
      friday: '2026-09-11',
      thursday: '2026-09-10',
    });
    expect(copy).toContain('48-hour');
    expect(copy).toContain('2026-09-11');
    expect(buyerNextAction('escalated')).toMatch(/new request_quote/);
    expect(rfqStatusCopy('escalated').title).toBe('Needs a person');
  });

  it('titles an enquiry from extracted requirements', () => {
    expect(
      enquiryHeadline('Find a Bengaluru venue', {
        event_type: 'product_launch',
        attendee_count: 120,
        requested_date: '2026-09-04',
      }),
    ).toBe('product launch · 120 guests · 2026-09-04');
  });
});
