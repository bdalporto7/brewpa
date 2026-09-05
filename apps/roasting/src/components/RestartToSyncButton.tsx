"use client";

import { useState } from "react";
import { RotateCw } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";

/**
 * Only rendered once a real, allowlisted sign-in has happened but hasn't
 * taken effect yet (Nav.tsx's showRestartToSync) — the local database has
 * to switch from a plain file to a synced replica, which src/auth.ts and
 * main.ts only do at process startup, never mid-request. A real one-click
 * restart via apps/desktop/src-ts/preload.ts's IPC bridge, not a passive
 * "please restart yourself" message: confirmed live that people don't
 * reliably know closing the window isn't the same as quitting (macOS
 * leaves the app running with no window either way), so a text hint alone
 * left the app looking hung rather than actually finishing the switch.
 * window.cybarDesktop only exists inside the real Electron app (wired via
 * a preload script) — the guard is defensive, not expected to fire, since
 * Nav.tsx already gates this to APP_MODE=desktop.
 */
export default function RestartToSyncButton() {
  const [isRestarting, setIsRestarting] = useState(false);
  const toast = useToast();

  function handleRestart() {
    if (!window.cybarDesktop) {
      toast("Quit and reopen Cybar Coffee to finish enabling sync.", "error");
      return;
    }
    setIsRestarting(true);
    window.cybarDesktop.restartApp();
  }

  return (
    <button
      type="button"
      onClick={handleRestart}
      disabled={isRestarting}
      aria-label="Restart to finish syncing"
      title="Restart to finish syncing"
      className="flex items-center gap-1 text-panel-muted transition hover:text-panel-fg disabled:opacity-50"
    >
      <RotateCw className={`h-4 w-4 ${isRestarting ? "animate-spin" : ""}`} />
      <span className="hidden sm:inline">{isRestarting ? "Restarting…" : "Restart to sync"}</span>
    </button>
  );
}
