import Link from "next/link";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getCurveReadings } from "@/lib/curve";
import { formatMMSS } from "@/lib/format";
import CompareRoastPicker from "@/components/roasts/CompareRoastPicker";
import RoastComparisonChart from "@/components/roasts/RoastComparisonChart";
import RatingBeans from "@/components/ui/RatingBeans";
import type { RoastEvent, TemperatureReading, RoastSession, Bean } from "@prisma/client";

type FullSession = RoastSession & { bean: Bean; events: RoastEvent[]; temperatureReadings: TemperatureReading[] };

function roastLabel(s: RoastSession & { bean: Bean }) {
  return `${s.bean.name} — ${s.startedAt ? format(s.startedAt, "MMM d, yyyy") : "undated"}${s.roastLevel ? ` (${s.roastLevel})` : ""}`;
}

function durationSeconds(s: RoastSession) {
  return s.startedAt && s.endedAt ? (s.endedAt.getTime() - s.startedAt.getTime()) / 1000 : null;
}

function weightLossPercent(s: RoastSession) {
  return s.roastedWeightGrams != null ? (1 - s.roastedWeightGrams / s.greenWeightGrams) * 100 : null;
}

function CompareStat({ label, a, b }: { label: string; a: React.ReactNode; b: React.ReactNode }) {
  return (
    <div className="rounded-xl border-2 border-[var(--border-strong)] bg-surface shadow-[2px_2px_0_var(--shadow-ink)] p-3">
      <p className="mb-1.5 text-xs text-muted">{label}</p>
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-sm font-semibold" style={{ color: "var(--accent)" }}>
          {a}
        </span>
        <span className="font-mono text-sm font-semibold" style={{ color: "var(--ror)" }}>
          {b}
        </span>
      </div>
    </div>
  );
}

export default async function CompareTab({
  currentSession,
  selectedId,
}: {
  currentSession: FullSession;
  selectedId: string | null;
}) {
  const candidates = await prisma.roastSession.findMany({
    where: { endedAt: { not: null }, id: { not: currentSession.id } },
    include: { bean: true },
    orderBy: { startedAt: "desc" },
  });

  const comparisonSummary = selectedId ? candidates.find((c) => c.id === selectedId) : null;
  const comparisonFull: FullSession | null = comparisonSummary
    ? await prisma.roastSession.findUniqueOrThrow({
        where: { id: comparisonSummary.id },
        include: { bean: true, events: true, temperatureReadings: true },
      })
    : null;

  const currentReadings = getCurveReadings(currentSession.events, currentSession.temperatureReadings);

  return (
    <div className="flex flex-col gap-4">
      {candidates.length === 0 ? (
        <p className="text-sm text-muted">No other completed roasts yet to compare against.</p>
      ) : (
        <CompareRoastPicker
          candidates={candidates.map((c) => ({ id: c.id, label: roastLabel(c) }))}
          selectedId={selectedId}
        />
      )}

      {comparisonFull ? (
        <>
          <RoastComparisonChart
            readingsA={currentReadings}
            labelA={roastLabel(currentSession)}
            readingsB={getCurveReadings(comparisonFull.events, comparisonFull.temperatureReadings)}
            labelB={roastLabel(comparisonFull)}
          />

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <CompareStat
              label="Duration"
              a={formatMMSS(durationSeconds(currentSession) ?? 0)}
              b={formatMMSS(durationSeconds(comparisonFull) ?? 0)}
            />
            <CompareStat
              label="Weight loss"
              a={weightLossPercent(currentSession) != null ? `${weightLossPercent(currentSession)!.toFixed(1)}%` : "—"}
              b={weightLossPercent(comparisonFull) != null ? `${weightLossPercent(comparisonFull)!.toFixed(1)}%` : "—"}
            />
            <CompareStat
              label="Rating"
              a={currentSession.rating != null ? <RatingBeans rating={currentSession.rating} /> : "—"}
              b={comparisonFull.rating != null ? <RatingBeans rating={comparisonFull.rating} /> : "—"}
            />
            <CompareStat label="Roast level" a={currentSession.roastLevel ?? "—"} b={comparisonFull.roastLevel ?? "—"} />
          </div>

          <p className="text-xs text-muted">
            <Link href={`/roasts/${comparisonFull.id}`} className="underline hover:text-foreground">
              Open {comparisonFull.bean.name}&apos;s roast page →
            </Link>
          </p>
        </>
      ) : candidates.length > 0 ? (
        <p className="text-sm text-muted">Pick a completed roast above to overlay its curve against this one.</p>
      ) : null}
    </div>
  );
}
