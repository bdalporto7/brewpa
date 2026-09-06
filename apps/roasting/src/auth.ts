import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Real per-user OAuth (each person signs in with their own GitHub or Google
 * account) gated to an allowlist of emails stored in the AllowedUser table
 * — not open sign-up. Managed live from the /admin portal (isAdmin-gated)
 * instead of the old ALLOWED_EMAILS env var, so admitting someone no longer
 * needs a redeploy. Still deliberately not multi-tenant across companies:
 * teams (Team model) share data internally, but there's no invite-across-
 * teams flow or self-serve signup — a team's members are still added one
 * at a time from /admin.
 *
 * This only ever runs on the hosted deployment now — the desktop app never
 * performs OAuth itself (see desktopAuth below and src/lib/desktop-pair-
 * actions.ts), so there's no loopback origin to trust and no reason for
 * `trustHost` to vary by APP_MODE. Auth.js auto-trusts recognized hosting
 * platforms (Vercel, etc.) when this is left `undefined`; an explicit
 * `false` disables that and broke every sign-in in production once before
 * (confirmed live) — left as `undefined` unconditionally.
 */
const nextAuth = NextAuth({
  providers: [GitHub, Google],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    signIn: async ({ user }) => {
      const email = user.email?.toLowerCase();
      if (!email) return false;
      const allowed = await prisma.allowedUser.findUnique({ where: { email } });
      return !!allowed;
    },
    authorized: ({ auth }) => !!auth?.user,
  },
});

/**
 * The desktop app (apps/desktop, APP_MODE=desktop) is a single build that
 * works fully offline/local with no sign-in by default — general users
 * never see a login screen — and lets one specific person sign in later to
 * turn on sync with the hosted DB. `desktopAuth` gives every page a session
 * unconditionally (a fabricated one, never a real NextAuth session) so
 * nothing in the app has to handle "no user" as a state; `proxy.ts`
 * re-exports this same symbol as Next's middleware (called with a request)
 * and never blocks a request — the desktop app has no login wall at all,
 * signed in or not — while everywhere else in the app it's called as a
 * plain `await auth()` to read the current session. One export serving
 * both roles, so this has to handle both call shapes.
 *
 * There is deliberately no local OAuth here anymore. Real sign-in happens
 * entirely on the hosted deployment (src/app/desktop/pair/page.tsx +
 * src/lib/desktop-pair-actions.ts), which hands a SyncToken back to the
 * desktop app over a `cybarcoffee://` deep link — see
 * apps/desktop/src-ts/main.ts. That's what makes a build with zero bundled
 * secrets possible at all: this app's own local Next server never needs a
 * GitHub/Google OAuth client secret or a Turso credential, because it
 * never performs OAuth or talks to the remote DB directly. Once paired,
 * main.ts passes the confirmed email through as DESKTOP_SYNCED_EMAIL — a
 * plain env var, not a session cookie, since there's no real login request
 * to attach a cookie to.
 *
 * DESKTOP_GUEST_EMAIL is a fixed constant, not a real account — the
 * desktop app's first-run migration runner (apps/desktop/src-ts/migrate.ts)
 * seeds exactly one AllowedUser row with this email (isAdmin: true) into a
 * fresh local DB, so admin-gated code (requireAdmin(), src/lib/admin.ts)
 * keeps working before anyone has signed in for real. Keep these in sync
 * if either side changes.
 */
export const DESKTOP_GUEST_EMAIL = "local@cybar.app";

function fabricatedSession(email: string, name: string) {
  return {
    user: { email, name },
    expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString(),
  };
}

function desktopAuth(...args: unknown[]) {
  // Called as `proxy(request, event)` by Next's middleware runtime — let
  // every request through, synced or not. There's no login wall in the
  // desktop app; a locally-fabricated session (below) always stands in
  // for a real one.
  if (args.length > 0) return NextResponse.next();
  // Called as `await auth()` everywhere else in the app. Once paired, the
  // synced person's real email (confirmed by the hosted pairing page, not
  // by anything checkable locally) stands in for a session; before that,
  // the fixed local guest identity does.
  const syncedEmail = process.env.DESKTOP_SYNCED_EMAIL;
  const session = syncedEmail
    ? fabricatedSession(syncedEmail, "Synced User")
    : fabricatedSession(DESKTOP_GUEST_EMAIL, "Local User");
  return Promise.resolve(session);
}

export const handlers = nextAuth.handlers;
export const signIn = nextAuth.signIn;
export const signOut = nextAuth.signOut;
export const auth = (process.env.APP_MODE === "desktop" ? desktopAuth : nextAuth.auth) as typeof nextAuth.auth;
