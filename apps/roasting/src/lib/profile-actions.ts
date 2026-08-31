"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { parseMMSS } from "@/lib/format";
import { computeRoastPhases } from "@/lib/phases";
import { buildSettingChangesFromEvents, type PlanSettingChange, type PlanTargets } from "@/lib/curve";
import { findDropTemp } from "@/lib/roastAdvisor";
import { SR800_LEVEL_MIN, SR800_LEVEL_MAX } from "@/lib/constants";

// RoastProfile is shared/global data (like Recipe), not per-user — no
// requireUser() here, matching brew-actions.ts's Recipe actions.

function str(formData: FormData, key: string): string | null {
  const raw = formData.get(key);
  if (raw === null) return null;
  const value = raw.toString().trim();
  return value === "" ? null : value;
}

function num(formData: FormData, key: string): number | null {
  const raw = formData.get(key);
  if (raw === null || raw === "") return null;
  const value = Number(raw);
  return Number.isNaN(value) ? null : value;
}

function clampLevel(n: number): number {
  return Math.round(Math.min(SR800_LEVEL_MAX, Math.max(SR800_LEVEL_MIN, n)));
}

function timeField(formData: FormData, key: string): number | undefined {
  const raw = str(formData, key);
  if (!raw) return undefined;
  const seconds = parseMMSS(raw);
  return seconds ?? undefined;
}

function targetsFromForm(formData: FormData): PlanTargets {
  return {
    dryEndSeconds: timeField(formData, "dryEndMMSS"),
    yellowingEndSeconds: timeField(formData, "yellowingEndMMSS"),
    firstCrackSeconds: timeField(formData, "firstCrackMMSS"),
    developmentSeconds: timeField(formData, "developmentMMSS"),
    dropTempF: num(formData, "dropTempF") ?? undefined,
    targetWeightLossPercent: num(formData, "targetWeightLossPercent") ?? undefined,
  };
}

/** The manual form's dial-change rows arrive as one hidden JSON field
 * (built client-side, see RoastProfileForm) since FormData can't carry a
 * repeatable structured list on its own — parsed and clamped the same way
 * roastAdvisor.ts clamps an AI-generated plan's levels. */
function settingChangesFromForm(formData: FormData): PlanSettingChange[] {
  const raw = str(formData, "settingChangesJson");
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Dial schedule was malformed — try again.");
  }
  if (!Array.isArray(parsed)) throw new Error("Dial schedule was malformed — try again.");

  return parsed.map((row, i) => {
    if (typeof row !== "object" || row === null || typeof (row as Record<string, unknown>).atSeconds !== "number") {
      throw new Error(`Dial schedule row ${i + 1} is malformed — try again.`);
    }
    const r = row as Record<string, unknown>;
    const entry: PlanSettingChange = { atSeconds: Math.round(r.atSeconds as number) };
    if (typeof r.fanLevel === "number") entry.fanLevel = clampLevel(r.fanLevel);
    if (typeof r.heatLevel === "number") entry.heatLevel = clampLevel(r.heatLevel);
    return entry;
  });
}

function profileFields(formData: FormData) {
  const name = str(formData, "name");
  if (!name) throw new Error("Name is required.");

  return {
    name,
    description: str(formData, "description"),
    process: str(formData, "process"),
    brewTarget: str(formData, "brewTarget"),
    planJson: JSON.stringify({
      settingChanges: settingChangesFromForm(formData),
      targets: targetsFromForm(formData),
    }),
  };
}

export async function createRoastProfile(formData: FormData) {
  await prisma.roastProfile.create({ data: profileFields(formData) });
  revalidatePath("/profiles");
}

export async function updateRoastProfile(id: string, formData: FormData) {
  await prisma.roastProfile.update({ where: { id }, data: profileFields(formData) });
  revalidatePath("/profiles");
  revalidatePath(`/profiles/${id}`);
}

export async function deleteRoastProfile(id: string) {
  await prisma.roastProfile.delete({ where: { id } });
  revalidatePath("/profiles");
  redirect("/profiles");
}

export async function toggleProfileFavorite(id: string, isFavorite: boolean) {
  await prisma.roastProfile.update({ where: { id }, data: { isFavorite } });
  revalidatePath("/profiles");
  revalidatePath(`/profiles/${id}`);
}

/** Copies a roast's already-generated AI plan verbatim into a new,
 * standalone, bean-independent profile. */
export async function saveProfileFromSuggestion(roastSessionId: string, formData: FormData) {
  const session = await prisma.roastSession.findUniqueOrThrow({ where: { id: roastSessionId } });
  if (!session.aiSuggestionPlan) throw new Error("No AI plan on this roast to save.");

  const name = str(formData, "name");
  if (!name) throw new Error("Name is required.");

  await prisma.roastProfile.create({
    data: {
      name,
      description: str(formData, "description"),
      process: str(formData, "process"),
      brewTarget: str(formData, "brewTarget") ?? session.brewTarget,
      planJson: session.aiSuggestionPlan,
    },
  });
  revalidatePath("/profiles");
}

