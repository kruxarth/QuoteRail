import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { auditEvents, rfqs } from '@/db/schema';
import { isMerchantAuthenticated } from '@/server/auth/session';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isMerchantAuthenticated(request.headers.get('cookie'))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { id } = await context.params;
  const [rfq] = await db.select().from(rfqs).where(eq(rfqs.id, id)).limit(1);
  if (!rfq) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const events = await db.select().from(auditEvents).where(eq(auditEvents.traceId, rfq.traceId));
  return NextResponse.json({ rfq_id: rfq.id, trace_id: rfq.traceId, events });
}
