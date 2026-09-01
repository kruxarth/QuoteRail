import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { approvals, quotes } from '@/db/schema';
import { isMerchantAuthenticated } from '@/server/auth/session';
import { appendAudit } from '@/server/audit/service';

export const runtime = 'nodejs';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isMerchantAuthenticated(request.headers.get('cookie'))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { id } = await context.params;
  const body = (await request.json()) as { decision: 'approved' | 'rejected'; note?: string };
  const [approval] = await db.select().from(approvals).where(eq(approvals.id, id)).limit(1);
  if (!approval) return NextResponse.json({ error: 'not found' }, { status: 404 });
  await db
    .update(approvals)
    .set({
      status: body.decision,
      decidedAt: new Date(),
      decidedBy: 'merchant-admin',
      decisionNote: body.note ?? null,
    })
    .where(eq(approvals.id, id));
  if (body.decision === 'approved') {
    await db.update(quotes).set({ status: 'offered', updatedAt: new Date() }).where(eq(quotes.id, approval.quoteId));
  } else {
    await db.update(quotes).set({ status: 'cancelled', updatedAt: new Date() }).where(eq(quotes.id, approval.quoteId));
  }
  await appendAudit(db, {
    traceId: approval.quoteId,
    actorType: 'merchant',
    actorId: 'merchant-admin',
    eventType: body.decision === 'approved' ? 'approval.approved' : 'approval.rejected',
    entityType: 'approval',
    entityId: approval.id,
    summary: `Approval ${body.decision}`,
  });
  return NextResponse.json({ ok: true });
}
