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
  const hasBearer = Boolean(request.headers.get('authorization') ?? request.headers.get('Authorization'));
  const auth = verifyBuyerBearer(request);
  if (hasBearer && !auth.ok) {
    await recordAttempt('mcp', forwarded, false);
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }
  if (auth.ok) await recordAttempt('mcp', forwarded, true);
  const subject = auth.ok ? auth.subject : '';
  return handler.fetch(request, {
    authInfo: {
      token: auth.ok ? auth.token : '',
      clientId: subject || 'buyer:anonymous',
      scopes: ['buyer'],
      extra: { subject, anonymous: !auth.ok },
    },
  });
}

export { handle, handle as GET, handle as POST, handle as DELETE };
