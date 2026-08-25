"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

function str(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

async function assertNotLastAdmin(id: string) {
  const target = await prisma.allowedUser.findUniqueOrThrow({ where: { id } });
  if (!target.isAdmin) return;
  const adminCount = await prisma.allowedUser.count({ where: { isAdmin: true } });
  if (adminCount <= 1) {
    throw new Error("Can't remove the last admin.");
  }
}

export async function addAllowedUser(formData: FormData) {
  await requireAdmin();

  const email = str(formData, "email")?.toLowerCase();
  const isAdmin = formData.get("isAdmin") === "on";

  if (!email) {
    throw new Error("Email is required.");
  }

  await prisma.allowedUser.create({ data: { email, isAdmin } });
  revalidatePath("/admin");
}

export async function setAllowedUserAdmin(id: string, isAdmin: boolean) {
  await requireAdmin();

  if (!isAdmin) {
    await assertNotLastAdmin(id);
  }

  await prisma.allowedUser.update({ where: { id }, data: { isAdmin } });
  revalidatePath("/admin");
}

export async function removeAllowedUser(id: string) {
  await requireAdmin();

  await assertNotLastAdmin(id);
  await prisma.allowedUser.delete({ where: { id } });
  revalidatePath("/admin");
}
