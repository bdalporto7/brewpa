"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Fan, Flame, Thermometer, Minus, Plus, Check } from "lucide-react";
import { useElapsedSeconds } from "@/lib/useElapsedSeconds";
import { useServerSyncedState } from "@/lib/useServerSyncedState";
import { formatMMSS } from "@/lib/format";
import { logEvent } from "@/lib/actions";
import { SR800_LEVEL_MIN, SR800_LEVEL_MAX } from "@/lib/constants";
import Timer from "@/components/roasts/Timer";

/** A single-row -/value/+ control small enough to sit in the pinned bar without growing it — icon-only labeling, no text, since there's no width budget for it once fan, heat, and temp all share one row. */
function MiniStepper({
  icon,
  label,
  level,
  pending,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  level: number;
  pending: boolean;
  onChange: (next: number) => void;
}) {
  return (
    <div className="flex items-center gap-0.5">
      {icon}
      <button
        type="button"
        disabled={pending || level <= SR800_LEVEL_MIN}
        onClick={() => onChange(level - 1)}
        aria-label={`Decrease ${label}`}
        className="flex h-5 w-5 items-center justify-center rounded-full text-accent-foreground/80 transition hover:text-accent-foreground disabled:opacity-30"
      >
        <Minus className="h-3 w-3" />
      </button>
      <span className="w-3 text-center font-mono text-xs font-bold tabular-nums text-accent-foreground">{level}</span>
      <button
        type="button"
        disabled={pending || level >= SR800_LEVEL_MAX}
        onClick={() => onChange(level + 1)}
        aria-label={`Increase ${label}`}
        className="flex h-5 w-5 items-center justify-center rounded-full text-accent-foreground/80 transition hover:text-accent-foreground disabled:opacity-30"
      >
        <Plus className="h-3 w-3" />
      </button>
    </div>
  );
}

function MiniTempForm({ pending, onSubmit }: { pending: boolean; onSubmit: (value: number) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <form
      className="flex items-center gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        const value = inputRef.current?.value;
        if (!value) return;
        onSubmit(Number(value));
        if (inputRef.current) inputRef.current.value = "";
      }}
    >
      <Thermometer className="h-3 w-3 shrink-0 text-accent-foreground/80" />
      <input
        ref={inputRef}
        type="number"
        step="1"
        placeholder="°F"
        aria-label="Temperature reading"
        className="w-10 rounded border border-accent-foreground/30 bg-accent-foreground/10 px-1 py-0.5 font-mono text-xs text-accent-foreground placeholder:text-accent-foreground/50 focus:border-accent-foreground focus:outline-none"
      />
      <button
        type="submit"
        disabled={pending}
        aria-label="Log temperature reading"
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-accent-foreground/80 transition hover:text-accent-foreground disabled:opacity-30"
      >
        <Check className="h-3 w-3" />
      </button>
    </form>
  );
}

function CompactBar({
  startedAt,
  beanName,
  roastSessionId,
  initialFanLevel,
  initialHeatLevel,
}: {
  startedAt: string;
  beanName: string;
  roastSessionId: string;
  initialFanLevel: number;
  initialHeatLevel: number;
}) {
  const elapsed = useElapsedSeconds(startedAt);
  const [isPending, startTransition] = useTransition();
  // EventLogPanel further down the page writes to the same server state —
  // useServerSyncedState keeps this bar's steppers from drifting from it.
  const [fanLevel, setFanLevel] = useServerSyncedState(initialFanLevel);
  const [heatLevel, setHeatLevel] = useServerSyncedState(initialHeatLevel);

  function fire(input: Omit<Parameters<typeof logEvent>[0], "roastSessionId" | "atSeconds">) {
    startTransition(async () => {
      await logEvent({ ...input, roastSessionId, atSeconds: Math.round(elapsed) });
    });
  }

  return (
    <div className="fixed inset-x-0 top-0 z-30 bg-accent shadow-lg">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-3 py-1.5 sm:px-4">
        <div className="flex min-w-0 flex-col items-start">
          <span className="flex items-center gap-1.5 text-accent-foreground/80">
            <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-accent-foreground" />
            <span className="max-w-[28vw] truncate text-[10px] font-medium sm:text-xs">{beanName}</span>
          </span>
          <span className="font-mono text-6xl leading-none font-bold tabular-nums text-accent-foreground sm:text-7xl">
            {formatMMSS(elapsed)}
          </span>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            <MiniStepper
              icon={<Fan className="h-3 w-3 text-accent-foreground/80" />}
              label="fan"
              level={fanLevel}
              pending={isPending}
              onChange={(next) => {
                setFanLevel(next);
                fire({ type: "FAN", fanLevel: next });
              }}
            />
            <MiniStepper
              icon={<Flame className="h-3 w-3 text-accent-foreground/80" />}
              label="heat"
              level={heatLevel}
              pending={isPending}
              onChange={(next) => {
                setHeatLevel(next);
                fire({ type: "HEAT", heatLevel: next });
              }}
            />
          </div>
          <MiniTempForm pending={isPending} onSubmit={(value) => fire({ type: "TEMP", tempFahrenheit: value })} />
        </div>
      </div>
    </div>
  );
}

/**
 * Wraps the big hero Timer with an IntersectionObserver on it — once it
 * scrolls out of view, a fixed bar takes over so the elapsed time (and now,
 * quick fan/heat/temp controls) stay reachable while logging events or
 * checking the curve further down the page. Two separate elements rather
 * than one that shrinks on scroll: keeps the hero timer's full size while
 * it's in view (it's meant to dominate the screen, per the design-standards
 * section below) without needing a scroll-linked resize animation. The
 * pinned bar's timer is a size step down from the hero's (still large and
 * bold, just not the absolute biggest) specifically to leave room for the
 * fan/heat/temp console beside it without the bar growing taller than it
 * was before those controls existed — the constraint was "don't make the
 * bar bigger," not "keep the timer exactly this size."
 */
export default function LiveTimerBar({
  startedAt,
  beanName,
  roastSessionId,
  initialFanLevel,
  initialHeatLevel,
}: {
  startedAt: string;
  beanName: string;
  roastSessionId: string;
  initialFanLevel: number;
  initialHeatLevel: number;
}) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setPinned(!entry.isIntersecting), {
      threshold: 0,
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={sentinelRef}>
      <Timer startedAt={startedAt} />
      {pinned && (
        <CompactBar
          startedAt={startedAt}
          beanName={beanName}
          roastSessionId={roastSessionId}
          initialFanLevel={initialFanLevel}
          initialHeatLevel={initialHeatLevel}
        />
      )}
    </div>
  );
}
