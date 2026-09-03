import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { rfqs } from '@/db/schema';
import { getEnv } from '@/env';
import { DomainError } from '@/shared/result';
import { subjectFromTicket } from '@/server/quotes/capability';

export async function buyerSubjectFromTicket(ticket: string, rfqId?: string): Promise<string> {
  const subject = subjectFromTicket(ticket);
  if (!rfqId) return subject;
  const [rfq] = await db.select().from(rfqs).where(eq(rfqs.id, rfqId)).limit(1);
  if (!rfq || rfq.buyerSubject !== subject) {
    throw new DomainError('not_found', 'RFQ not found', 404);
  }
  return subject;
}

export function parseBrief(body: unknown, fallbackText = ''): string {
  if (typeof body === 'string') return body.trim();
  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>;
    for (const key of ['request', 'brief', 'message', 'text', 'answers']) {
      const value = record[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
  }
  return fallbackText.trim();
}

export async function readBrief(request: Request): Promise<string> {
  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    try {
      return parseBrief(await request.json());
    } catch {
      return '';
    }
  }
  return parseBrief(await request.text());
}

export function ticketFrom(request: Request, body?: Record<string, unknown>): string | undefined {
  const header = request.headers.get('x-mosaic-ticket')?.trim();
  if (header) return header;
  const query = new URL(request.url).searchParams.get('ticket')?.trim();
  if (query) return query;
  const fromBody = body?.ticket;
  if (typeof fromBody === 'string') return fromBody.trim();
  return undefined;
}

export function corsHeaders(): HeadersInit {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Mosaic-Ticket',
    'Access-Control-Max-Age': '86400',
  };
}

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...corsHeaders() },
  });
}

export function optionsResponse(): Response {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export function clientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'local';
}

export function absoluteUrl(path: string, origin: string): string | undefined {
  if (!path) return undefined;
  if (path.startsWith('http')) return path;
  return `${origin.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}

export function enquireError(error: unknown): Response {
  if (error instanceof DomainError) {
    return jsonResponse({ error: error.code, message: error.message }, error.status);
  }
  return jsonResponse({ error: 'error', message: 'Request failed' }, 500);
}

export function originFrom(request: Request): string {
  const env = getEnv().APP_BASE_URL?.replace(/\/$/, '');
  if (env) return env;
  const host = request.headers.get('host') ?? 'localhost:3000';
  return `${host.includes('localhost') ? 'http' : 'https'}://${host}`;
}
