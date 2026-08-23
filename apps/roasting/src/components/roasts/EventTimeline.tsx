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

  const sorted = [...events].sort((a, b) => b.atSeconds - a.atSeconds);

  return (
    <ol className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
      {sorted.map((event) => (
        <li key={event.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
          <div className="flex items-center gap-3">
            <span className="w-12 shrink-0 font-mono text-xs text-muted">
              {formatMMSS(event.atSeconds)}
            </span>
            <span className="text-muted">{ICONS[event.type as EventType]}</span>
            <span>{describeEvent(event)}</span>
          </div>
          {editable && (
            <DeleteButton
              action={deleteEvent.bind(null, event.roastSessionId, event.id)}
              confirmText="Remove this event?"
              label="Remove"
            />
          )}
        </li>
      ))}
    </ol>
  );
}
