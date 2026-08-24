import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";

/**
 * Real per-user OAuth (each person signs in with their own GitHub or Google
 * account) gated to a fixed allowlist of emails — not open sign-up. This is
 * deliberately not multi-tenant: there's no Organization model, no invite
 * flow, no roles. Two known people, real identity instead of a shared
 * password. See AGENTS.md's "Multi-device / sharing with a friend" section
 * for why that's a scoped-down first cut, not the full thing.
 */
const allowedEmails = (process.env.ALLOWED_EMAILS ?? "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [GitHub, Google],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    signIn: ({ user }) => {
      const email = user.email?.toLowerCase();
      return !!email && allowedEmails.includes(email);
    },
    authorized: ({ auth }) => !!auth?.user,
  },
});
