import { handleRazorpayWebhook } from '@/server/webhooks/handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const raw = await request.text();
  const signature = request.headers.get('x-razorpay-signature');
  return handleRazorpayWebhook(raw, signature);
}
