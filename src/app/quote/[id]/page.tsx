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
    <main className="mx-auto max-w-3xl px-6 py-16">
      <p className="text-sm uppercase tracking-[0.2em] text-[var(--muted)]">Mosaic Events · Indiranagar</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="font-serif text-4xl">Proposal</h1>
        <Badge>{quote.status}</Badge>
      </div>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Valid until {quote.expiresAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
      </p>
      <Card className="mt-8">
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
            <span>40% deposit due now</span>
            <span>{formatInr(quote.depositAmount)}</span>
          </div>
          <p className="pt-2">{quote.rationale}</p>
          {quote.tradeoffs.length > 0 ? (
            <ul className="list-disc pl-4 text-[var(--muted)]">
              {quote.tradeoffs.map((t) => (
                <li key={t.constraint}>
                  {t.constraint}: {t.reason}
                </li>
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>
      {link?.shortUrl ? (
        <p className="mt-8 text-sm">
          Deposit is ready.{' '}
          <a className="underline" href={link.shortUrl}>
            Continue on Razorpay
          </a>
          .
        </p>
      ) : (
        <p className="mt-8 text-sm text-[var(--muted)]">
          Review only. Confirm the package and pay the deposit from your purchasing agent.
        </p>
      )}
    </main>
  );
}
