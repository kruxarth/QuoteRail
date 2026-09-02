import { Badge } from '@/components/ui/badge';
import { formatInr } from '@/shared/money';

export function TransactionStatus({
  link,
}: {
  link?: {
    status: string;
    amount: bigint;
    failureCount: number;
    shortUrl?: string | null;
    lastFailureCode?: string | null;
  } | null;
}) {
  if (!link) {
    return (
      <p className="text-sm text-slate-500">
        No Razorpay checkout. A deposit link is created only after the buyer accepts a quoted package.
      </p>
    );
  }
  const tone =
    link.status === 'paid' ? 'ok' : link.status === 'issued' ? 'warn' : link.status === 'stopped' || link.status === 'error' ? 'danger' : 'neutral';
  return (
    <div className="space-y-2 text-sm">
      <Badge tone={tone}>{link.status}</Badge>
      <p>Amount due {formatInr(link.amount)}</p>
      <p>Failed attempts {link.failureCount}</p>
      {link.lastFailureCode ? <p>Last failure {link.lastFailureCode}</p> : null}
      {link.shortUrl && link.status === 'issued' ? (
        <a className="text-[var(--brand)] underline" href={link.shortUrl} rel="noreferrer">
          Open Razorpay hosted page
        </a>
      ) : null}
    </div>
  );
}
