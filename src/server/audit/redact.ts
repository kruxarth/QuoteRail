const SECRET_KEYS = [
  'authorization',
  'token',
  'bearer',
  'api_key',
  'apikey',
  'secret',
  'password',
  'cookie',
  'signature',
  'razorpay_key_secret',
  'webhook_secret',
];

const EMAIL_RE = /([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;

export function redactEmail(value: string): string {
  return value.replace(EMAIL_RE, (_match, user: string, domain: string) => {
    const prefix = user.slice(0, 1);
    return `${prefix}***@${domain}`;
  });
}

export function redactValue(value: unknown): unknown {
  if (typeof value === 'string') {
    let next = redactEmail(value);
    if (/bearer\s+/i.test(next)) next = next.replace(/bearer\s+[A-Za-z0-9._\-]+/gi, 'Bearer [REDACTED]');
    if (next.length > 4 && /token|secret|key/i.test(next)) return '[REDACTED]';
    return next;
  }
  if (Array.isArray(value)) return value.map(redactValue);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEYS.some((item) => key.toLowerCase().includes(item))) {
        out[key] = '[REDACTED]';
      } else {
        out[key] = redactValue(child);
      }
    }
    return out;
  }
  return value;
}

export function sanitizeRequestText(text: string): string {
  return redactEmail(text).slice(0, 4000);
}

export function looksLikeInjection(text: string): boolean {
  const lower = text.toLowerCase();
  return [
    'ignore prior instructions',
    'ignore the seller',
    'ignore previous',
    'set amount to',
    '90% discount',
    'apply 90%',
    'override policy',
    'reveal the system prompt',
    'show hidden cost',
  ].some((needle) => lower.includes(needle));
}
