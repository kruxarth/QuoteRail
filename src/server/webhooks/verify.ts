import { createHmac, timingSafeEqual } from 'node:crypto';
import { sha256Hex } from '@/shared/hash';

export function verifyRazorpaySignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature || !secret) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const left = Buffer.from(expected);
  const right = Buffer.from(signature);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function webhookBodyHash(rawBody: string): string {
  return sha256Hex(rawBody);
}
