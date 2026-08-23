"use client";

import { useEffect, useRef, useState } from "react";
import { useElapsedSeconds } from "@/lib/useElapsedSeconds";
import { formatMMSS } from "@/lib/format";
import Timer from "@/components/roasts/Timer";

function CompactBar({ startedAt, beanName }: { startedAt: string; beanName: string }) {
  const elapsed = useElapsedSeconds(startedAt);
  return (
    <div className="fixed inset-x-0 top-0 z-30 border-b border-border bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-2 sm:px-6">
        <span className="flex items-center gap-2 truncate text-sm font-medium">
          <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-accent" />
          <span className="truncate">{beanName}</span>
        </span>
        <span className="shrink-0 font-mono text-lg font-semibold tabular-nums text-accent">
          {formatMMSS(elapsed)}
        </span>
      </div>
    </div>
  );
}

/**
 * Wraps the big hero Timer with an IntersectionObserver on it — once it
 * scrolls out of view, a slim fixed bar takes over so the elapsed time stays
 * visible while logging events or checking the curve further down the page.
 * Two separate elements rather than one that resizes on scroll: keeps the
 * hero timer's full size (it's meant to dominate the screen while it's in
 * view) without a scroll-linked shrink animation to get right.
 */
export default function LiveTimerBar({ startedAt, beanName }: { startedAt: string; beanName: string }) {
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
      {pinned && <CompactBar startedAt={startedAt} beanName={beanName} />}
    </div>
  );
}
