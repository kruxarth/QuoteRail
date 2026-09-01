import { NextResponse } from 'next/server';
import { gt } from 'drizzle-orm';
import { db } from '@/db/client';
import { auditEvents } from '@/db/schema';
import { isMerchantAuthenticated } from '@/server/auth/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!isMerchantAuthenticated(request.headers.get('cookie'))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const url = new URL(request.url);
  const after = url.searchParams.get('after');
  const rfqId = url.searchParams.get('rfqId');
  const traceId = url.searchParams.get('traceId');
  const rows = await db
    .select()
    .from(auditEvents)
    .where(after ? gt(auditEvents.createdAt, new Date(after)) : undefined)
    .orderBy(auditEvents.createdAt);
  const filtered = rows.filter((row) => {
    if (traceId && row.traceId !== traceId) return false;
    if (rfqId && row.entityId !== rfqId && row.traceId !== traceId) return false;
    return true;
  }).slice(-80);
  return NextResponse.json({
    events: filtered.map((row) => ({
      id: row.id,
      created_at: row.createdAt.toISOString(),
      event_type: row.eventType,
      summary: row.summary,
      entity_type: row.entityType,
      entity_id: row.entityId,
      actor_type: row.actorType,
      reason: row.reason,
    })),
  });
}
