import { createHmac, timingSafeEqual } from 'node:crypto';
import { getEnv } from '@/env';

const COOKIE = 'qr_merchant';

export function signSession(payload: string, secret: string): string {
  const sig = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifySession(token: string | undefined, secret: string): boolean {
  if (!token) return false;
  const idx = token.lastIndexOf('.');
  if (idx < 0) return false;
  const payload = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const expected = createHmac('sha256', secret).update(payload).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function cookieFlags(): string {
  const secure = getEnv().NODE_ENV === 'production' ? '; Secure' : '';
  return `Path=/; HttpOnly; SameSite=Lax${secure}`;
}

export function createMerchantCookie(): string {
  const env = getEnv();
  const exp = Date.now() + 24 * 60 * 60 * 1000;
  const payload = Buffer.from(JSON.stringify({ sub: 'merchant-admin', exp })).toString('base64url');
  const token = signSession(payload, env.SESSION_SIGNING_SECRET);
  return `${COOKIE}=${token}; ${cookieFlags()}; Max-Age=86400`;
}

export function clearMerchantCookie(): string {
  return `${COOKIE}=; ${cookieFlags()}; Max-Age=0`;
}

export function readMerchantCookie(cookieHeader: string | null): string | undefined {
  if (!cookieHeader) return undefined;
  const parts = cookieHeader.split(';').map((p) => p.trim());
  const found = parts.find((p) => p.startsWith(`${COOKIE}=`));
  return found?.slice(COOKIE.length + 1);
}

export function isMerchantAuthenticated(cookieHeader: string | null): boolean {
  const env = getEnv();
  const token = readMerchantCookie(cookieHeader);
  if (!verifySession(token, env.SESSION_SIGNING_SECRET)) return false;
  try {
    const payload = JSON.parse(Buffer.from(token!.split('.')[0], 'base64url').toString());
    return typeof payload.exp === 'number' && payload.exp > Date.now();
  } catch {
    return false;
  }
}

export function constantTimeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    timingSafeEqual(left, left);
    return false;
  }
  return timingSafeEqual(left, right);
}
