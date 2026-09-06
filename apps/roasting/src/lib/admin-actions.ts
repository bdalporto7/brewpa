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

/**
 * `teamId` of `"__new__"` means "give this person their own brand-new
 * team" (e.g. a roaster friend starting their own separate business) —
 * anything else is an existing Team's id to join instead (e.g. an
 * employee joining a business that's already on here). `newTeamName`
 * only matters in the `"__new__"` case.
 */
export async function addAllowedUser(formData: FormData) {
  await requireAdmin();

  const email = str(formData, "email")?.toLowerCase();
  const isAdmin = formData.get("isAdmin") === "on";
  const teamChoice = str(formData, "teamId");
  const newTeamName = str(formData, "newTeamName");

  if (!email) {
    throw new Error("Email is required.");
  }
  if (!teamChoice) {
    throw new Error("A team is required.");
  }

  const teamId =
    teamChoice === "__new__"
      ? (await prisma.team.create({ data: { name: newTeamName ?? `${email}'s team` } })).id
      : teamChoice;

  await prisma.allowedUser.create({ data: { email, isAdmin, teamId } });
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