/** Reconstructs a plan from what a completed roast ACTUALLY did — the most
 * valuable case ("that roast turned out great, repeat it") — from its real
 * FAN/HEAT/milestone events rather than any suggestion it may have
 * started from. */
export async function saveProfileFromCompletedRoast(roastSessionId: string, formData: FormData) {
  const session = await prisma.roastSession.findUniqueOrThrow({
    where: { id: roastSessionId },
    include: {
      events: { orderBy: { atSeconds: "asc" } },
      bean: true,
      temperatureReadings: { orderBy: { atSeconds: "desc" }, take: 1 },
    },
  });
  if (!session.startedAt || !session.endedAt) {
    throw new Error("Only a completed roast can be saved as a profile.");
  }

  const name = str(formData, "name");
  if (!name) throw new Error("Name is required.");

  const settingChanges = buildSettingChangesFromEvents(session.events);
  const dryEndSeconds = session.events.find((e) => e.type === "DRY_END")?.atSeconds;
  const yellowingEndSeconds = session.events.find((e) => e.type === "YELLOWING_END")?.atSeconds;
  const firstCrackSeconds = session.events.find((e) => e.type === "FIRST_CRACK_START")?.atSeconds;
  const totalSeconds = (session.endedAt.getTime() - session.startedAt.getTime()) / 1000;
  const phases = computeRoastPhases(session.events, totalSeconds);

  // findDropTemp prefers a real probe reading; the fallback map only needs
  // an entry when there isn't one, sourced from this roast's own already-
  // fetched events rather than a second query.
  const lastHandLoggedTemp = session.events.filter((e) => e.type === "TEMP").at(-1)?.tempFahrenheit;
  const lastTemp = new Map(
    session.temperatureReadings.length === 0 && lastHandLoggedTemp != null
      ? [[session.id, lastHandLoggedTemp]]
      : []
  );
  const dropTemp = findDropTemp(session, lastTemp);

  const targetWeightLossPercent =
    session.roastedWeightGrams != null && session.greenWeightGrams > 0
      ? Math.round((1 - session.roastedWeightGrams / session.greenWeightGrams) * 1000) / 10
      : undefined;

  const planJson = JSON.stringify({
    settingChanges,
    targets: {
      dryEndSeconds,
      yellowingEndSeconds,
      firstCrackSeconds,
      developmentSeconds: phases.developmentSeconds != null ? Math.round(phases.developmentSeconds) : undefined,
      dropTempF: dropTemp?.tempF != null ? Math.round(dropTemp.tempF) : undefined,
      targetWeightLossPercent,
    },
  });

  await prisma.roastProfile.create({
    data: {
      name,
      description: str(formData, "description"),
      process: str(formData, "process") ?? session.bean.process,
      brewTarget: str(formData, "brewTarget") ?? session.brewTarget,
      planJson,
    },
  });
  revalidatePath("/profiles");
}

/** Applies a saved profile to a pending (not-yet-started) roast — copies
 * its plan onto the same aiSuggestion* columns an AI suggestion would use,
 * so RoastSetupPanel's pre-fill and the live chart's target overlay work
 * with zero changes regardless of source. Applying counts as accepting —
 * there's no separate "accept" step for a profile you deliberately chose. */
export async function applyRoastProfile(roastSessionId: string, profileId: string) {
  const [session, profile] = await Promise.all([
    prisma.roastSession.findUniqueOrThrow({ where: { id: roastSessionId } }),
    prisma.roastProfile.findUniqueOrThrow({ where: { id: profileId } }),
  ]);
  if (session.startedAt) {
    throw new Error("Can only apply a profile before the roast begins.");
  }

  const plan = JSON.parse(profile.planJson) as { settingChanges: PlanSettingChange[] };
  const first = plan.settingChanges.find((c) => c.atSeconds === 0) ?? plan.settingChanges[0];

  await prisma.roastSession.update({
    where: { id: roastSessionId },
    data: {
      profileId,
      suggestedFanLevel: first?.fanLevel ?? null,
      suggestedHeatLevel: first?.heatLevel ?? null,
      aiSuggestionPlan: profile.planJson,
      aiSuggestionSummary: `Applied saved profile: ${profile.name}`,
      aiSuggestionAcceptedAt: new Date(),
      brewTarget: profile.brewTarget ?? session.brewTarget,
    },
  });
  revalidatePath(`/roasts/${roastSessionId}`);
}
