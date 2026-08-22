"use client";

import { useElapsedSeconds } from "@/lib/useElapsedSeconds";
import { formatMMSS } from "@/lib/format";

export default function Timer({ startedAt }: { startedAt: string }) {
  const elapsed = useElapsedSeconds(startedAt);

  return (
    <div className="flex flex-col items-center">
      <span className="font-mono text-6xl font-semibold tabular-nums tracking-tight text-accent sm:text-7xl">
        {formatMMSS(elapsed)}
      </span>
      <span className="mt-1 flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted uppercase">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
        Roasting
      </span>
    </div>
  );
}
