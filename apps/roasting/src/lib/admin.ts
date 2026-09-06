import { cache } from "react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * React's cache() dedupes this to one actual DB round trip per request —
 * Nav.tsx (rendered on every page via the root layout) and several page
 * components (brews, brews/[id], recipes/[id], beans/[id], roasts/[id],
 * admin) each independently need the current AllowedUser, and without
 * this every one of those pages was hitting Turso for the same row twice.
 * Includes `team` since almost every caller immediately needs `teamId` to
 * stamp/scope a row — see requireUser() below.
 */
export const getCurrentAllowedUser = cache(async () => {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) return null;
  return prisma.allowedUser.findUnique({ where: { email }, include: { team: true } });
});

export async function requireAdmin() {
  const user = await getCurrentAllowedUser();
  if (!user?.isAdmin) throw new Error("Admin access required.");
  return user;
}

/** The one shared "who's creating/editing this" check — every action that stamps a row's `teamId` uses this (`user.teamId`). */
export async function requireUser() {
  const user = await getCurrentAllowedUser();
  if (!user) throw new Error("Not signed in.");
  return user;
}
