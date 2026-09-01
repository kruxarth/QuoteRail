import { createQuoteRailMcpHandler } from '@/server/mcp/handler';
import { verifyBuyerBearer } from '@/server/mcp/auth';
import { recordAttempt, rateLimit } from '@/server/auth/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const handler = createQuoteRailMcpHandler();

async function handle(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  const allowed = await rateLimit('mcp', forwarded, 120, 60_000);
  if (!allowed) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }
  const auth = verifyBuyerBearer(request);
  if (!auth.ok) {
    await recordAttempt('mcp', forwarded, false);
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }
  await recordAttempt('mcp', forwarded, true);
  return handler.fetch(request, {
    authInfo: {
      token: auth.token,
      clientId: auth.subject,
      scopes: ['buyer'],
      extra: { subject: auth.subject },
    },
  });
}

export { handle, handle as GET, handle as POST, handle as DELETE };
