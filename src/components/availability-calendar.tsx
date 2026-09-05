import { istDateString } from '@/shared/clock';
import { IST_TIME_ZONE, type SlotWindow } from '@/shared/constants';
import { cn } from '@/lib/utils';

const WINDOWS: SlotWindow[] = ['morning', 'afternoon', 'evening'];
const WINDOW_MARK: Record<SlotWindow, string> = {
  morning: 'M',
  afternoon: 'A',
  evening: 'E',
};

type SlotState = 'available' | 'blocked' | 'held' | 'committed';

const STATE_CLASS: Record<SlotState, string> = {
  available: 'bg-[var(--parchment-warm)] text-[var(--muted)]',
  held: 'bg-amber-200 text-amber-950',
  committed: 'bg-[var(--foreground)] text-[var(--background)]',
  blocked: 'bg-red-200 text-red-950',
};

type HallCalendar = {
  hall: { name: string; code: string };
  slots: Array<{ state: SlotState; reason?: string | null; slot: { startsAt: Date } }>;
};

function windowOf(startsAt: Date): SlotWindow {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: IST_TIME_ZONE,
      hour: 'numeric',
      hour12: false,
    }).format(startsAt),
  );
  if (hour < 12) return 'morning';
  if (hour < 16) return 'afternoon';
  return 'evening';
}

function dayLabel(isoDate: string): { weekday: string; day: string } {
  const instant = new Date(`${isoDate}T06:30:00.000Z`);
  return {
    weekday: new Intl.DateTimeFormat('en-IN', { timeZone: IST_TIME_ZONE, weekday: 'short' }).format(
      instant,
    ),
    day: isoDate.slice(8),
  };
}

function lookup(hall: HallCalendar) {
  const map = new Map<string, { state: SlotState; reason?: string | null; startsAt: Date }>();
  for (const entry of hall.slots) {
    const date = istDateString(entry.slot.startsAt);
    const window = windowOf(entry.slot.startsAt);
    map.set(`${date}:${window}`, {
      state: entry.state,
      reason: entry.reason,
      startsAt: entry.slot.startsAt,
    });
  }
  return map;
}

export function AvailabilityCalendar({ halls }: { halls: HallCalendar[] }) {
  const days = [
    ...new Set(
      halls.flatMap((hall) => hall.slots.map((entry) => istDateString(entry.slot.startsAt))),
    ),
  ].sort();
  const today = istDateString(new Date());
  const maps = new Map(halls.map((hall) => [hall.hall.code, lookup(hall)]));

  if (days.length === 0) {
    return <p className="text-sm text-[var(--muted)]">No evenings on the book yet.</p>;
  }

  return (
    <div>
      <p className="flex flex-wrap gap-x-5 gap-y-2 text-[11px] tracking-[0.14em] text-[var(--muted)] uppercase">
        <span className="inline-flex items-center gap-2">
          <span className={cn('h-3 w-3', STATE_CLASS.available)} /> available
        </span>
        <span className="inline-flex items-center gap-2">
          <span className={cn('h-3 w-3', STATE_CLASS.held)} /> held
        </span>
        <span className="inline-flex items-center gap-2">
          <span className={cn('h-3 w-3', STATE_CLASS.committed)} /> committed
        </span>
        <span className="inline-flex items-center gap-2">
          <span className={cn('h-3 w-3', STATE_CLASS.blocked)} /> blocked
        </span>
        <span className="text-[var(--accent)]">M morning · A afternoon · E evening</span>
      </p>

      <div className="mt-6 overflow-x-auto border border-[var(--line)]">
        <table className="w-full min-w-[52rem] border-collapse text-left">
          <thead>
            <tr className="border-b border-[var(--line)]">
              <th className="sticky left-0 z-10 w-36 bg-[var(--background)] px-4 py-3 text-xs font-normal tracking-[0.16em] text-[var(--muted)] uppercase">
                Hall
              </th>
              {days.map((date) => {
                const label = dayLabel(date);
                const isToday = date === today;
                return (
                  <th
                    key={date}
                    scope="col"
                    className={cn(
                      'px-1.5 py-3 text-center font-normal',
                      isToday && 'bg-[var(--parchment-warm)]',
                    )}
                  >
                    <span className="block text-[10px] tracking-[0.16em] text-[var(--muted)] uppercase">
                      {label.weekday}
                    </span>
                    <span className="mt-0.5 block font-serif text-xl leading-none">
                      {label.day}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {halls.map((hall) => {
              const slots = maps.get(hall.hall.code)!;
              return (
                <tr key={hall.hall.code} className="border-b border-[var(--line)] last:border-b-0">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 bg-[var(--background)] px-4 py-3 text-left font-normal"
                  >
                    <h3 className="font-serif text-xl">{hall.hall.name}</h3>
                  </th>
                  {days.map((date) => (
                    <td
                      key={date}
                      className={cn(
                        'px-1.5 py-2',
                        date === today && 'bg-[var(--parchment-warm)]/60',
                      )}
                    >
                      <div className="grid grid-cols-3 gap-0.5">
                        {WINDOWS.map((window) => {
                          const hit = slots.get(`${date}:${window}`);
                          if (!hit) {
                            return <span key={window} className="h-9 bg-[var(--line)]/40" />;
                          }
                          return (
                            <span
                              key={window}
                              title={[hall.hall.name, date, window, hit.state, hit.reason]
                                .filter(Boolean)
                                .join(' · ')}
                              className={cn(
                                'flex h-9 items-center justify-center text-[10px] tracking-wide',
                                STATE_CLASS[hit.state],
                              )}
                            >
                              <span className="sr-only">
                                {window} {hit.state}
                              </span>
                              <span aria-hidden>{WINDOW_MARK[window]}</span>
                            </span>
                          );
                        })}
                      </div>
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-[var(--muted)] md:hidden">Swipe the grid for later dates.</p>
    </div>
  );
}
