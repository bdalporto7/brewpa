import { auth, DESKTOP_GUEST_EMAIL } from "@/auth";
import { getCurrentAllowedUser } from "@/lib/admin";
import NavClient from "@/components/NavClient";

export default async function Nav() {
  const session = await auth();
  if (!session?.user) return null;

  const currentUser = await getCurrentAllowedUser();

  const isDesktopApp = process.env.APP_MODE === "desktop";
  const isSyncEnabled = process.env.DESKTOP_SYNC_ENABLED === "true";
  // The desktop app always has *some* session (auth.ts's desktopAuth falls
  // back to a fixed guest identity) — this is the only way to tell "still
  // just the local guest" apart from "actually signed in for real," which
  // decides between showing "Sign in to sync" vs. "restart to finish
  // enabling sync" below.
  const isGuestSession = session.user.email === DESKTOP_GUEST_EMAIL;

  return (
    <header className="bg-panel-bg" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <NavClient
        isAdmin={!!currentUser?.isAdmin}
        isDesktopApp={isDesktopApp}
        isSyncEnabled={isDesktopApp && isSyncEnabled}
        showSignInToSync={isDesktopApp && !isSyncEnabled && isGuestSession}
        showRestartToSync={isDesktopApp && !isSyncEnabled && !isGuestSession}
      />
      {/* Torn-cardboard seam into the page below, instead of a straight
          border — same clip-path zigzag technique as DecoratedEmptyState's
          dashed border, just cut from the panel's own dark fill so the
          page's cream background shows through the notches. */}
      <div
        aria-hidden="true"
        className="h-2.5 bg-panel-bg sm:h-3"
        style={{
          clipPath:
            "polygon(0 0,100% 0,100% 45%,96% 100%,92% 42%,88% 100%,84% 42%,80% 100%,76% 42%,72% 100%,68% 42%,64% 100%,60% 42%,56% 100%,52% 42%,48% 100%,44% 42%,40% 100%,36% 42%,32% 100%,28% 42%,24% 100%,20% 42%,16% 100%,12% 42%,8% 100%,4% 42%,0 100%)",
        }}
      />
    </header>
  );
}
