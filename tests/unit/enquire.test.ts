import { describe, expect, it } from 'vitest';
import { issueCapability, subjectFromTicket, isCapabilityTicket } from '@/server/quotes/capability';
import { parseBrief } from '@/server/quotes/public-http';

describe('enquiry tickets', () => {
  it('hashes a ticket into a stable buyer subject without storing the secret', () => {
    const { ticket, subject } = issueCapability();
    expect(ticket).toHaveLength(64);
    expect(isCapabilityTicket(ticket)).toBe(true);
    expect(subject).toBe(subjectFromTicket(ticket));
    expect(subject.startsWith('buyer:cap:')).toBe(true);
    expect(subjectFromTicket(ticket)).not.toBe(ticket);
  });

  it('rejects a truncated ticket', () => {
    expect(() => subjectFromTicket('abcd')).toThrow(/Invalid enquiry ticket/);
  });
});

describe('enquire body parsing', () => {
  it('accepts request, brief, message, or raw text', () => {
    expect(parseBrief({ request: '  hall for 80  ' })).toBe('hall for 80');
    expect(parseBrief({ brief: 'evening Friday' })).toBe('evening Friday');
    expect(parseBrief({ message: 'Bangalore' })).toBe('Bangalore');
    expect(parseBrief('plain text brief')).toBe('plain text brief');
  });
});
