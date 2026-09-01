import { NextResponse } from 'next/server';
import { constantTimeEqual, createMerchantCookie } from '@/server/auth/session';
import { rateLimit, recordAttempt } from '@/server/auth/rate-limit';
import { getEnv } from '@/env';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  if (!(await rateLimit('login', ip, 5, 15 * 60_000))) {
    return NextResponse.json({ error: 'Too many attempts' }, { status: 429 });
  }
  const body = (await request.json()) as { password?: string };
  const ok = constantTimeEqual(body.password ?? '', getEnv().MERCHANT_ADMIN_PASSWORD);
  await recordAttempt('login', ip, ok);
  if (!ok) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  const response = NextResponse.json({ ok: true });
  response.headers.set('Set-Cookie', createMerchantCookie());
  return response;
}
