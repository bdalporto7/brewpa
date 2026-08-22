"use client";

import { useEffect, useState } from "react";

export function useElapsedSeconds(startedAt: string): number {
  const startMs = new Date(startedAt).getTime();
  const [elapsed, setElapsed] = useState(() => Math.max(0, (Date.now() - startMs) / 1000));

  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Math.max(0, (Date.now() - startMs) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [startMs]);

  return elapsed;
}
