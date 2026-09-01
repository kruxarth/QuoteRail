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

export default async function MerchantDashboardPage() {
  const jar = await cookies();
  const header = jar.getAll().map((c) => `${c.name}=${c.value}`).join('; ');
  if (!isMerchantAuthenticated(header)) redirect('/merchant/login');
  const data = await merchantDashboard();
  const halls = await hallCalendar();
  return (
    <main className="mx-auto max-w-6xl space-y-8 px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Operations console</h1>
        {demoResetEnabled(getEnv()) ? <DemoReset /> : null}
      </div>
      <div className="grid gap-4 md:grid-cols-5">
        {[
          ['Active enquiries', String(data.kpis.activeEnquiries)],
          ['Quoted value', formatInr(data.kpis.quotedValue)],
          ['Held units', String(data.kpis.heldBookingUnits)],
          ['Deposits paid', formatInr(data.kpis.depositsPaid)],
          ['Blocked unsafe', String(data.kpis.blockedUnsafe)],
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
          <CardTitle>RFQs</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {data.rfqs.length === 0 ? <li className="py-6 text-sm text-slate-500">No enquiries yet.</li> : null}
            {data.rfqs.map((rfq) => (
              <li key={rfq.id} className="flex items-center justify-between py-3 text-sm">
                <Link href={`/merchant/rfqs/${rfq.id}`} className="font-medium hover:underline">
                  {rfq.id.slice(0, 8)} · {rfq.sanitizedRequest.slice(0, 80)}
                </Link>
                <Badge
                  tone={
                    rfq.status === 'quoted'
                      ? 'ok'
                      : rfq.status === 'needs_clarification'
                        ? 'warn'
                        : rfq.status === 'escalated'
                          ? 'danger'
                          : 'info'
                  }
                >
                  {rfq.status}
                </Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Recent audit</CardTitle>
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
