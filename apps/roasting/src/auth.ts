import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
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
export const { handlers, signIn, signOut, auth } = NextAuth({
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
