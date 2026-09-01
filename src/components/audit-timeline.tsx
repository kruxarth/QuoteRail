import { Badge } from '@/components/ui/badge';

function toneFor(eventType: string): 'ok' | 'warn' | 'danger' | 'info' | 'neutral' {
  if (eventType.includes('paid') || eventType.includes('accepted') || eventType.includes('offered')) return 'ok';
  if (eventType.includes('failed') || eventType.includes('blocked') || eventType.includes('invalid') || eventType.includes('security')) {
    return 'danger';
  }
  if (eventType.includes('retry') || eventType.includes('clarification') || eventType.includes('approval')) return 'warn';
  if (eventType.includes('planning') || eventType.includes('received') || eventType.includes('extracted')) return 'info';
  return 'neutral';
}

export function AuditTimeline({
  events,
}: {
  events: Array<{
    id: string;
    createdAt: string;
    eventType: string;
    summary: string;
    actorType: string;
    reason?: string | null;
  }>;
}) {
  if (events.length === 0) {
    return <p className="text-sm text-slate-500">No audit events yet.</p>;
  }
  return (
    <ol className="space-y-3">
      {events.map((event) => (
        <li key={event.id} className="flex gap-3">
          <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-slate-400" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={toneFor(event.eventType)}>{event.eventType}</Badge>
              <span className="text-xs text-slate-500">{new Date(event.createdAt).toLocaleString('en-IN')}</span>
            </div>
            <p className="mt-1 text-sm text-slate-800">{event.summary}</p>
            {event.reason ? <p className="text-xs text-slate-500">{event.reason}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
