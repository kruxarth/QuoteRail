import { redactValue } from '@/server/audit/redact';

export function logEvent(event: string, fields: Record<string, unknown> = {}): void {
  const redacted = redactValue(fields) as Record<string, unknown>;
  console.info(
    JSON.stringify({
      ts: new Date().toISOString(),
      service: 'quoterail',
      event,
      ...redacted,
    }),
  );
}
