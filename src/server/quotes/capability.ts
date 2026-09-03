import { createHash, randomBytes } from 'node:crypto';
import { DomainError } from '@/shared/result';

export const TICKET_HEX_LENGTH = 64;

export function issueCapability(): { ticket: string; subject: string } {
  const ticket = randomBytes(32).toString('hex');
  return { ticket, subject: subjectFromTicket(ticket) };
}

export function isCapabilityTicket(value: string): boolean {
  return /^[0-9a-f]{64}$/.test(value);
}

export function subjectFromTicket(ticket: string): string {
  if (!isCapabilityTicket(ticket)) {
    throw new DomainError('invalid_input', 'Invalid enquiry ticket', 400);
  }
  const digest = createHash('sha256').update(ticket).digest('hex');
  return `buyer:cap:${digest}`;
}
