import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function getCurrentAllowedUser() {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) return null;
  return prisma.allowedUser.findUnique({ where: { email } });
}

export async function requireAdmin() {
  const user = await getCurrentAllowedUser();
  if (!user?.isAdmin) throw new Error("Admin access required.");
  return user;
}
