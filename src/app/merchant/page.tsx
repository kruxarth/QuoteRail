import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { isMerchantAuthenticated } from '@/server/auth/session';
import { hallCalendar, merchantDashboard } from '@/server/quotes/merchant-queries';
import { formatInr } from '@/shared/money';
import { Badge } from '@/components/ui/badge';
import { AvailabilityCalendar } from '@/components/availability-calendar';
import { demoResetEnabled, getEnv } from '@/env';
import { DemoReset } from '@/app/merchant/demo-reset';
import { enquiryDecision, enquiryHeadline, rfqStatusCopy } from '@/server/quotes/rfq-story';

export default async function MerchantDashboardPage() {
  const jar = await cookies();
  const header = jar
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');
  if (!isMerchantAuthenticated(header)) redirect('/merchant/login');
  const data = await merchantDashboard();
  const halls = await hallCalendar();

  return (
    <main className="mx-auto max-w-[1400px] px-6 py-10 md:px-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="kicker text-[var(--accent)]">Indiranagar floor</p>
          <h1 className="mt-3 font-serif text-4xl">Operations</h1>
        </div>
        {demoResetEnabled(getEnv()) ? <DemoReset /> : null}
      </div>

      <dl className="mt-8 grid grid-cols-2 border border-[var(--line)] sm:grid-cols-4">
        {[
          ['Open', String(data.kpis.activeEnquiries)],
          ['Quoted', formatInr(data.kpis.quotedValue)],
          ['Slots held', String(data.kpis.heldBookingUnits)],
          ['Deposits', formatInr(data.kpis.depositsPaid)],
        ].map(([label, value], i) => (
          <div key={label} className={`px-5 py-4 ${i > 0 ? 'border-l border-[var(--line)]' : ''}`}>
            <dt className="text-[11px] tracking-[0.16em] text-[var(--muted)] uppercase">{label}</dt>
            <dd className="mt-2 font-serif text-2xl">{value}</dd>
          </div>
        ))}
      </dl>

      <section className="mt-12">
        <h2 className="font-serif text-3xl">Hall availability</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Two weeks of mornings, afternoons, and evenings. Held means a quote is waiting on deposit.
        </p>
        <div className="mt-6">
          <AvailabilityCalendar halls={halls} />
        </div>
      </section>

      <section className="mt-14">
        <h2 className="font-serif text-3xl">Enquiries</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          What they asked, what Mosaic decided, where it stands.
        </p>
        {data.rfqs.length === 0 ? (
          <p className="mt-6 border border-dashed border-[var(--line)] px-5 py-8 text-sm text-[var(--muted)]">
            No enquiries yet. When an agent asks, the brief, the decision, and the status land in
            this list.
          </p>
        ) : (
          <ul className="mt-6 divide-y divide-[var(--line)] border-y border-[var(--line)]">
            {data.rfqs.map((rfq) => {
              const story = rfqStatusCopy(rfq.status);
              const rfqQuotes = data.quotes.filter((quote) => quote.rfqId === rfq.id);
              const liveQuotes = rfqQuotes.filter(
                (quote) => quote.status === 'offered' || quote.status === 'accepted',
              );
              const quoteIds = new Set(
                (liveQuotes.length ? liveQuotes : rfqQuotes).map((quote) => quote.id),
              );
              const itemNames = [
                ...new Set(
                  data.items.filter((item) => quoteIds.has(item.quoteId)).map((item) => item.name),
                ),
              ];
              const acceptance = data.acceptances.find((row) => row.rfqId === rfq.id);
              const depositPaid = Boolean(
                acceptance &&
                data.links.some(
                  (link) => link.acceptanceId === acceptance.id && link.status === 'paid',
                ),
              );
              const asked = enquiryHeadline(
                rfq.sanitizedRequest || rfq.rawRequest,
                rfq.parsedRequirements,
              );
              const decided = enquiryDecision({
                status: rfq.status,
                quotes: liveQuotes.length ? liveQuotes : rfqQuotes,
                itemNames,
                accepted: Boolean(acceptance),
                depositPaid,
              });
              return (
                <li key={rfq.id}>
                  <Link
                    href={`/merchant/rfqs/${rfq.id}`}
                    className="grid gap-3 py-5 hover:bg-[var(--parchment-warm)]/70 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] md:items-baseline md:gap-8"
                  >
                    <span>
                      <span className="block font-medium">{asked}</span>
                      <span className="mt-1 block text-xs text-[var(--muted)]">
                        {rfq.createdAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                      </span>
                    </span>
                    <span className="text-sm leading-relaxed text-[var(--accent)]">{decided}</span>
                    <Badge tone={story.tone} className="w-fit rounded-none">
                      {story.title}
                    </Badge>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
