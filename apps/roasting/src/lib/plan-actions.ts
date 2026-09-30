"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/admin";
import { PLAN_STATUSES } from "@/lib/plans";

/**
 * CRUD for ProductionPlan (the Roast Plan section under /business).
 * Plans are team-scoped like Bean — shared by every member, not per-user.
 * Plans never move stock; they're commitments only. Actual roasts
 * (RoastSession) decrement inventory when they happen.
 *
 * Pure helpers (PLAN_STATUSES, formatPlanMonth, defaultPlanMonth) live in
 * @/lib/plans — "use server" modules only export async functions to client
 * components, so anything shared with client code belongs there.
 */

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function num(formData: FormData, key: string): number | null {
  const raw = formData.get(key);
  if (raw === null || raw === "") return null;
  const value = Number(raw);
  return Number.isNaN(value) ? null : value;
}

function str(formData: FormData, key: string): string | null {
  const raw = formData.get(key);
  if (raw === null) return null;
  const value = raw.toString().trim();
  return value === "" ? null : value;
}

async function validatedPlanInput(formData: FormData, teamId: string) {
  const month = str(formData, "month");
  const targetGrams = num(formData, "targetGrams");
  const status = str(formData, "status") ?? "planned";
  const beanId = str(formData, "beanId");
  const roasterDefinitionId = str(formData, "roasterDefinitionId");

  if (!month || !MONTH_RE.test(month)) {
    throw new Error("Month must look like YYYY-MM (e.g. 2026-10).");
  }
  if (targetGrams === null || targetGrams <= 0) {
    throw new Error("Target quantity must be a positive number of grams.");
  }
  if (!(PLAN_STATUSES as readonly string[]).includes(status)) {
    throw new Error(`Status must be one of: ${PLAN_STATUSES.join(", ")}.`);
  }
  // Re-checked against this team regardless of what the form sent —
  // never trusted just because the client picked it (same rule as
  // startRoast's roasterDefinitionId).
  if (beanId) {
    await prisma.bean.findFirstOrThrow({ where: { id: beanId, teamId } });
  }
  if (roasterDefinitionId) {
    await prisma.roasterDefinition.findFirstOrThrow({ where: { id: roasterDefinitionId, teamId } });
  }

  return {
    month,
    targetGrams,
    status,
    notes: str(formData, "notes"),
    beanId,
    roasterDefinitionId,
  };
}

export async function createProductionPlan(formData: FormData) {
  const user = await requireUser();
  const data = await validatedPlanInput(formData, user.teamId);

  await prisma.productionPlan.create({
    data: { ...data, teamId: user.teamId },
  });

  revalidatePath("/business/roast-plan");
}

export async function updateProductionPlan(id: string, formData: FormData) {
  const user = await requireUser();
  await prisma.productionPlan.findFirstOrThrow({ where: { id, teamId: user.teamId } });
  const data = await validatedPlanInput(formData, user.teamId);

  await prisma.productionPlan.update({ where: { id }, data });

  revalidatePath("/business/roast-plan");
}

export async function deleteProductionPlan(id: string) {
  const user = await requireUser();
  await prisma.productionPlan.findFirstOrThrow({ where: { id, teamId: user.teamId } });

  // No stock side effects — a plan is a commitment, not inventory. Deleting
  // it just removes the commitment; any RoastSessions already logged stay.
  await prisma.productionPlan.delete({ where: { id } });

  revalidatePath("/business/roast-plan");
}
