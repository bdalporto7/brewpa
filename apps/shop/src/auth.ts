import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";

/**
 * Sign-in for the shop admin only — the storefront itself is public. Same idea
 * as apps/roasting: each person signs in with their own GitHub or Google
 * account, and only emails on the AllowedUser list get a session. The list is
 * the same table the roasting app manages, so admitting someone there admits
 * them here.
 *
 * The session cookie has its own name so running both apps on localhost (cookies
 * ignore ports) doesn't make them overwrite each other's sessions.
 *
 * `devLogin` exists purely so the admin can be exercised on a developer's
 * machine without real OAuth: it only exists when SHOP_DEV_LOGIN=1 and never in
 * production builds.
 */
const devLogin = process.env.SHOP_DEV_LOGIN === "1" && process.env.NODE_ENV !== "production";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    GitHub,
    Google,
    ...(devLogin
      ? [
          Credentials({
            id: "dev",
            name: "Local test login",
            credentials: {},
            authorize: async () => {
              const admin = await prisma.allowedUser.findFirst({ where: { isAdmin: true }, orderBy: { createdAt: "asc" } });
              return admin ? { id: admin.id, email: admin.email, name: "Local admin" } : null;
            },
          }),
        ]
      : []),
  ],
  pages: { signIn: "/admin/login" },
  session: { strategy: "jwt" },
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === "production" ? "__Secure-cybar-shop.session-token" : "cybar-shop.session-token",
      options: { httpOnly: true, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production" },
    },
  },
  callbacks: {
    signIn: async ({ user }) => {
      const email = user.email?.toLowerCase();
      if (!email) return false;
      return !!(await prisma.allowedUser.findUnique({ where: { email } }));
    },
  },
});
