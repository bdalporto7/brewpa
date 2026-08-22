import { formatMMSS } from "@/lib/format";
import { SR800_LEVEL_MIN, SR800_LEVEL_MAX, type EventType } from "@/lib/constants";
import type { RoastEvent } from "@prisma/client";

const WIDTH = 760;
const HEIGHT = 380;
const MARGIN_LEFT = 44;
const MARGIN_RIGHT = 16;
const MARGIN_TOP = 20;
const AXIS_HEIGHT = 24;
const STRIP_HEIGHT = 48;
const STRIP_GAP = 16;

const CRACK_MARKERS: { type: EventType; label: string; color: string }[] = [
  { type: "FIRST_CRACK_START", label: "1C", color: "var(--mark-first-crack)" },
  { type: "FIRST_CRACK_END", label: "1C end", color: "var(--mark-first-crack)" },
  { type: "SECOND_CRACK_START", label: "2C", color: "var(--mark-second-crack)" },
  { type: "SECOND_CRACK_END", label: "2C end", color: "var(--mark-second-crack)" },
];

function buildStepPath(
  points: { atSeconds: number; level: number }[],
  totalSeconds: number,
  x: (s: number) => number,
  y: (level: number) => number
): string {
  if (points.length === 0) return "";
  let path = `M ${x(points[0].atSeconds)} ${y(points[0].level)}`;
  for (let i = 1; i < points.length; i++) {
    path += ` L ${x(points[i].atSeconds)} ${y(points[i - 1].level)} L ${x(points[i].atSeconds)} ${y(points[i].level)}`;
  }
  path += ` L ${x(totalSeconds)} ${y(points[points.length - 1].level)}`;
  return path;
}

