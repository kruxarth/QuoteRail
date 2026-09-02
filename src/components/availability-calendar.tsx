import { Badge } from '@/components/ui/badge';

const toneMap = {
  available: 'ok',
  blocked: 'danger',
  held: 'warn',
  committed: 'info',
} as const;

export function AvailabilityCalendar({
  halls,
}: {
  halls: Array<{
    hall: { name: string; code: string };
    slots: Array<{ state: 'available' | 'blocked' | 'held' | 'committed'; slot: { startsAt: Date } }>;
  }>;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {halls.map((hall) => (
        <div key={hall.hall.code}>
          <h3 className="mb-3 font-serif text-2xl">{hall.hall.name}</h3>
          <div className="grid grid-cols-3 gap-2">
            {hall.slots.map((entry) => (
              <div key={entry.slot.startsAt.toISOString()} className="rounded-lg border border-[var(--line)] bg-[var(--background)] p-2 text-xs">
                <div className="text-slate-500">
                  {entry.slot.startsAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', hour: '2-digit', minute: '2-digit' })}
                </div>
                <Badge tone={toneMap[entry.state]} className="mt-1">
                  {entry.state}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
