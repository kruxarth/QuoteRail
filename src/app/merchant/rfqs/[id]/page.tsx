import Link from 'next/link';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { isMerchantAuthenticated } from '@/server/auth/session';
import { merchantRfqDetail } from '@/server/quotes/merchant-queries';
import { RfqBrief } from '@/components/rfq-brief';
import { QuoteCard } from '@/components/quote-card';
import { PolicyVerdict } from '@/components/policy-verdict';
import { TransactionStatus } from '@/components/transaction-status';
import { LiveAudit } from '@/app/merchant/rfqs/[id]/live-audit';
import { ApprovalButton } from '@/app/merchant/rfqs/[id]/approval-button';
import { MerchantSignOut } from '@/app/merchant/sign-out';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { demoDates } from '@/server/availability/slots';
import { SystemClock } from '@/shared/clock';
import {
  enquiryHeadline,
  humanizePlanningFailures,
  parseEscalationAttempts,
  rfqStatusCopy,
  ruleLabel,
} from '@/server/quotes/rfq-story';

export default async function MerchantRfqPage({ params }: { params: Promise<{ id: string }> }) {
  const jar = await cookies();
  const header = jar.getAll().map((c) => `${c.name}=${c.value}`).join('; ');
  if (!isMerchantAuthenticated(header)) redirect('/merchant/login');
  const { id } = await params;
  const data = await merchantRfqDetail(id);
  if (!data) notFound();
  const latestEval = data.evaluations.at(-1);
  const story = rfqStatusCopy(data.rfq.status);
  const escalated = [...data.timeline].reverse().find((event) => event.eventType === 'agent.escalated');
  const attempts = parseEscalationAttempts(escalated?.summary);
  const dates = demoDates(new SystemClock());
  const rules = (latestEval?.ruleResults as Array<{
    id: string;
    passed: boolean;
    severity?: string;
    observed?: string;
    limit?: string;
    reason: string;
  }>) ?? [];
  const pendingApprovals = data.approvals.filter((approval) => approval.status === 'pending');
  const title = enquiryHeadline(data.rfq.sanitizedRequest || data.rfq.rawRequest, data.rfq.parsedRequirements);

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/merchant" className="text-sm text-slate-600 hover:underline">
          ← All enquiries
        </Link>
        <MerchantSignOut />
      </div>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-serif text-3xl font-normal tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {data.rfq.createdAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} · {data.rfq.id.slice(0, 8)}
          </p>
        </div>
        <Badge tone={story.tone} className="text-sm">
          {story.title}
        </Badge>
      </div>

      <Card className="mt-6 border-[var(--brand)]/25 bg-white">
        <CardHeader>
          <CardTitle>What you should do</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-relaxed">
          <p>{story.what}</p>
          {data.rfq.status === 'escalated' ? (
            <p className="rounded-md bg-amber-50 p-3 text-amber-950">
              {humanizePlanningFailures(
                attempts.flatMap((attempt) => attempt.blockers),
                dates,
              )}
            </p>
          ) : null}
          <p>
            <span className="font-medium">Next step: </span>
            {story.sellerNext}
          </p>
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="space-y-6">
          <RfqBrief
            raw={data.rfq.rawRequest}
            sanitized={data.rfq.sanitizedRequest}
            requirements={data.rfq.parsedRequirements}
          />
          <Card>
            <CardHeader>
              <CardTitle>{data.quotes.length > 0 ? 'Quoted packages' : 'What the agent tried'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {data.quotes.length > 0
                ? data.quotes.map((quote) => (
                    <QuoteCard
                      key={quote.id}
                      merchant
                      quote={quote}
                      items={data.items.filter((item) => item.quoteId === quote.id)}
                    />
                  ))
                : null}
              {attempts.length > 0 ? (
                <ul className="space-y-3">
                  {attempts.map((attempt) => (
                    <li key={attempt.name} className="rounded-lg border border-slate-200 p-3">
                      <p className="text-sm font-medium">{attempt.name}</p>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
                        {attempt.blockers.length ? (
                          attempt.blockers.map((rule) => <li key={rule}>{ruleLabel(rule)}</li>)
                        ) : (
                          <li>Blocked without a specific rule</li>
                        )}
                      </ul>
                    </li>
                  ))}
                </ul>
              ) : null}
              {data.quotes.length === 0 && attempts.length === 0 ? (
                <p className="text-sm text-slate-500">No packages were offered yet.</p>
              ) : null}
            </CardContent>
          </Card>
        </section>
        <section className="space-y-6">
          {rules.length > 0 || pendingApprovals.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Policy</CardTitle>
              </CardHeader>
              <CardContent>
                <PolicyVerdict
                  merchant
                  rules={rules}
                  emptyHint="No package was saved, so there is no policy snapshot. Reasons are listed under what the agent tried."
                />
                {pendingApprovals.map((approval) => (
                  <ApprovalButton key={approval.id} id={approval.id} />
                ))}
              </CardContent>
            </Card>
          ) : null}
          <Card>
            <CardHeader>
              <CardTitle>Payment</CardTitle>
            </CardHeader>
            <CardContent>
              <TransactionStatus link={data.link} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Activity</CardTitle>
              <a className="text-xs text-slate-600 underline" href={`/api/merchant/rfqs/${data.rfq.id}/export`}>
                Export JSON
              </a>
            </CardHeader>
            <CardContent>
              <LiveAudit
                rfqId={data.rfq.id}
                traceId={data.rfq.traceId}
                initial={data.timeline.map((event) => ({
                  id: event.id,
                  createdAt: event.createdAt.toISOString(),
                  eventType: event.eventType,
                  summary: event.summary,
                  actorType: event.actorType,
                  reason: event.reason,
                }))}
              />
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
