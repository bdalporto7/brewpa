"use client";

import { useState } from "react";
import { Unlink } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";

/**
 * Only rendered once sync is on (Nav.tsx gates it) — this install's
 * desktop-equivalent of "log out." There's no real login session to sign
 * out of in the desktop app (see auth.ts's desktopAuth), so this instead
 * clears desktop-config.json's syncToken/syncedEmail and relaunches back
 * to the local guest identity, the same way turning sync *on* only takes
 * effect on the next launch (main.ts reads that file once, at startup).
 */
export default function DisableSyncButton({ iconOnly = false }: { iconOnly?: boolean }) {
  const [isDisabling, setIsDisabling] = useState(false);
  const toast = useToast();

  function handleDisable() {
    if (!window.cybarDesktop) {
      toast("Sync isn't available here.", "error");
      return;
    }
    setIsDisabling(true);
    window.cybarDesktop.disableSync();
  }

  return (
    <button
      type="button"
      onClick={handleDisable}
      disabled={isDisabling}
      aria-label="Disable sync"
      title="Disable sync"
      className="flex items-center gap-1 text-panel-muted transition hover:text-panel-fg disabled:opacity-50"
    >
      <Unlink className="h-4 w-4" />
      {!iconOnly && <span className="hidden sm:inline">{isDisabling ? "Disabling…" : "Disable sync"}</span>}
    </button>
  );
}
