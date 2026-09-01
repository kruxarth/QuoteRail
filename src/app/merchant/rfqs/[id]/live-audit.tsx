'use client';

import useSWR from 'swr';
import { AuditTimeline } from '@/components/audit-timeline';

type Event = {
  id: string;
  createdAt: string;
  eventType: string;
  summary: string;
  actorType: string;
  reason?: string | null;
};

export function LiveAudit({
  rfqId,
  traceId,
  initial,
}: {
  rfqId: string;
  traceId: string;
  initial: Event[];
}) {
  const hidden = typeof document !== 'undefined' && document.hidden;
  const { data } = useSWR(
    hidden ? null : `/api/merchant/events?rfqId=${rfqId}&traceId=${traceId}`,
    (url: string) => fetch(url).then((r) => r.json()),
    { refreshInterval: 1000 },
  );
  const events = (data?.events as Event[] | undefined)?.length ? (data.events as Event[]) : initial;
  return <AuditTimeline events={events} />;
}
