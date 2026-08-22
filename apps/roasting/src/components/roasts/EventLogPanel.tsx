"use client";

import { useRef, useState, useTransition } from "react";
import { Fan, Flame, Minus, Plus, Thermometer, Check } from "lucide-react";
import { logEvent } from "@/lib/actions";
import { useElapsedSeconds } from "@/lib/useElapsedSeconds";
import { SR800_LEVEL_MIN, SR800_LEVEL_MAX, EVENT_LABELS, type EventType } from "@/lib/constants";
import Button from "@/components/ui/Button";

const MILESTONE_BUTTONS: { type: EventType; short: string }[] = [
  { type: "DRY_END", short: "Dry end" },
  { type: "FIRST_CRACK_START", short: "1C start" },
  { type: "FIRST_CRACK_END", short: "1C end" },
  { type: "SECOND_CRACK_START", short: "2C start" },
  { type: "SECOND_CRACK_END", short: "2C end" },
];

function LevelStepper({
  label,
  icon,
  level,
  onChange,
  pending,
}: {
  label: string;
  icon: React.ReactNode;
  level: number;
  onChange: (next: number) => void;
  pending: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-surface p-4">
      <span className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted uppercase">
        {icon}
        {label}
      </span>
      <div className="flex items-center gap-4">
        <button
          type="button"
          disabled={pending || level <= SR800_LEVEL_MIN}
          onClick={() => onChange(level - 1)}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-foreground transition hover:border-accent hover:text-accent disabled:opacity-30"
          aria-label={`Decrease ${label}`}
        >
          <Minus className="h-4 w-4" />
        </button>
        <span className="w-8 text-center font-mono text-3xl font-semibold tabular-nums">{level}</span>
        <button
          type="button"
          disabled={pending || level >= SR800_LEVEL_MAX}
          onClick={() => onChange(level + 1)}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-foreground transition hover:border-accent hover:text-accent disabled:opacity-30"
          aria-label={`Increase ${label}`}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default function EventLogPanel({
  roastSessionId,
  startedAt,
  initialFanLevel,
  initialHeatLevel,
  loggedMilestoneTypes,
}: {
  roastSessionId: string;
  startedAt: string;
  initialFanLevel: number;
  initialHeatLevel: number;
  loggedMilestoneTypes: EventType[];
}) {
  const elapsed = useElapsedSeconds(startedAt);
  const [isPending, startTransition] = useTransition();
  const [fanLevel, setFanLevel] = useState(initialFanLevel);
  const [heatLevel, setHeatLevel] = useState(initialHeatLevel);
  const tempInputRef = useRef<HTMLInputElement>(null);
  const noteInputRef = useRef<HTMLInputElement>(null);

  function fire(input: Omit<Parameters<typeof logEvent>[0], "roastSessionId" | "atSeconds">) {
    startTransition(async () => {
      await logEvent({ ...input, roastSessionId, atSeconds: Math.round(elapsed) });
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <LevelStepper
          label="Fan"
          icon={<Fan className="h-3.5 w-3.5" />}
          level={fanLevel}
          pending={isPending}
          onChange={(next) => {
            setFanLevel(next);
            fire({ type: "FAN", fanLevel: next });
          }}
        />
        <LevelStepper
          label="Heat"
          icon={<Flame className="h-3.5 w-3.5" />}
          level={heatLevel}
          pending={isPending}
          onChange={(next) => {
            setHeatLevel(next);
            fire({ type: "HEAT", heatLevel: next });
          }}
        />
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <span className="mb-2 flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted uppercase">
          <Thermometer className="h-3.5 w-3.5" />
          Temp reading
        </span>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const value = tempInputRef.current?.value;
            if (!value) return;
            fire({ type: "TEMP", tempFahrenheit: Number(value) });
            if (tempInputRef.current) tempInputRef.current.value = "";
          }}
        >
          <input
            ref={tempInputRef}
            type="number"
            step="1"
            placeholder="°F"
            className="w-24 rounded-md border border-border bg-surface px-2.5 py-1.5 font-mono text-sm focus:border-accent focus:outline-none"
          />
          <Button type="submit" size="sm" disabled={isPending}>
            Log
          </Button>
        </form>
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <span className="mb-2 block text-xs font-medium tracking-wide text-muted uppercase">
          Milestones
        </span>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {MILESTONE_BUTTONS.map(({ type, short }) => {
            const logged = loggedMilestoneTypes.includes(type);
            return (
              <button
                key={type}
                type="button"
                disabled={isPending}
                onClick={() => fire({ type })}
                title={EVENT_LABELS[type]}
                className={`flex items-center justify-center gap-1 rounded-md border px-2 py-2 text-xs font-medium transition disabled:opacity-50 ${
                  logged
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-border text-foreground hover:border-accent hover:text-accent"
                }`}
              >
                {logged && <Check className="h-3 w-3" />}
                {short}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <span className="mb-2 block text-xs font-medium tracking-wide text-muted uppercase">Note</span>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const value = noteInputRef.current?.value.trim();
            if (!value) return;
            fire({ type: "NOTE", note: value });
            if (noteInputRef.current) noteInputRef.current.value = "";
          }}
        >
          <input
            ref={noteInputRef}
            type="text"
            placeholder="Smells nutty, slowing down…"
            className="flex-1 rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm focus:border-accent focus:outline-none"
          />
          <Button type="submit" size="sm" disabled={isPending}>
            Add
          </Button>
        </form>
      </div>
    </div>
  );
}
