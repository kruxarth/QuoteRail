import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { isMerchantAuthenticated } from '@/server/auth/session';
import { demoResetEnabled, getEnv } from '@/env';
import { resetDemo } from '@/server/catalog/seed';
import { SystemClock } from '@/shared/clock';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!isMerchantAuthenticated(request.headers.get('cookie'))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!demoResetEnabled(getEnv())) {
    return NextResponse.json({ error: 'disabled' }, { status: 403 });
  }
  const result = await resetDemo(db, new SystemClock());
  return NextResponse.json(result);
}
