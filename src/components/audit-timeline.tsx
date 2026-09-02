import { Badge } from '@/components/ui/badge';
import { eventLabel, humanizePlanningFailures, parseEscalationAttempts } from '@/server/quotes/rfq-story';

function toneFor(eventType: string): 'ok' | 'warn' | 'danger' | 'info' | 'neutral' {
  if (eventType.includes('paid') || eventType.includes('accepted') || eventType.includes('offered')) return 'ok';
  if (
    eventType.includes('failed') ||
    eventType.includes('blocked') ||
    eventType.includes('invalid') ||
    eventType.includes('security') ||
    eventType.includes('escalated')
  ) {
    return 'danger';
  }
  if (eventType.includes('retry') || eventType.includes('clarification') || eventType.includes('approval')) return 'warn';
  if (eventType.includes('planning') || eventType.includes('received') || eventType.includes('extracted')) return 'info';
  return 'neutral';
}

function eventBody(event: { eventType: string; summary: string; reason?: string | null }) {
  if (event.eventType !== 'agent.escalated') {
    return <p className="mt-1 text-sm text-slate-800">{event.summary}</p>;
  }
  const attempts = parseEscalationAttempts(event.summary);
  const blockers = attempts.flatMap((attempt) => attempt.blockers);
  return (
    <div className="mt-1 space-y-2">
      <p className="text-sm text-slate-800">{event.reason || humanizePlanningFailures(blockers)}</p>
      {attempts.length > 0 ? (
        <ul className="list-disc space-y-1 pl-5 text-xs text-slate-600">
          {attempts.map((attempt) => (
            <li key={attempt.name}>
              <span className="font-medium text-slate-800">{attempt.name}</span>
              {attempt.blockers.length ? ' — blocked' : ''}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
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
    return <p className="text-sm text-slate-500">No activity yet.</p>;
  }
  return (
    <ol className="space-y-3">
      {events.map((event) => (
        <li key={event.id} className="flex gap-3">
          <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-slate-400" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={toneFor(event.eventType)}>{eventLabel(event.eventType)}</Badge>
              <span className="text-xs text-slate-500">
                {new Date(event.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
              </span>
            </div>
            {eventBody(event)}
            {event.reason && event.eventType !== 'agent.escalated' ? (
              <p className="mt-1 text-xs text-slate-500">{event.reason}</p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
