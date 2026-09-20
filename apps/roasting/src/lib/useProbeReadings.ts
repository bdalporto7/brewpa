"use client";

import { useCallback, useSyncExternalStore } from "react";

export interface ProbeReading {
  id: string;
  tempFahrenheit: number;
  atSeconds: number | null;
  recordedAt: string;
  probeType: string;
}

const POLL_MS = 1000;
// Re-asks for a little before the newest reading we have, deduping by id —
// so a row that lands in the same millisecond as the cursor can't be missed.
const CURSOR_OVERLAP_MS = 2000;

type Store = {
  readings: ProbeReading[] | null;
  cursor: number;
  listeners: Set<() => void>;
  timer: ReturnType<typeof setInterval> | null;
  onVisible: () => void;
  inflight: boolean;
};

const stores = new Map<string, Store>();

async function poll(roastSessionId: string, store: Store) {
  // A hidden tab has nothing to show and, with several tabs open, would
  // otherwise multiply the load on the database for no benefit.
  if (store.inflight || (typeof document !== "undefined" && document.hidden)) return;
  store.inflight = true;
  try {
    const query = store.cursor > 0 ? `?after=${store.cursor - CURSOR_OVERLAP_MS}` : "";
    const res = await fetch(`/api/roasts/${roastSessionId}/temperature${query}`, { cache: "no-store" });
    if (!res.ok) return;
    const { readings: incoming } = (await res.json()) as { readings: ProbeReading[] };

    let changed = false;
    if (store.readings === null) {
      store.readings = incoming;
      changed = true;
    } else if (incoming.length > 0) {
      const seen = new Set(store.readings.map((r) => r.id));
      const fresh = incoming.filter((r) => !seen.has(r.id));
      if (fresh.length > 0) {
        store.readings = [...store.readings, ...fresh];
        changed = true;
      }
    }
    for (const r of incoming) store.cursor = Math.max(store.cursor, Date.parse(r.recordedAt));
    if (changed) store.listeners.forEach((notify) => notify());
  } catch {
    // Network hiccup — next poll will retry.
  } finally {
    store.inflight = false;
  }
}

function subscribeToStore(roastSessionId: string, notify: () => void): () => void {
  let store = stores.get(roastSessionId);
  if (!store) {
    const created: Store = {
      readings: null,
      cursor: 0,
      listeners: new Set(),
      timer: null,
      inflight: false,
      onVisible: () => {
        if (!document.hidden) void poll(roastSessionId, created);
      },
    };
    store = created;
    stores.set(roastSessionId, store);
  }
  store.listeners.add(notify);

  const active = store;
  if (!active.timer) {
    void poll(roastSessionId, active);
    active.timer = setInterval(() => void poll(roastSessionId, active), POLL_MS);
    document.addEventListener("visibilitychange", active.onVisible);
  }

  return () => {
    active.listeners.delete(notify);
    if (active.listeners.size === 0) {
      if (active.timer) clearInterval(active.timer);
      active.timer = null;
      document.removeEventListener("visibilitychange", active.onVisible);
      stores.delete(roastSessionId);
    }
  };
}

/**
 * The live probe feed for a pending/live roast, shared by everything on the
 * page that needs it (the chart, LiveProbePanel, LiveTipsPanel,
 * LiveRoastBars) — one poll per roast per tab, no matter how many of them
 * mount. The first fetch pulls the full series; after that it only asks for
 * rows newer than the last one it has (`?after=`), about once a second, and
 * appends. Pauses while the tab is hidden. Returns null until the first
 * response lands.
 */
export function useProbeReadings(roastSessionId: string): ProbeReading[] | null {
  const subscribe = useCallback(
    (notify: () => void) => subscribeToStore(roastSessionId, notify),
    [roastSessionId]
  );
  const getSnapshot = useCallback(() => stores.get(roastSessionId)?.readings ?? null, [roastSessionId]);
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}
