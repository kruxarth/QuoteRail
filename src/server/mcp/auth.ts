import { createHash } from 'node:crypto';
import { getEnv } from '@/env';
import { constantTimeEqual } from '@/server/auth/session';

export function buyerSubjectFromToken(token: string): string {
  const digest = createHash('sha256').update(token).digest('hex').slice(0, 16);
  return `buyer:${digest}`;
}

export function verifyBuyerBearer(request: Request): { ok: true; token: string; subject: string } | { ok: false } {
  const header = request.headers.get('authorization') ?? request.headers.get('Authorization');
  if (!header || !header.toLowerCase().startsWith('bearer ')) return { ok: false };
  const token = header.slice(7).trim();
  const expected = getEnv().BUYER_MCP_TOKEN;
  if (!constantTimeEqual(token, expected)) return { ok: false };
  return { ok: true, token, subject: buyerSubjectFromToken(token) };
}
