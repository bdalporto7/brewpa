import { formatMMSS } from "@/lib/format";
import type { RoastPhases } from "@/lib/phases";

const SEGMENTS: { key: keyof RoastPhases & `${string}Percent`; label: string; className: string }[] = [
  { key: "dryingPercent", label: "Drying", className: "bg-border" },
  { key: "yellowingPercent", label: "Yellowing", className: "bg-[var(--mark-dry-end)]" },
  { key: "browningPercent", label: "Browning", className: "bg-accent-soft" },
  { key: "developmentPercent", label: "Development", className: "bg-accent" },
];

export default function PhaseBar({ phases }: { phases: RoastPhases }) {
  const hasAny = SEGMENTS.some((s) => phases[s.key] != null);
  if (!hasAny) return null;

  const seconds: Record<string, number | null> = {
    dryingPercent: phases.dryingSeconds,
    yellowingPercent: phases.yellowingSeconds,
    browningPercent: phases.browningSeconds,
    developmentPercent: phases.developmentSeconds,
  };

  return (
    <div className="rounded-xl border-2 border-[var(--border-strong)] bg-surface shadow-[2px_2px_0_var(--shadow-ink)] p-4">
      <p className="mb-3 text-xs font-medium tracking-wide text-muted uppercase">Roast phases</p>

      <div className="flex h-3 w-full overflow-hidden rounded-full bg-border/40">
        {SEGMENTS.map(
          (s, i) =>
            phases[s.key] != null && (
              <div
                key={s.key}
                className={`pour-fill ${s.className}`}
                style={
                  {
                    // @ts-expect-error -- custom property consumed by the pour-fill keyframe
                    "--fill-width": `${phases[s.key]}%`,
                    // staggered left-to-right, echoing the phases actually happening in sequence
                    animationDelay: `${i * 0.15}s`,
                  }
                }
              />
            )
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
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
          Scott Rao targets a development time ratio (DTR) of roughly 20–25% as a starting
          point, lower on high-powered roasters — not a rule, and it varies by bean and roast level.
        </p>
      )}
    </div>
  );
}
