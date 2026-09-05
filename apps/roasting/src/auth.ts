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
 * The desktop app's standalone build (apps/desktop, APP_MODE=standalone —
 * a zero-setup installer handed to someone with no GitHub/Google OAuth app
 * registered, no AllowedUser row of their own) skips real auth entirely,
 * everywhere `auth` is used: `proxy.ts` re-exports this same symbol as
 * Next's middleware (called with a request), and everywhere else in the
 * app it's called as a plain `await auth()` to read the current session —
 * one export serving both roles, so the standalone override has to handle
 * both call shapes too, not just the middleware one.
 *
 * STANDALONE_EMAIL is a fixed constant, not a real account — the desktop
 * app's first-run migration runner (apps/desktop) seeds exactly one
 * AllowedUser row with this email (isAdmin: true) into a fresh local DB,
 * so admin-gated code (requireAdmin(), src/lib/admin.ts) keeps working
 * without a real sign-in. Keep these in sync if either side changes.
 */
export const STANDALONE_EMAIL = "local@cybar.app";
const STANDALONE_SESSION = {
  user: { email: STANDALONE_EMAIL, name: "Local User" },
  expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString(),
};

function standaloneAuth(...args: unknown[]) {
  // Called as `proxy(request, event)` by Next's middleware runtime — let
  // every request through rather than trying to mimic authorized-callback
  // logic that no longer applies.
  if (args.length > 0) return NextResponse.next();
  // Called as `await auth()` everywhere else in the app.
  return Promise.resolve(STANDALONE_SESSION);
}

export const handlers = nextAuth.handlers;
export const signIn = nextAuth.signIn;
export const signOut = nextAuth.signOut;
export const auth = (process.env.APP_MODE === "standalone" ? standaloneAuth : nextAuth.auth) as typeof nextAuth.auth;
