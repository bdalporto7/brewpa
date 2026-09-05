import { app, Notification } from "electron";
import { setTrayStatusText } from "./tray";

interface DesktopStatus {
  active: boolean;
  roastId?: string;
  beanName?: string;
  startedAt?: string;
  latestTempF?: number | null;
  latestMilestone?: { type: string; atSeconds: number } | null;
}

const MILESTONE_LABELS: Record<string, string> = {
  DRY_END: "Dry end",
  YELLOWING_END: "Yellowing end",
  FIRST_CRACK_START: "First crack started",
  FIRST_CRACK_END: "First crack ended",
  SECOND_CRACK_START: "Second crack started",
  SECOND_CRACK_END: "Second crack ended",
};

/**
 * Polls src/app/api/desktop/status (apps/roasting) so the tray title, dock
 * badge, and milestone notifications stay live without the window ever
 * needing focus — the actual point of a native tray/notification surface.
 * A plain interval poll rather than anything push-based: the interval
 * (10s default) is already close enough to instant for a multi-minute
 * roast, and it means this has no server-side dependency beyond the one
 * read-only route, no websocket/SSE plumbing to keep alive.
 *
 * `hasBaseline` exists so a fresh app launch never fires a stale
 * notification for a roast/milestone that was already in progress before
 * this process started polling — the first successful poll only records
 * where things stand, and every notification after that reflects a real
 * transition witnessed live.
 */
export function startStatusPoller(apiBase: string, intervalMs = 10_000): { stop: () => void; isActive: () => boolean } {
  let hasBaseline = false;
  let lastRoastId: string | null = null;
  let lastMilestoneKey: string | null = null;
  let wasActive = false;
  let stopped = false;

  async function poll() {
    if (stopped) return;
    let status: DesktopStatus;
    try {
      const res = await fetch(`${apiBase}/api/desktop/status`);
      status = (await res.json()) as DesktopStatus;
    } catch {
      return; // server not up yet, or a transient blip — just try again next tick
    }

    if (!status.active) {
      if (hasBaseline && wasActive) {
        setTrayStatusText("");
        app.dock?.setBadge("");
        if (lastRoastId) new Notification({ title: "Roast complete", body: "Nice work." }).show();
      }
      wasActive = false;
      lastRoastId = null;
      lastMilestoneKey = null;
      hasBaseline = true;
      return;
    }

    const roastId = status.roastId ?? null;
    const isNewRoast = roastId !== lastRoastId;
    if (isNewRoast) {
      if (hasBaseline) {
        new Notification({
          title: "Roast started",
          body: status.beanName ? `Roasting ${status.beanName}.` : "A new roast just started.",
        }).show();
      }
      lastRoastId = roastId;
      lastMilestoneKey = null;
    }

    const elapsedSeconds = status.startedAt ? Math.max(0, Math.floor((Date.now() - new Date(status.startedAt).getTime()) / 1000)) : 0;
    const mm = Math.floor(elapsedSeconds / 60);
    const ss = String(elapsedSeconds % 60).padStart(2, "0");
    const tempPart = status.latestTempF != null ? `${Math.round(status.latestTempF)}°F · ` : "";
    setTrayStatusText(`${tempPart}${mm}:${ss}`);
    app.dock?.setBadge(`${mm}:${ss}`);

    const milestone = status.latestMilestone ?? null;
    const milestoneKey = milestone ? `${milestone.type}@${milestone.atSeconds}` : null;
    if (milestoneKey && milestoneKey !== lastMilestoneKey) {
      const isFirstObservedMilestone = lastMilestoneKey === null;
      lastMilestoneKey = milestoneKey;
      if (hasBaseline && !(isNewRoast && isFirstObservedMilestone)) {
        const label = MILESTONE_LABELS[milestone!.type] ?? milestone!.type;
        new Notification({ title: label, body: status.beanName ?? "" }).show();
      }
    }

    wasActive = true;
    hasBaseline = true;
  }

  const timer = setInterval(poll, intervalMs);
  poll();

  return {
    stop: () => {
      stopped = true;
      clearInterval(timer);
    },
    isActive: () => wasActive,
  };
}
