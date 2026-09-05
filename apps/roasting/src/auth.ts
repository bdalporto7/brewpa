import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { NextResponse } from "next/server";
import { createClient } from "@libsql/client";
import * as fs from "node:fs";
import { prisma } from "@/lib/prisma";

/**
 * Real per-user OAuth (each person signs in with their own GitHub or Google
 * account) gated to an allowlist of emails stored in the AllowedUser table
 * — not open sign-up. Managed live from the /admin portal (isAdmin-gated)
 * instead of the old ALLOWED_EMAILS env var, so admitting someone no longer
 * needs a redeploy. Still deliberately not multi-tenant: there's no
 * Organization model, no invite flow, no per-org data. See AGENTS.md's
 * "Multi-device / sharing with a friend" section for why that's a
 * scoped-down first cut, not the full thing.
 */
const nextAuth = NextAuth({
  providers: [GitHub, Google],
  pages: {
    signIn: "/login",
  },
  // Auth.js only auto-trusts recognized hosting platforms (Vercel, etc.)
  // for constructing callback URLs from the request's Host header — a
  // fixed loopback origin like the desktop app's localhost:41823 throws
  // UntrustedHost without this. Gated to the desktop app specifically: the
  // hosted deployment runs on Vercel (already trusted) and shouldn't have
  // its trust model loosened for a case that doesn't apply to it. True for
  // every desktop launch, synced or not — real sign-in has to work even
  // before sync is turned on (see desktopAuth below).
  trustHost: process.env.APP_MODE === "desktop",
  callbacks: {
    signIn: async ({ user }) => {
      const email = user.email?.toLowerCase();
      if (!email) return false;

      // Before sync is turned on, the desktop app's local DB is just a
      // plain local file — it has no AllowedUser rows except the guest one
      // seeded at first launch (apps/desktop/src-ts/migrate.ts), so the
      // real signed-in user's row genuinely isn't there yet. The whole
      // point of signing in is to pull that data down, so the allowlist
      // check itself has to reach the *remote* hosted DB directly instead
      // of the local Prisma connection. Once sync is on, the local replica
      // mirrors the remote and the normal `prisma` check below is
      // equivalent and used instead.
      if (process.env.APP_MODE === "desktop" && process.env.DESKTOP_SYNC_ENABLED !== "true") {
        const url = process.env.TURSO_DATABASE_URL;
        const authToken = process.env.TURSO_AUTH_TOKEN;
        if (!url || !authToken) return false;
        const remote = createClient({ url, authToken });
        try {
          const result = await remote.execute({
            sql: "SELECT id FROM AllowedUser WHERE email = ?",
            args: [email],
          });
          const allowed = result.rows.length > 0;
          // Signal main.ts to wipe the local file and switch this install
          // to the embedded-replica config on the next launch — done here
          // rather than hot-restarting the running server mid-request,
          // which would race the redirect this same request is about to
          // send back to the browser. See main.ts's readDesktopConfig.
          // syncedEmail rides along so main.ts's local->remote migration
          // (migrate-to-remote.ts) knows which remote AllowedUser to
          // reassign this install's local guest-owned Brew rows to.
          if (allowed && process.env.DESKTOP_CONFIG_PATH) {
            fs.writeFileSync(process.env.DESKTOP_CONFIG_PATH, JSON.stringify({ syncEnabled: true, syncedEmail: email }));
          }
          return allowed;
        } finally {
          remote.close();
        }
      }

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
 * unconditionally (this guest one, unless a real one exists) so nothing in
 * the app has to handle "no user" as a state; `proxy.ts` re-exports this
 * same symbol as Next's middleware (called with a request) and never
 * blocks a request itself — real auth is opt-in via visiting /login, not
 * enforced — while everywhere else in the app it's called as a plain
 * `await auth()` to read the current session. One export serving both
 * roles, so this has to handle both call shapes.
 *
 * DESKTOP_GUEST_EMAIL is a fixed constant, not a real account — the
 * desktop app's first-run migration runner (apps/desktop/src-ts/migrate.ts)
 * seeds exactly one AllowedUser row with this email (isAdmin: true) into a
 * fresh local DB, so admin-gated code (requireAdmin(), src/lib/admin.ts)
 * keeps working before anyone has signed in for real. Keep these in sync
 * if either side changes.
 */
export const DESKTOP_GUEST_EMAIL = "local@cybar.app";
const DESKTOP_GUEST_SESSION = {
  user: { email: DESKTOP_GUEST_EMAIL, name: "Local User" },
  expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString(),
};

function desktopAuth(...args: unknown[]) {
  // Once sync is on, this install is tied to one specific real account —
  // the guest identity has no AllowedUser row on the remote (deliberately
  // never pushed there, see migrate-to-remote.ts) and no legitimate claim
  // to that account's data, so falling back to it here would be silently
  // wrong, not harmlessly permissive. Real auth applies exactly as it does
  // for the hosted deployment: enforced by the middleware call (an
  // anonymous visitor is redirected to /login), and `await auth()` returns
  // the real session or nothing — never a guest stand-in.
  if (process.env.DESKTOP_SYNC_ENABLED === "true") {
    return (nextAuth.auth as (...args: unknown[]) => unknown)(...args);
  }
  // Called as `proxy(request, event)` by Next's middleware runtime — let
  // every request through. Real sign-in is reached by visiting /login,
  // never enforced by redirecting anonymous visitors there.
  if (args.length > 0) return NextResponse.next();
  // Called as `await auth()` everywhere else in the app — prefer a real
  // session (someone actually completed OAuth) and fall back to the fixed
  // guest identity so the rest of the app never sees "no session" here.
  return nextAuth.auth().then((session) => session ?? DESKTOP_GUEST_SESSION);
}

export const handlers = nextAuth.handlers;
export const signIn = nextAuth.signIn;
export const signOut = nextAuth.signOut;
export const auth = (process.env.APP_MODE === "desktop" ? desktopAuth : nextAuth.auth) as typeof nextAuth.auth;
