import Link from "next/link";
import { LogIn } from "lucide-react";

/**
 * Desktop app only, and only for the guest (never-signed-in) session —
 * Nav.tsx decides when this renders. Routes to the existing /login page
 * rather than triggering a provider directly: that page already offers
 * both GitHub and Google, and most people who click this won't actually
 * be on the allowlist (this app isn't gating who *sees* the link, only
 * who successfully signs in — see auth.ts's signIn callback), so picking
 * a provider there instead of guessing one here is the right amount of
 * friction for something that's a no-op for most visitors anyway.
 */
export default function SignInToSyncLink({ iconOnly = false }: { iconOnly?: boolean }) {
  return (
    <Link
      href="/login"
      aria-label="Sign in to sync"
      title="Sign in to sync"
      className="flex items-center gap-1 text-panel-muted transition hover:text-panel-fg"
    >
      <LogIn className="h-4 w-4" />
      {!iconOnly && <span className="hidden sm:inline">Sign in to sync</span>}
    </Link>
  );
}
