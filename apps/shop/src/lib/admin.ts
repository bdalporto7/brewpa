import "server-only";
import { cache } from "react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/** The signed-in person, if they're on the allowed list (shared with apps/roasting). */
export const getAdminUser = cache(async () => {
  const email = (await auth())?.user?.email?.toLowerCase();
  if (!email) return null;
  return prisma.allowedUser.findUnique({ where: { email } });
});

/** Every admin Server Action calls this itself: actions are directly callable, so hiding the page isn't enough. */
export async function requireAdmin() {
  const user = await getAdminUser();
  if (!user) throw new Error("Not signed in.");
  return user;
}
