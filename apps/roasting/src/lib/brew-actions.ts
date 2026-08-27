"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { parseMMSS } from "@/lib/format";
import { getCurrentAllowedUser } from "@/lib/admin";

async function requireUser() {
  const user = await getCurrentAllowedUser();
  if (!user) throw new Error("Not signed in.");
  return user;
}

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

function brewTime(formData: FormData): number | null {
  const raw = str(formData, "brewTimeMMSS");
  return raw ? parseMMSS(raw) : null;
}

function recipeFields(formData: FormData) {
  const name = str(formData, "name");
  const method = str(formData, "method");
  const doseGrams = num(formData, "doseGrams");
  const waterGrams = num(formData, "waterGrams");

  if (!name || !method || doseGrams === null || doseGrams <= 0 || waterGrams === null || waterGrams <= 0) {
    throw new Error("Name, method, dose, and water are required.");
  }

  return {
    name,
    method,
    doseGrams,
    waterGrams,
    grindSetting: str(formData, "grindSetting"),
    waterTempF: num(formData, "waterTempF"),
    brewTimeSeconds: brewTime(formData),
    notes: str(formData, "notes"),
  };
}

export async function createRecipe(formData: FormData) {
  await prisma.recipe.create({ data: recipeFields(formData) });
  revalidatePath("/recipes");
}

export async function updateRecipe(id: string, formData: FormData) {
  await prisma.recipe.update({ where: { id }, data: recipeFields(formData) });
  revalidatePath("/recipes");
  revalidatePath(`/recipes/${id}`);
}

export async function deleteRecipe(id: string) {
  await prisma.recipe.delete({ where: { id } });
  revalidatePath("/recipes");
  redirect("/recipes");
}

export async function toggleRecipeFavorite(id: string, isFavorite: boolean) {
  await prisma.recipe.update({ where: { id }, data: { isFavorite } });
  revalidatePath("/recipes");
  revalidatePath(`/recipes/${id}`);
}

function brewFields(formData: FormData) {
  const method = str(formData, "method");
  const doseGrams = num(formData, "doseGrams");
  const waterGrams = num(formData, "waterGrams");
  const rating = num(formData, "rating");

  if (!method || doseGrams === null || doseGrams <= 0 || waterGrams === null || waterGrams <= 0) {
    throw new Error("Method, dose, and water are required.");
  }
  if (rating !== null && (rating < 1 || rating > 10)) {
    throw new Error("Rating must be between 1 and 10.");
  }

  return {
    method,
    doseGrams,
    waterGrams,
    grindSetting: str(formData, "grindSetting"),
    waterTempF: num(formData, "waterTempF"),
    brewTimeSeconds: brewTime(formData),
    rating,
    notes: str(formData, "notes"),
  };
}

export async function logBrew(formData: FormData) {
  const user = await requireUser();
  const roastSessionId = str(formData, "roastSessionId");
  const beanName = str(formData, "beanName");
  const recipeId = str(formData, "recipeId");
  if (!roastSessionId && !beanName) {
    throw new Error("Pick a roasted coffee from your inventory, or enter a bean name.");
  }
  const fields = brewFields(formData);

  if (roastSessionId) {
    await prisma.$transaction(async (tx) => {
      const session = await tx.roastSession.findUniqueOrThrow({ where: { id: roastSessionId } });
      const onHand = session.roastedRemainingGrams ?? 0;
      if (onHand < fields.doseGrams) {
        throw new Error(`Only ${onHand}g of roasted coffee left from this roast.`);
      }

      await tx.roastSession.update({
        where: { id: roastSessionId },
        data: { roastedRemainingGrams: onHand - fields.doseGrams },
      });

      await tx.brew.create({ data: { roastSessionId, recipeId, userId: user.id, ...fields } });
    });
    revalidatePath(`/roasts/${roastSessionId}`);
  } else {
    await prisma.brew.create({ data: { beanName, recipeId, userId: user.id, ...fields } });
  }

  revalidatePath("/brews");
  revalidatePath("/");
}

/** Every mutation on an existing Brew re-checks ownership server-side — a brew is one person's journal entry, and the UI only ever offers your own, but Server Actions are directly callable regardless of what the UI shows. */
async function assertOwnsBrew(id: string, userId: string) {
  const brew = await prisma.brew.findUniqueOrThrow({ where: { id } });
  if (brew.userId !== userId) {
    throw new Error("You can only edit your own brews.");
  }
  return brew;
}

export async function updateBrew(id: string, formData: FormData) {
  const user = await requireUser();
  const existing = await assertOwnsBrew(id, user.id);
  const fields = brewFields(formData);
  const beanName = str(formData, "beanName");

  await prisma.$transaction(async (tx) => {
    const brew = await tx.brew.findUniqueOrThrow({ where: { id } });

    if (brew.roastSessionId) {
      const delta = fields.doseGrams - brew.doseGrams;
      if (delta !== 0) {
        const session = await tx.roastSession.findUniqueOrThrow({ where: { id: brew.roastSessionId } });
        const onHand = session.roastedRemainingGrams ?? 0;
        if (onHand < delta) {
          throw new Error(`Only ${onHand}g of roasted coffee left from this roast.`);
        }
        await tx.roastSession.update({
          where: { id: brew.roastSessionId },
          data: { roastedRemainingGrams: onHand - delta },
        });
      }
    }

    await tx.brew.update({
      where: { id },
      data: brew.roastSessionId ? fields : { ...fields, beanName },
    });
  });

  revalidatePath("/brews");
  revalidatePath(`/brews/${id}`);
  if (existing.roastSessionId) revalidatePath(`/roasts/${existing.roastSessionId}`);
}

export async function deleteBrew(id: string) {
  const user = await requireUser();
  const brew = await assertOwnsBrew(id, user.id);

  await prisma.$transaction(async (tx) => {
    if (brew.roastSessionId) {
      const session = await tx.roastSession.findUniqueOrThrow({ where: { id: brew.roastSessionId } });
      await tx.roastSession.update({
        where: { id: brew.roastSessionId },
        data: { roastedRemainingGrams: (session.roastedRemainingGrams ?? 0) + brew.doseGrams },
      });
    }
    await tx.brew.delete({ where: { id } });
  });

  revalidatePath("/brews");
  revalidatePath("/");
  redirect("/brews");
}
