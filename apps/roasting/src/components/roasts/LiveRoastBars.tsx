"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Fan, Flame, Thermometer, Minus, Plus, Check, Square } from "lucide-react";
import { useElapsedSeconds } from "@/lib/useElapsedSeconds";
import { useServerSyncedState } from "@/lib/useServerSyncedState";
import { useProbeReadings, type ProbeReading } from "@/lib/useProbeReadings";
import { getCurveReadings, type PlanTargets } from "@/lib/curve";
import { generateLiveTips, type HistoricalBaseline, type MilestoneTempBaseline, type ReferenceRoast } from "@/lib/tips";
import { formatMMSS } from "@/lib/format";
import { logEvent, dropRoast } from "@/lib/actions";
import { SR800_LEVEL_MIN, SR800_LEVEL_MAX, MILESTONE_ABBREVIATIONS, type EventType } from "@/lib/constants";
import type { RoastEvent } from "@prisma/client";

const MILESTONE_BUTTONS: EventType[] = [
  "DRY_END",
  "YELLOWING_END",
  "FIRST_CRACK_START",
  "FIRST_CRACK_END",
  "SECOND_CRACK_START",
  "SECOND_CRACK_END",
];

/** A -/value/+ control sized for a thumb, not a mouse — the previous 20px
 * circles in this bar were reported hard to hit while actually roasting.
 * The value itself is also tappable — jumping straight from, say, 3 to 8
 * shouldn't take five taps on +. Same "tap the value to edit it" pattern as
 * BarTempForm just below, sized for a single digit instead of a full form. */
function BarStepper({
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
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function commit() {
    const raw = Number(inputRef.current?.value);
    if (Number.isInteger(raw) && raw >= SR800_LEVEL_MIN && raw <= SR800_LEVEL_MAX) {
      onChange(raw);
    }
    setEditing(false);
  }

  return (
    <div className="flex items-center gap-1">
      {icon}
      <button
        type="button"
        disabled={pending || level <= SR800_LEVEL_MIN}
        onClick={() => onChange(level - 1)}
        aria-label={`Decrease ${label}`}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-foreground/10 text-accent-foreground transition hover:bg-accent-foreground/20 disabled:opacity-30"
      >
        <Minus className="h-4 w-4" />
      </button>
      {editing ? (
        <form
          className="contents"
          onSubmit={(e) => {
            e.preventDefault();
            commit();
          }}
        >
          <input
            ref={inputRef}
            type="number"
            inputMode="numeric"
            min={SR800_LEVEL_MIN}
            max={SR800_LEVEL_MAX}
            defaultValue={level}
            autoFocus
            onBlur={commit}
            aria-label={`Set ${label} level`}
            className="w-8 rounded-md bg-accent-foreground/10 text-center font-mono text-sm font-bold tabular-nums text-accent-foreground [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
        </form>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => setEditing(true)}
          aria-label={`Type a ${label} level`}
          className="w-4 text-center font-mono text-sm font-bold tabular-nums text-accent-foreground disabled:opacity-30"
        >
          {level}
        </button>
      )}
      <button
        type="button"
        disabled={pending || level >= SR800_LEVEL_MAX}
        onClick={() => onChange(level + 1)}
        aria-label={`Increase ${label}`}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-foreground/10 text-accent-foreground transition hover:bg-accent-foreground/20 disabled:opacity-30"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

function BarTempForm({ pending, onSubmit }: { pending: boolean; onSubmit: (value: number) => void }) {
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
      <Thermometer className="h-4 w-4 shrink-0 text-accent-foreground/80" />
      <input
        ref={inputRef}
        type="number"
        step="1"
        placeholder="°F"
        aria-label="Temperature reading"
        className="w-14 rounded-md border border-accent-foreground/30 bg-accent-foreground/10 px-1.5 py-1.5 font-mono text-sm text-accent-foreground placeholder:text-accent-foreground/50 focus:border-accent-foreground focus:outline-none"
      />
      <button
        type="submit"
        disabled={pending}
        aria-label="Log temperature reading"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-foreground/10 text-accent-foreground transition hover:bg-accent-foreground/20 disabled:opacity-30"
      >
        <Check className="h-4 w-4" />
      </button>
    </form>
  );
}

function MilestoneButton({
  type,
  logged,
  pending,
  onFire,
}: {
  type: EventType;
  logged: boolean;
  pending: boolean;
  onFire: (type: EventType) => void;
}) {
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => onFire(type)}
      title={type.replaceAll("_", " ").toLowerCase()}
      className={`flex h-8 min-w-[2.75rem] items-center justify-center gap-1 rounded-md px-2 text-xs font-bold transition disabled:opacity-40 ${
        logged
          ? "bg-accent-foreground text-accent"
          : "bg-accent-foreground/10 text-accent-foreground hover:bg-accent-foreground/20"
      }`}
    >
      {logged && <Check className="h-3 w-3" />}
      {MILESTONE_ABBREVIATIONS[type]}
    </button>
  );
}

