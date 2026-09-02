import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatInr } from '@/shared/money';

export function QuoteCard({
  quote,
  items,
  merchant = false,
}: {
  quote: {
    id: string;
    status: string;
    totalPrice: bigint;
    totalCost?: bigint;
    depositAmount: bigint;
    grossMarginBps?: number;
    rationale: string;
    tradeoffs: Array<{ constraint: string; reason: string }>;
    eventStartsAt: Date;
    attendeeCount: number;
  };
  items: Array<{ code: string; name: string; quantity: number; linePrice: bigint; lineCost?: bigint }>;
  merchant?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">
          <Link href={`/quote/${quote.id}`} className="hover:underline">
            {quote.eventStartsAt.toLocaleString('en-IN', {
              timeZone: 'Asia/Kolkata',
              weekday: 'short',
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Link>
        </CardTitle>
        <Badge
          tone={
            quote.status === 'accepted' ? 'ok' : quote.status === 'offered' ? 'info' : quote.status === 'superseded' ? 'neutral' : 'warn'
          }
        >
          {quote.status}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p>{quote.attendeeCount} guests</p>
        <ul className="space-y-1">
          {items.map((item) => (
            <li key={item.code} className="flex justify-between">
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
        <div className="flex justify-between text-slate-600">
          <span>40% deposit</span>
          <span>{formatInr(quote.depositAmount)}</span>
        </div>
        {merchant && quote.totalCost !== undefined && (
          <p className="text-xs text-slate-500">
            Cost {formatInr(quote.totalCost)} · margin {quote.grossMarginBps} bps
          </p>
        )}
        <p>{quote.rationale}</p>
        {quote.tradeoffs?.length ? (
          <ul className="list-disc pl-4 text-xs text-slate-600">
            {quote.tradeoffs.map((t) => (
              <li key={t.constraint}>
                <strong>{t.constraint}:</strong> {t.reason}
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
