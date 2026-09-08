"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { ROASTER_PRESETS } from "@/lib/roasters";

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
      ? (
          await prisma.team.create({
            data: {
              name: newTeamName ?? `${email}'s team`,
              // Every team gets every roaster this app currently supports
              // — which machines exist is a catalog we ship in code
              // (ROASTER_PRESETS), never something a team adds/removes
              // itself. The first preset is the default pre-selected when
              // starting a roast; see RoasterDefinition's own doc comment.
              roasterDefinitions: {
                create: ROASTER_PRESETS.map((preset, i) => ({
                  name: preset.name,
                  isDefault: i === 0,
                  supportsAiSuggestions: preset.supportsAiSuggestions,
                  controlsJson: JSON.stringify(preset.controls),
                  probesJson: JSON.stringify(preset.probes),
                })),
              },
            },
          })
        ).id
      : teamChoice;

  await prisma.allowedUser.create({ data: { email, isAdmin, teamId } });
  revalidatePath("/admin");
}

/**
 * Moves someone to a different *existing* team — not the "+ New team"
 * flow (that's addAllowedUser's job, at signup time only). Takes effect
 * immediately: getCurrentAllowedUser() is a fresh DB lookup on every
 * request, not something baked into the session cookie, so there's no
 * sign-out/re-auth step needed for the web app. A synced desktop install
 * picks it up the same way push already re-stamps team-owned rows onto
 * whatever team the token's owner currently has — no special-casing
 * needed here, that reconciliation already exists for the guest-to-real-
 * team case and works identically for team-to-team.
 */
export async function setAllowedUserTeam(id: string, teamId: string) {
  await requireAdmin();
  await prisma.allowedUser.update({ where: { id }, data: { teamId } });
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

/** Sets revokedAt rather than deleting the row — keeps the token's history (label, when it was minted/last used) visible after cutting it off, same reasoning DropOrderItem keeps a Sale record instead of just un-flagging it. */
export async function revokeSyncToken(id: string) {
  await requireAdmin();

  await prisma.syncToken.update({ where: { id }, data: { revokedAt: new Date() } });
  revalidatePath("/admin");
}
