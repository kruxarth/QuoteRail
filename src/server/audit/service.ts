import { auditEvents } from '@/db/schema';
import type { Database, Transaction } from '@/db/client';
import { createId } from '@/shared/ids';
import type { AuditEventType } from '@/shared/constants';
import { redactValue } from '@/server/audit/redact';

export type AuditInput = {
  traceId: string;
  actorType: 'buyer' | 'merchant' | 'model' | 'policy' | 'system' | 'razorpay';
  actorId?: string | null;
  eventType: AuditEventType | string;
  entityType: string;
  entityId: string;
  summary: string;
  reason?: string | null;
  input?: unknown;
  output?: unknown;
  ruleIds?: string[];
};

export async function appendAudit(db: Database | Transaction, input: AuditInput) {
  const row = {
    id: createId(),
    traceId: input.traceId,
    actorType: input.actorType,
    actorId: input.actorId ?? null,
    eventType: input.eventType,
    entityType: input.entityType,
    entityId: input.entityId,
    summary: input.summary,
    reason: input.reason ?? null,
    inputRedacted: redactValue(input.input) ?? null,
    outputRedacted: redactValue(input.output) ?? null,
    ruleIds: input.ruleIds ?? [],
  };
  await db.insert(auditEvents).values(row);
  return row;
}
