import { NextResponse } from 'next/server';
import { clearMerchantCookie, isMerchantAuthenticated } from '@/server/auth/session';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!isMerchantAuthenticated(request.headers.get('cookie'))) {
    const response = NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    response.headers.set('Set-Cookie', clearMerchantCookie());
    return response;
  }
  const response = NextResponse.json({ ok: true });
  response.headers.set('Set-Cookie', clearMerchantCookie());
  return response;
}
