import { formatMMSS } from "@/lib/format";
import type { RoastMetrics } from "@/lib/roastMetrics";
import Card from "@/components/ui/Card";
import Eyebrow from "@/components/ui/Eyebrow";

const fmtTemp = (v: number | null) => (v == null ? "—" : `${v.toFixed(1)}°F`);
const fmtDelta = (v: number | null) => (v == null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(1)}°F`);
const fmtRor = (v: number | null) => (v == null ? "—" : `${v.toFixed(1)}°F/min`);

function Moment({ label, temp, atSeconds }: { label: string; temp: number | null; atSeconds: number | null }) {
  return (
    <div>
      <p className="text-muted">{label}</p>
      <p className="font-mono">{fmtTemp(temp)}</p>
      <p className="font-mono text-muted">{atSeconds != null ? formatMMSS(atSeconds) : ""}</p>
    </div>
  );
}

/**
 * Temp at each milestone plus per-phase temperature gain and RoR — the same
 * numbers Artisan shows beside a curve (see roastMetrics.ts for how they're
 * derived and the conventions kept to match it). Phase length/percent live in
 * PhaseBar right above, so they aren't repeated here.
 */
export default function RoastMetricsCard({ metrics }: { metrics: RoastMetrics }) {
  const phases = [
    {
      label: "Drying",
      color: "var(--phase-drying)",
      // A roaster whose probe never dips after charge (an SR800 starting
      // cold) has no turning point; the gain is measured from the start.
      note: metrics.turningPoint ? "from turning point" : "from start",
      phase: metrics.drying,
    },
    { label: "Maillard", color: "var(--phase-browning)", note: "dry end → 1st crack", phase: metrics.maillard },
    { label: "Development", color: "var(--phase-development)", note: "1st crack → drop", phase: metrics.development },
  ].filter((p) => p.phase != null);

  const hasMoments = metrics.turningPoint || metrics.dryEnd || metrics.firstCrack || metrics.drop;
  if (!hasMoments && phases.length === 0) return null;

  return (
    <Card interactive={false} className="p-4">
      <Eyebrow className="mb-3">Roast metrics</Eyebrow>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs sm:grid-cols-5">
        <Moment label="Charge" temp={metrics.chargeTempF} atSeconds={metrics.chargeTempF != null ? 0 : null} />
        <Moment
          label="Turning point"
          temp={metrics.turningPoint?.tempF ?? null}
          atSeconds={metrics.turningPoint?.atSeconds ?? null}
        />
        <Moment label="Dry end" temp={metrics.dryEnd?.tempF ?? null} atSeconds={metrics.dryEnd?.atSeconds ?? null} />
        <Moment
          label="First crack"
          temp={metrics.firstCrack?.tempF ?? null}
          atSeconds={metrics.firstCrack?.atSeconds ?? null}
        />
        <Moment label="Drop" temp={metrics.drop?.tempF ?? null} atSeconds={metrics.drop?.atSeconds ?? null} />
      </div>

      {phases.length > 0 && (
        <table className="mt-4 w-full text-xs">
          <thead>
            <tr className="text-left text-muted">
              <th className="pb-1 font-normal">Phase</th>
              <th className="pb-1 text-right font-normal">Temp gain</th>
              <th className="pb-1 text-right font-normal">Avg RoR</th>
            </tr>
          </thead>
          <tbody>
            {phases.map(({ label, color, note, phase }) => (
              <tr key={label} className="border-t border-border">
                <td className="py-1.5">
                  <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ backgroundColor: color }} />
                  {label} <span className="text-muted">· {note}</span>
                </td>
                <td className="py-1.5 text-right font-mono">{fmtDelta(phase!.deltaTempF)}</td>
                <td className="py-1.5 text-right font-mono">{fmtRor(phase!.avgRorPerMin)}</td>
              </tr>
            ))}
            {metrics.overallRorPerMin != null && (
              <tr className="border-t border-border">
                <td className="py-1.5 text-muted">Overall · {metrics.turningPoint ? "turning point" : "start"} → drop</td>
                <td />
                <td className="py-1.5 text-right font-mono">{fmtRor(metrics.overallRorPerMin)}</td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {metrics.rorAtFirstCrackPerMin != null && (
        <p className="mt-3 text-xs text-muted">
          RoR at first crack: <span className="font-mono text-foreground">{fmtRor(metrics.rorAtFirstCrackPerMin)}</span>
        </p>
      )}
    </Card>
  );
}
