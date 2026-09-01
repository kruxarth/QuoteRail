import { notFound } from 'next/navigation';
import { publicQuote } from '@/server/quotes/merchant-queries';
import { formatInr } from '@/shared/money';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function PublicQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await publicQuote(id);
  if (!data) notFound();
  const { quote, items, link } = data;
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <p className="text-sm text-[var(--brand)]">Mosaic Events Bengaluru · QuoteRail</p>
      <div className="mt-2 flex items-center gap-3">
        <h1 className="text-2xl font-semibold">Quote {quote.id.slice(0, 8)}</h1>
        <Badge>{quote.status}</Badge>
      </div>
      <p className="mt-2 text-sm text-slate-500">
        Offer expires {quote.expiresAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
      </p>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Package</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            {quote.eventStartsAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} · {quote.attendeeCount} guests
          </p>
          <ul>
            {items.map((item) => (
              <li key={item.id} className="flex justify-between py-1">
                <span>
                  {item.name} × {item.quantity}
                </span>
                <span>{formatInr(item.linePrice)}</span>
              </li>
            ))}
          </ul>
          <div className="flex justify-between font-semibold">
            <span>Total</span>
            <span>{formatInr(quote.totalPrice)}</span>
          </div>
          <div className="flex justify-between">
            <span>40% deposit</span>
            <span>{formatInr(quote.depositAmount)}</span>
          </div>
          <p className="pt-2">{quote.rationale}</p>
          <ul className="list-disc pl-4 text-slate-600">
            {quote.tradeoffs.map((t) => (
              <li key={t.constraint}>
                {t.constraint}: {t.reason}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      {link?.shortUrl ? (
        <p className="mt-6 text-sm">
          An authenticated buyer already created checkout.{' '}
          <a className="underline" href={link.shortUrl}>
            Continue on Razorpay
          </a>
          . This page cannot accept quotes or create payment links.
        </p>
      ) : (
        <p className="mt-6 text-sm text-slate-500">
          This page is read-only. Accept the quote and create checkout from your MCP-capable buyer agent.
        </p>
      )}
    </main>
  );
}
