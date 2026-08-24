"use client";

import { useEffect, useRef, useState } from "react";
import { useElapsedSeconds } from "@/lib/useElapsedSeconds";
import { formatMMSS } from "@/lib/format";
import Timer from "@/components/roasts/Timer";

function CompactBar({ startedAt, beanName }: { startedAt: string; beanName: string }) {
  const elapsed = useElapsedSeconds(startedAt);
  return (
    <div className="fixed inset-x-0 top-0 z-30 bg-accent shadow-lg">
      <div className="mx-auto flex max-w-4xl flex-col items-center px-4 py-2 sm:py-3">
        <span className="flex items-center gap-2 text-accent-foreground/80">
          <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-accent-foreground" />
          <span className="truncate text-xs font-medium sm:text-sm">{beanName}</span>
        </span>
        <span className="font-mono text-7xl leading-none font-bold tabular-nums text-accent-foreground sm:text-8xl">
          {formatMMSS(elapsed)}
        </span>
      </div>
    </div>
  );
}

/**
 * Wraps the big hero Timer with an IntersectionObserver on it — once it
 * scrolls out of view, a fixed bar takes over so the elapsed time stays
 * visible while logging events or checking the curve further down the page.
 * Two separate elements rather than one that resizes on scroll: keeps the
 * hero timer's full size (it's meant to dominate the screen while it's in
 * view) without a scroll-linked shrink animation to get right. The pinned
 * bar is deliberately loud — solid accent background, large bold digits —
 * rather than a slim/muted status strip: the point is catching it at a
 * glance from across the room while watching the physical roaster, not
 * quietly confirming it's still there.
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
