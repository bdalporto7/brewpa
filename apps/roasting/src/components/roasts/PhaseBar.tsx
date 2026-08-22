import { formatMMSS } from "@/lib/format";
import type { RoastPhases } from "@/lib/phases";

const SEGMENTS: { key: keyof RoastPhases & `${string}Percent`; label: string; className: string }[] = [
  { key: "dryingPercent", label: "Drying", className: "bg-border" },
  { key: "maillardPercent", label: "Maillard", className: "bg-accent-soft" },
  { key: "developmentPercent", label: "Development", className: "bg-accent" },
];

export default function PhaseBar({ phases }: { phases: RoastPhases }) {
  const hasAny = SEGMENTS.some((s) => phases[s.key] != null);
  if (!hasAny) return null;

  const seconds: Record<string, number | null> = {
    dryingPercent: phases.dryingSeconds,
    maillardPercent: phases.maillardSeconds,
    developmentPercent: phases.developmentSeconds,
  };

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="mb-3 text-xs font-medium tracking-wide text-muted uppercase">Roast phases</p>

      <div className="flex h-3 w-full overflow-hidden rounded-full bg-border/40">
        {SEGMENTS.map(
          (s) =>
            phases[s.key] != null && (
              <div key={s.key} className={s.className} style={{ width: `${phases[s.key]}%` }} />
            )
        )}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        {SEGMENTS.map((s) => (
          <div key={s.key}>
            <p className="text-muted">{s.label}</p>
            <p className="font-mono">
              {seconds[s.key] != null ? `${formatMMSS(seconds[s.key]!)} · ${phases[s.key]!.toFixed(0)}%` : "—"}
            </p>
          </div>
        ))}
      </div>

      {phases.developmentPercent != null && (
        <p className="mt-3 text-xs text-muted">
          Development time is commonly cited around 15–25% of total roast time as a general
          starting point (Scott Rao) — not a rule, and it varies by bean and target roast level.
        </p>
      )}
    </div>
  );
}
