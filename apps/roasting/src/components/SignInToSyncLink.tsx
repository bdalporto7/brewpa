"use client";

import { LogIn } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";

/**
 * Desktop app only, and only before sync is turned on — Nav.tsx decides
 * when this renders. Opens the hosted app's pairing page in the *system*
 * browser rather than navigating this window to a local /login — this
 * app's own local Next server has no OAuth secrets to sign in with at all
 * (see auth.ts's desktopAuth), so real sign-in only ever happens on the
 * hosted deployment. main.ts hands the resulting SyncToken back over a
 * cybarcoffee:// deep link and relaunches the app once it lands.
 */
export default function SignInToSyncLink({ iconOnly = false }: { iconOnly?: boolean }) {
  const toast = useToast();

  function handleClick() {
    if (!window.cybarDesktop) {
      toast("Sign-in isn't available here.", "error");
      return;
    }
    window.cybarDesktop.startSyncPairing();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Sign in to sync"
      title="Sign in to sync"
      className="flex items-center gap-1 text-panel-muted transition hover:text-panel-fg"
    >
      <LogIn className="h-4 w-4" />
      {!iconOnly && <span className="hidden sm:inline">Sign in to sync</span>}
    </button>
  );
}
