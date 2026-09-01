import { and, eq, gte, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { authAttempts } from '@/db/schema';
import { createId } from '@/shared/ids';

export async function rateLimit(kind: string, subject: string, max: number, windowMs: number): Promise<boolean> {
  const since = new Date(Date.now() - windowMs);
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(authAttempts)
    .where(and(eq(authAttempts.kind, kind), eq(authAttempts.subject, subject), gte(authAttempts.createdAt, since)));
  const count = Number(rows[0]?.count ?? 0);
  return count < max;
}

export async function recordAttempt(kind: string, subject: string, succeeded: boolean) {
  await db.insert(authAttempts).values({
    id: createId(),
    kind,
    subject,
    succeeded,
  });
}
