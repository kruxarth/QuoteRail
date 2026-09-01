import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { isMerchantAuthenticated } from '@/server/auth/session';
import { merchantRfqDetail } from '@/server/quotes/merchant-queries';
import { RequestPanel } from '@/components/request-panel';
import { QuoteCard } from '@/components/quote-card';
import { PolicyVerdict } from '@/components/policy-verdict';
import { TransactionStatus } from '@/components/transaction-status';
import { LiveAudit } from '@/app/merchant/rfqs/[id]/live-audit';
import { ApprovalButton } from '@/app/merchant/rfqs/[id]/approval-button';

export default async function MerchantRfqPage({ params }: { params: Promise<{ id: string }> }) {
  const jar = await cookies();
  const header = jar.getAll().map((c) => `${c.name}=${c.value}`).join('; ');
  if (!isMerchantAuthenticated(header)) redirect('/merchant/login');
  const { id } = await params;
  const data = await merchantRfqDetail(id);
  if (!data) notFound();
  const latestEval = data.evaluations.at(-1);
  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <h1 className="text-2xl font-semibold">RFQ {data.rfq.id.slice(0, 8)}</h1>
      <p className="text-sm text-slate-500">Trace {data.rfq.traceId}</p>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="space-y-6">
          <RequestPanel
            raw={data.rfq.rawRequest}
            sanitized={data.rfq.sanitizedRequest}
            requirements={data.rfq.parsedRequirements}
          />
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Agent alternatives</h2>
            <div className="grid gap-4">
              {data.quotes.map((quote) => (
                <QuoteCard
                  key={quote.id}
                  merchant
                  quote={quote}
                  items={data.items.filter((item) => item.quoteId === quote.id)}
                />
              ))}
            </div>
          </div>
        </section>
        <section className="space-y-6">
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Policy verdict</h2>
            <PolicyVerdict merchant rules={(latestEval?.ruleResults as never) ?? []} />
            {data.approvals
              .filter((a) => a.status === 'pending')
              .map((approval) => (
                <ApprovalButton key={approval.id} id={approval.id} />
              ))}
          </div>
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Transaction</h2>
            <TransactionStatus link={data.link} />
          </div>
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Audit timeline</h2>
              <a className="text-xs underline" href={`/api/merchant/rfqs/${data.rfq.id}/export`}>
                Export JSON
              </a>
            </div>
            <LiveAudit
              rfqId={data.rfq.id}
              traceId={data.rfq.traceId}
              initial={data.timeline.map((e) => ({
                id: e.id,
                createdAt: e.createdAt.toISOString(),
                eventType: e.eventType,
                summary: e.summary,
                actorType: e.actorType,
                reason: e.reason,
              }))}
            />
          </div>
        </section>
      </div>
    </main>
  );
}
