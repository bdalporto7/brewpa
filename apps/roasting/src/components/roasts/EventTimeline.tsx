import { Fan, Flame, Thermometer, Wind, Sun, Coffee, StickyNote, Square } from "lucide-react";
import { deleteEvent } from "@/lib/actions";
import { formatMMSS } from "@/lib/format";
import { describeEvent, type EventType } from "@/lib/constants";
import DeleteButton from "@/components/DeleteButton";
import type { RoastEvent } from "@prisma/client";

const ICONS: Record<EventType, React.ReactNode> = {
  FAN: <Fan className="h-3.5 w-3.5" />,
  HEAT: <Flame className="h-3.5 w-3.5" />,
  TEMP: <Thermometer className="h-3.5 w-3.5" />,
  DRY_END: <Wind className="h-3.5 w-3.5" />,
  YELLOWING_END: <Sun className="h-3.5 w-3.5" />,
  FIRST_CRACK_START: <Coffee className="h-3.5 w-3.5" />,
  FIRST_CRACK_END: <Coffee className="h-3.5 w-3.5" />,
  SECOND_CRACK_START: <Coffee className="h-3.5 w-3.5" />,
  SECOND_CRACK_END: <Coffee className="h-3.5 w-3.5" />,
  NOTE: <StickyNote className="h-3.5 w-3.5" />,
  DROP: <Square className="h-3.5 w-3.5" />,
};

/** Events sharing an exact atSeconds (e.g. the fan/heat set at roast start) render as one row. */
function groupByTime(events: RoastEvent[]): RoastEvent[][] {
  const sorted = [...events].sort((a, b) => b.atSeconds - a.atSeconds);
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
    <ol className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
      {groups.map((group) => (
        <li key={group[0].atSeconds} className="flex items-start gap-3 px-4 py-2.5 text-sm">
          <span className="w-12 shrink-0 pt-1 font-mono text-xs text-muted">
            {formatMMSS(group[0].atSeconds)}
          </span>
          <div className="flex flex-1 flex-wrap items-center gap-1.5">
            {group.map((event) => (
              <span
                key={event.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2 py-0.5"
              >
                <span className="text-muted">{ICONS[event.type as EventType]}</span>
                <span>{describeEvent(event)}</span>
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
        </li>
      ))}
    </ol>
  );
}
