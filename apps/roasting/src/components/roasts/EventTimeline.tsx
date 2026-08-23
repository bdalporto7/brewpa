import { deleteEvent } from "@/lib/actions";
import { formatMMSS } from "@/lib/format";
import { EVENT_LABELS, type EventType } from "@/lib/constants";
import DeleteButton from "@/components/DeleteButton";
import type { RoastEvent } from "@prisma/client";

/** Events sharing an exact atSeconds (e.g. fan/heat set together) render as one row. */
function groupByTime(events: RoastEvent[]): RoastEvent[][] {
  const sorted = [...events].sort((a, b) => a.atSeconds - b.atSeconds);
  const groups: RoastEvent[][] = [];
  for (const event of sorted) {
    const current = groups[groups.length - 1];
    if (current && current[0].atSeconds === event.atSeconds) {
      current.push(event);
    } else {
      groups.push([event]);
    }
  }
  return groups;
}

function Cell({
  event,
  value,
  editable,
}: {
  event: RoastEvent | undefined;
  value: React.ReactNode;
  editable: boolean;
}) {
  if (!event) return <td className="px-2 py-1.5 font-mono text-muted">—</td>;
  return (
    <td className="px-2 py-1.5">
      <span className="inline-flex items-center gap-1 font-mono">
        {value}
        {editable && (
          <DeleteButton
            variant="icon"
            action={deleteEvent.bind(null, event.roastSessionId, event.id)}
            confirmText="Remove this event?"
            label="Remove event"
          />
        )}
      </span>
    </td>
  );
}

export default function EventTimeline({
  events,
  editable = false,
}: {
  events: RoastEvent[];
  editable?: boolean;
}) {
  if (events.length === 0) {
    return <p className="text-sm text-muted">No events logged yet.</p>;
  }

  const groups = groupByTime(events);

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="w-full min-w-[420px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted">
            <th className="px-2 py-1.5 font-normal">Time</th>
            <th className="px-2 py-1.5 font-normal">Temp</th>
            <th className="px-2 py-1.5 font-normal">Fan</th>
            <th className="px-2 py-1.5 font-normal">Heat</th>
            <th className="px-2 py-1.5 font-normal">Event</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {groups.map((group) => {
            const tempEvent = group.find((e) => e.type === "TEMP");
            const fanEvent = group.find((e) => e.type === "FAN");
            const heatEvent = group.find((e) => e.type === "HEAT");
            const otherEvents = group.filter(
              (e) => e.type !== "TEMP" && e.type !== "FAN" && e.type !== "HEAT"
            );

            return (
              <tr key={group[0].atSeconds}>
                <td className="px-2 py-1.5 font-mono text-xs text-muted">{formatMMSS(group[0].atSeconds)}</td>
                <Cell event={tempEvent} editable={editable} value={`${tempEvent?.tempFahrenheit}°F`} />
                <Cell event={fanEvent} editable={editable} value={fanEvent?.fanLevel} />
                <Cell event={heatEvent} editable={editable} value={heatEvent?.heatLevel} />
                <td className="px-2 py-1.5">
                  {otherEvents.length === 0 ? (
                    <span className="text-muted">—</span>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {otherEvents.map((event) => (
                        <span key={event.id} className="inline-flex items-center gap-1">
                          {event.type === "NOTE" ? event.note : EVENT_LABELS[event.type as EventType]}
                          {editable && (
                            <DeleteButton
                              variant="icon"
                              action={deleteEvent.bind(null, event.roastSessionId, event.id)}
                              confirmText="Remove this event?"
                              label="Remove event"
                            />
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