function BottomActionBar({
  roastSessionId,
  elapsed,
  fanLevel,
  heatLevel,
  loggedMilestoneTypes,
  setFanLevel,
  setHeatLevel,
}: {
  roastSessionId: string;
  elapsed: number;
  fanLevel: number;
  heatLevel: number;
  loggedMilestoneTypes: EventType[];
  setFanLevel: (n: number) => void;
  setHeatLevel: (n: number) => void;
}) {
  const [isPending, startTransition] = useTransition();

  function fire(input: Omit<Parameters<typeof logEvent>[0], "roastSessionId" | "atSeconds">) {
    startTransition(async () => {
      await logEvent({ ...input, roastSessionId, atSeconds: Math.round(elapsed) });
    });
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 bg-accent shadow-[0_-2px_8px_rgba(0,0,0,0.15)]" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-x-4 gap-y-2 px-3 py-2 sm:px-4">
        <BarStepper
          icon={<Fan className="h-4 w-4 text-accent-foreground/80" />}
          label="fan"
          level={fanLevel}
          pending={isPending}
          onChange={(next) => {
            setFanLevel(next);
            fire({ type: "FAN", fanLevel: next });
          }}
        />
        <BarStepper
          icon={<Flame className="h-4 w-4 text-accent-foreground/80" />}
          label="heat"
          level={heatLevel}
          pending={isPending}
          onChange={(next) => {
            setHeatLevel(next);
            fire({ type: "HEAT", heatLevel: next });
          }}
        />
        <BarTempForm pending={isPending} onSubmit={(value) => fire({ type: "TEMP", tempFahrenheit: value })} />
        <div className="flex flex-wrap items-center justify-center gap-1">
          {MILESTONE_BUTTONS.map((type) => (
            <MilestoneButton
              key={type}
              type={type}
              logged={loggedMilestoneTypes.includes(type)}
              pending={isPending}
              onFire={(t) => fire({ type: t })}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

const PROBE_STALE_AFTER_SECONDS = 30;

function TopStatusBar({
  beanName,
  elapsed,
  roastSessionId,
  hint,
  probeReadings,
}: {
  beanName: string;
  elapsed: number;
  roastSessionId: string;
  hint: string | null;
  probeReadings: ProbeReading[] | null;
}) {
  const [isDropping, startDropTransition] = useTransition();
  const [dropError, setDropError] = useState<string | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);

  function handleDrop() {
    setDropError(null);
    startDropTransition(async () => {
      try {
        await dropRoast(roastSessionId);
      } catch (e) {
        setDropError(e instanceof Error ? e.message : "Couldn't drop the roast — try again.");
      }
    });
  }

  const latestReading = probeReadings && probeReadings.length > 0 ? probeReadings[probeReadings.length - 1] : null;
  const probeConnected =
    latestReading != null && (now - new Date(latestReading.recordedAt).getTime()) / 1000 < PROBE_STALE_AFTER_SECONDS;

  return (
    <div className="fixed inset-x-0 top-0 z-30 bg-accent shadow-lg" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-3 py-1.5 sm:px-4">
        <div className="flex min-w-0 flex-col items-start">
          <span className="flex items-center gap-1.5 text-accent-foreground/80">
            <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-accent-foreground" />
            <span className="max-w-[32vw] truncate text-[10px] font-medium sm:text-xs">{beanName}</span>
            {latestReading && (
              <span
                className={`flex shrink-0 items-center gap-0.5 text-[10px] font-medium sm:text-xs ${probeConnected ? "" : "opacity-50"}`}
              >
                <Thermometer className="h-2.5 w-2.5" />
                {Math.round(latestReading.tempFahrenheit)}°
              </span>
            )}
          </span>
          <span className="font-mono text-5xl leading-none font-bold tabular-nums text-accent-foreground sm:text-6xl">
            {formatMMSS(elapsed)}
          </span>
        </div>
        <button
          type="button"
          disabled={isDropping}
          onClick={handleDrop}
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-accent-foreground px-4 py-2.5 text-sm font-bold text-accent transition hover:opacity-90 disabled:opacity-50"
        >
          <Square className="h-3.5 w-3.5" />
          {isDropping ? "Dropping…" : "Drop"}
        </button>
      </div>
      {(dropError || hint) && (
        <p
          className={`mx-auto line-clamp-2 max-w-4xl px-3 pb-1.5 text-xs sm:px-4 ${dropError ? "text-danger" : "text-accent-foreground/90"}`}
        >
          {dropError ?? hint}
        </p>
      )}
    </div>
  );
}

/**
 * Two permanently fixed bars for the whole time a roast is live — not
 * gated behind scrolling past a hero timer, per the roaster's own framing:
 * "the permanent timer glued to the top... user will always be looking at
 * chart." Top bar: bean, timer, a stage-aware hint up to 2 lines (reusing
 * tips.ts's stall/crash detection), and Drop — always reachable, rarely
 * tapped. Bottom bar: fan/heat/temp/milestones — the controls actually
 * touched every 10-30s. Splitting into two bars rather than one bigger one
 * was deliberate: cramming frequent-tap controls in with status info either
 * kept them too small to hit reliably or pushed the bar too tall; a bottom
 * bar also lands the frequent controls in the thumb-reachable zone on a
 * phone, which a top bar never is. The rest of the page (chart first, then
 * secondary panels) scrolls underneath both.
 */
export default function LiveRoastBars({
  startedAt,
  beanName,
  roastSessionId,
  initialFanLevel,
  initialHeatLevel,
  loggedMilestoneTypes,
  events,
  baseline,
  referenceRoast,
  planDivergedAtSeconds,
  milestoneTempBaseline,
  originalPlanTargets,
}: {
  startedAt: string;
  beanName: string;
  roastSessionId: string;
  initialFanLevel: number;
  initialHeatLevel: number;
  loggedMilestoneTypes: EventType[];
  events: RoastEvent[];
  baseline: HistoricalBaseline | null;
  referenceRoast?: ReferenceRoast | null;
  planDivergedAtSeconds?: number;
  milestoneTempBaseline?: MilestoneTempBaseline | null;
  originalPlanTargets?: PlanTargets;
}) {
  const elapsed = useElapsedSeconds(startedAt);
  // Shared by both bars so the fan/heat shown here never drifts from
  // EventLogPanel's own copy further down the page — same reasoning as
  // that panel's own comment.
  const [fanLevel, setFanLevel] = useServerSyncedState(initialFanLevel);
  const [heatLevel, setHeatLevel] = useServerSyncedState(initialHeatLevel);

  const probeReadings = useProbeReadings(roastSessionId);
  const curveReadings = useMemo(() => getCurveReadings(events, probeReadings ?? []), [events, probeReadings]);
  const hint = useMemo(() => {
    if (!baseline) return null;
    const tips = generateLiveTips({
      elapsedSeconds: elapsed,
      events,
      baseline,
      referenceRoast,
      curveReadings,
      planDivergedAtSeconds,
      milestoneTempBaseline,
      originalPlanTargets,
    });
    return tips[0]?.message ?? null;
  }, [baseline, elapsed, events, referenceRoast, curveReadings, planDivergedAtSeconds, milestoneTempBaseline, originalPlanTargets]);

  return (
    <>
      <TopStatusBar
        beanName={beanName}
        elapsed={elapsed}
        roastSessionId={roastSessionId}
        hint={hint}
        probeReadings={probeReadings}
      />
      <BottomActionBar
        roastSessionId={roastSessionId}
        elapsed={elapsed}
        fanLevel={fanLevel}
        heatLevel={heatLevel}
        loggedMilestoneTypes={loggedMilestoneTypes}
        setFanLevel={setFanLevel}
        setHeatLevel={setHeatLevel}
      />
    </>
  );
}
