import { buildRoastCurveSvg } from "@/lib/curve";
import type { RoastEvent } from "@prisma/client";

export default function RoastCurveChart({
  events,
  totalSeconds,
}: {
  events: RoastEvent[];
  totalSeconds: number;
}) {
  const svg = buildRoastCurveSvg(events, totalSeconds);

  if (!svg) {
    return (
      <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted">
        Log at least two temperature readings during a roast to see its curve here.
      </p>
    );
  }

  return (
    <div
      className="overflow-x-auto rounded-lg border border-border bg-surface p-4"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
