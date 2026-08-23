"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { deleteEvent } from "@/lib/actions";
import { formatMMSS } from "@/lib/format";
import { EVENT_LABELS, type EventType } from "@/lib/constants";
import DeleteButton from "@/components/DeleteButton";
import type { RoastEvent } from "@prisma/client";

const MILESTONE_COLOR: Partial<Record<EventType, string>> = {
  DRY_END: "var(--mark-dry-end)",
  YELLOWING_END: "var(--mark-yellowing-end)",
  FIRST_CRACK_START: "var(--mark-first-crack)",
  FIRST_CRACK_END: "var(--mark-first-crack)",
  SECOND_CRACK_START: "var(--mark-second-crack)",
  SECOND_CRACK_END: "var(--mark-second-crack)",
  DROP: "var(--mark-drop)",
};

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

/**
 * Hiding every temp-only row (first pass) lost the trend entirely — you
 * couldn't tell 340°F from 480°F without expanding. Showing all of them is
 * what made the table long in the first place. This down-samples instead of
 * choosing one extreme: an evenly-spaced subset (always including the very
 * first and last reading, so the range is never a guess) stays inline by
 * default, dense enough to see the climb, short enough to scan — the same
 * trade-off a log/metrics viewer makes when it can't show every data point.
 */
const DEFAULT_TEMP_ROWS = 10;

function sampleEvenly<T>(items: T[], target: number): T[] {
  if (items.length <= target) return items;
  const step = Math.ceil(items.length / target);
  const sampled = items.filter((_, i) => i % step === 0);
  const last = items[items.length - 1];
  if (sampled[sampled.length - 1] !== last) sampled.push(last);
  return sampled;
}

/** Subtle by default, full-strength on row hover — visible without adding noise to every row, and never fully hidden, since group-hover never fires on touch. */
function RowDelete({ event, editable }: { event: RoastEvent; editable: boolean }) {
  if (!editable) return null;
  return (
    <span className="opacity-40 transition-opacity group-hover:opacity-100">
      <DeleteButton
        variant="icon"
        action={deleteEvent.bind(null, event.roastSessionId, event.id)}
        confirmText="Remove this event?"
        label="Remove event"
      />
    </span>
  );
}

function NumberCell({
  event,
  value,
  editable,
  color,
}: {
  event: RoastEvent | undefined;
  value: React.ReactNode;
  editable: boolean;
  color?: string;
}) {
  return (
    <td className="px-2 py-1 text-right font-mono tabular-nums">
      {event && (
        <span className="inline-flex items-center gap-1" style={color ? { color } : undefined}>
          {value}
          <RowDelete event={event} editable={editable} />
        </span>
      )}
    </td>
  );
}

function EventRow({
  group,
  editable,
}: {
  group: RoastEvent[];
  editable: boolean;
}) {
  const tempEvent = group.find((e) => e.type === "TEMP");
  const fanEvent = group.find((e) => e.type === "FAN");
  const heatEvent = group.find((e) => e.type === "HEAT");
  const otherEvents = group.filter((e) => e.type !== "TEMP" && e.type !== "FAN" && e.type !== "HEAT");

  return (
    <tr className="group hover:bg-background/60">
      <td className="px-2 py-1 font-mono text-xs text-muted">{formatMMSS(group[0].atSeconds)}</td>
      <NumberCell event={tempEvent} editable={editable} value={tempEvent?.tempFahrenheit} />
      <NumberCell event={fanEvent} editable={editable} value={fanEvent?.fanLevel} color="var(--accent)" />
      <NumberCell event={heatEvent} editable={editable} value={heatEvent?.heatLevel} />
      <td className="px-2 py-1">
        {otherEvents.length > 0 && (
          <div className="flex flex-col gap-0.5">
            {otherEvents.map((event) => {
              const color = MILESTONE_COLOR[event.type as EventType];
              return (
                <span key={event.id} className="inline-flex items-center gap-1.5">
                  {color && <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />}
                  <span style={color ? { color } : undefined}>
                    {event.type === "NOTE" ? event.note : EVENT_LABELS[event.type as EventType]}
                  </span>
                  <RowDelete event={event} editable={editable} />
                </span>
              );
            })}
          </div>
        )}
      </td>
    </tr>
  );
}

export default function EventTimeline({
  events,
  editable = false,
}: {
  events: RoastEvent[];
  editable?: boolean;
}) {
  const [showReadings, setShowReadings] = useState(false);

  if (events.length === 0) {
    return <p className="text-sm text-muted">No events logged yet.</p>;
  }

  const groups = groupByTime(events);
  const keyGroups = groups.filter((g) => g.some((e) => e.type !== "TEMP"));
  const tempOnlyGroups = groups.filter((g) => g.every((e) => e.type === "TEMP"));
  const sampledTemp = sampleEvenly(tempOnlyGroups, DEFAULT_TEMP_ROWS);
  const hiddenCount = tempOnlyGroups.length - sampledTemp.length;
  const defaultGroups = [...keyGroups, ...sampledTemp].sort((a, b) => a[0].atSeconds - b[0].atSeconds);
  const visibleGroups = showReadings ? groups : defaultGroups;

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="w-full min-w-[420px] text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-muted">
            <th className="px-2 py-1 text-left font-normal">Time</th>
            <th className="px-2 py-1 text-right font-normal">Temp (°F)</th>
            <th className="px-2 py-1 text-right font-normal">Fan</th>
            <th className="px-2 py-1 text-right font-normal">Heat</th>
            <th className="px-2 py-1 text-left font-normal">Event</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {visibleGroups.map((group) => (
            <EventRow key={group[0].atSeconds} group={group} editable={editable} />
          ))}
        </tbody>
      </table>
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setShowReadings((v) => !v)}
          className="flex w-full items-center justify-center gap-1.5 border-t border-border px-2 py-1.5 text-xs font-medium text-muted transition hover:text-foreground"
        >
          <ChevronDown className={`h-3 w-3 transition-transform ${showReadings ? "rotate-180" : ""}`} />
          {showReadings ? "Show fewer readings" : `+${hiddenCount} more temperature ${hiddenCount === 1 ? "reading" : "readings"}`}
        </button>
      )}
    </div>
  );
}
