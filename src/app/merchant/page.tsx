import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { isMerchantAuthenticated } from '@/server/auth/session';
import { hallCalendar, merchantDashboard } from '@/server/quotes/merchant-queries';
import { formatInr } from '@/shared/money';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AvailabilityCalendar } from '@/components/availability-calendar';
import { AuditTimeline } from '@/components/audit-timeline';
import { demoResetEnabled, getEnv } from '@/env';
import { DemoReset } from '@/app/merchant/demo-reset';
import { enquiryHeadline, rfqStatusCopy } from '@/server/quotes/rfq-story';

export default async function MerchantDashboardPage() {
  const jar = await cookies();
  const header = jar.getAll().map((c) => `${c.name}=${c.value}`).join('; ');
  if (!isMerchantAuthenticated(header)) redirect('/merchant/login');
  const data = await merchantDashboard();
  const halls = await hallCalendar();
  return (
    <main className="mx-auto max-w-6xl space-y-8 px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="font-semibold tracking-tight text-3xl">Operations</h1>
        {demoResetEnabled(getEnv()) ? <DemoReset /> : null}
      </div>
      <div className="grid gap-4 md:grid-cols-5">
        {[
          ['Active enquiries', String(data.kpis.activeEnquiries)],
          ['Quoted value', formatInr(data.kpis.quotedValue)],
          ['Slots on hold', String(data.kpis.heldBookingUnits)],
          ['Deposits paid', formatInr(data.kpis.depositsPaid)],
          ['Stopped by policy', String(data.kpis.blockedUnsafe)],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardHeader>
              <CardTitle className="text-xs uppercase text-slate-500">{label}</CardTitle>
            </CardHeader>
            <CardContent className="text-xl font-semibold">{value}</CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Hall availability</CardTitle>
        </CardHeader>
        <CardContent>
          <AvailabilityCalendar halls={halls} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Enquiries</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {data.rfqs.length === 0 ? <li className="py-6 text-sm text-slate-500">No enquiries yet.</li> : null}
            {data.rfqs.map((rfq) => {
              const story = rfqStatusCopy(rfq.status);
              return (
                <li key={rfq.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                  <Link href={`/merchant/rfqs/${rfq.id}`} className="min-w-0 hover:underline">
                    <span className="block font-medium">
                      {enquiryHeadline(rfq.sanitizedRequest || rfq.rawRequest, rfq.parsedRequirements)}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-slate-500">
                      {rfq.createdAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} · {rfq.id.slice(0, 8)}
                    </span>
                  </Link>
                  <Badge tone={story.tone} className="shrink-0">
                    {story.title}
                  </Badge>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <AuditTimeline
            events={data.audit.map((e) => ({
              id: e.id,
              createdAt: e.createdAt.toISOString(),
              eventType: e.eventType,
              summary: e.summary,
              actorType: e.actorType,
              reason: e.reason,
            }))}
          />
        </CardContent>
      </Card>
    </main>
  );
}