export default function RoastCurveChart({
  events,
  totalSeconds,
}: {
  events: RoastEvent[];
  totalSeconds: number;
}) {
  const tempPoints = events
    .filter((e) => e.type === "TEMP" && e.tempFahrenheit != null)
    .map((e) => ({ atSeconds: e.atSeconds, temp: e.tempFahrenheit as number }))
    .sort((a, b) => a.atSeconds - b.atSeconds);

  if (tempPoints.length < 2) {
    return (
      <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted">
        Log at least two temperature readings during a roast to see its curve here.
      </p>
    );
  }

  const duration = Math.max(totalSeconds, tempPoints[tempPoints.length - 1].atSeconds, 1);

  const rawMin = Math.min(...tempPoints.map((p) => p.temp));
  const rawMax = Math.max(...tempPoints.map((p) => p.temp));
  const minTemp = Math.floor((rawMin - 15) / 25) * 25;
  const maxTemp = Math.ceil((rawMax + 15) / 25) * 25;

  const chartLeft = MARGIN_LEFT;
  const chartRight = WIDTH - MARGIN_RIGHT;
  const chartWidth = chartRight - chartLeft;
  const tempChartTop = MARGIN_TOP;
  const tempChartHeight = HEIGHT - MARGIN_TOP - AXIS_HEIGHT - STRIP_HEIGHT - STRIP_GAP;
  const tempChartBottom = tempChartTop + tempChartHeight;
  const stripTop = tempChartBottom + STRIP_GAP;
  const stripBottom = stripTop + STRIP_HEIGHT;

  const x = (seconds: number) => chartLeft + (seconds / duration) * chartWidth;
  const yTemp = (temp: number) =>
    tempChartTop + (1 - (temp - minTemp) / (maxTemp - minTemp)) * tempChartHeight;
  const yLevel = (level: number) =>
    stripTop + (1 - (level - SR800_LEVEL_MIN) / (SR800_LEVEL_MAX - SR800_LEVEL_MIN)) * STRIP_HEIGHT;

  const tempLine = tempPoints.map((p) => `${x(p.atSeconds)},${yTemp(p.temp)}`).join(" ");

  const tempTicks = [minTemp, (minTemp + maxTemp) / 2, maxTemp];
  const timeTickCount = duration > 600 ? 6 : 4;
  const timeTicks = Array.from({ length: timeTickCount + 1 }, (_, i) => (duration / timeTickCount) * i);

  const fanPoints = events
    .filter((e) => e.type === "FAN" && e.fanLevel != null)
    .map((e) => ({ atSeconds: e.atSeconds, level: e.fanLevel as number }))
    .sort((a, b) => a.atSeconds - b.atSeconds);
  const heatPoints = events
    .filter((e) => e.type === "HEAT" && e.heatLevel != null)
    .map((e) => ({ atSeconds: e.atSeconds, level: e.heatLevel as number }))
    .sort((a, b) => a.atSeconds - b.atSeconds);

  const markers = CRACK_MARKERS.map((m) => ({
    ...m,
    event: events.find((e) => e.type === m.type),
  })).filter((m) => m.event);
  const dropEvent = events.find((e) => e.type === "DROP");

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface p-4">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full min-w-[560px]" role="img" aria-label="Roasting curve">
        {tempTicks.map((t) => (
          <g key={t}>
            <line
              x1={chartLeft}
              x2={chartRight}
              y1={yTemp(t)}
              y2={yTemp(t)}
              className="stroke-border"
              strokeWidth={1}
            />
            <text x={chartLeft - 8} y={yTemp(t)} textAnchor="end" dominantBaseline="middle" className="fill-muted font-mono text-[10px]">
              {Math.round(t)}°
            </text>
          </g>
        ))}

        {timeTicks.map((t) => (
          <text
            key={t}
            x={x(t)}
            y={tempChartBottom + AXIS_HEIGHT + STRIP_HEIGHT + STRIP_GAP - 6}
            textAnchor="middle"
            className="fill-muted font-mono text-[10px]"
          >
            {formatMMSS(t)}
          </text>
        ))}

        {markers.map(
          (m) =>
            m.event && (
              <g key={m.type}>
                <line
                  x1={x(m.event.atSeconds)}
                  x2={x(m.event.atSeconds)}
                  y1={tempChartTop}
                  y2={tempChartBottom}
                  stroke={m.color}
                  strokeWidth={1.5}
                  strokeDasharray="3 3"
                />
                <text
                  x={x(m.event.atSeconds)}
                  y={tempChartTop - 6}
                  textAnchor="middle"
                  style={{ fill: m.color }}
                  className="text-[9px] font-medium"
                >
                  {m.label}
                </text>
              </g>
            )
        )}

        {dropEvent && (
          <line
            x1={x(dropEvent.atSeconds)}
            x2={x(dropEvent.atSeconds)}
            y1={tempChartTop}
            y2={tempChartBottom}
            style={{ stroke: "var(--mark-drop)" }}
            strokeWidth={1.5}
          />
        )}

        <polyline points={tempLine} fill="none" className="stroke-accent" strokeWidth={2.5} strokeLinejoin="round" />
        {tempPoints.map((p) => (
          <circle key={p.atSeconds} cx={x(p.atSeconds)} cy={yTemp(p.temp)} r={2.5} className="fill-accent" />
        ))}

        <text x={chartLeft} y={stripTop - 6} className="fill-muted text-[9px] font-medium">
          Fan
        </text>
        <text x={chartLeft + 28} y={stripTop - 6} className="fill-foreground/60 text-[9px] font-medium">
          Heat
        </text>
        {fanPoints.length > 0 && (
          <path
            d={buildStepPath(fanPoints, duration, x, yLevel)}
            fill="none"
            className="stroke-accent"
            strokeWidth={1.5}
            opacity={0.7}
          />
        )}
        {heatPoints.length > 0 && (
          <path
            d={buildStepPath(heatPoints, duration, x, yLevel)}
            fill="none"
            className="stroke-foreground"
            strokeWidth={1.5}
            opacity={0.35}
          />
        )}
        <line x1={chartLeft} x2={chartRight} y1={stripBottom} y2={stripBottom} className="stroke-border" strokeWidth={1} />
      </svg>
    </div>
  );
}
