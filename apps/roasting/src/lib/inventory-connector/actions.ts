"use server";

/**
 * The mutation half of the inventory connector — every write the inventory
 * app performs, team-scoped via requireUser. The inventory UI imports ONLY
 * from this module (and its sibling queries.ts); it never touches Prisma,
 * the roasting app's actions, or its components directly.
 *
 * "Derived, not stored": stock moves only through these actions and roast
 * logging — alerts, velocity, and costs are computed at read time.
 *
 * Turbopack gotcha: this module must stay self-contained — never
 * `export { x } from` another module here. Import and call instead.
 */

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/admin";
import { adjustBeanStock, setBeanStock } from "@/lib/actions";
import {
  createProductionPlan,
  updateProductionPlan,
  deleteProductionPlan,
} from "@/lib/plan-actions";
import { parseArtisanFile, buildArtisanImportResult } from "@/lib/artisanImport";
import { parseControls } from "@/lib/roasters";
import { extractReceiptInfo, extractLotDetails, type ReceiptInfo, type LotDetails } from "./extract";
import { INVENTORY_WIDGETS } from "./queries";
import { WEIGHT_UNITS, toGrams, type WeightUnit } from "./math";

const INVENTORY_PATHS = [
  "/inventory",
  "/inventory/lots",
  "/inventory/roasts",
  "/inventory/calculator",
  "/inventory/plan",
  "/inventory/blends",
  "/inventory/cupping",
  "/inventory/costs",
];

function revalidateInventory() {
  for (const p of INVENTORY_PATHS) revalidatePath(p);
}

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

/** Grams from a value+unit pair of form fields (intake forms let the
 * roaster type in lb/kg/oz). */
function gramsFrom(formData: FormData, valueKey: string, unitKey: string): number | null {
  const value = num(formData, valueKey);
  if (value === null) return null;
  const unit = (str(formData, unitKey) ?? "g") as WeightUnit;
  if (!(WEIGHT_UNITS as readonly string[]).includes(unit)) {
    throw new Error("Unknown weight unit.");
  }
  return toGrams(value, unit);
}

async function uploadLotPhotoIfProvided(formData: FormData): Promise<string | null> {
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return null;
  if (!file.type.startsWith("image/")) {
    throw new Error("That file isn't an image.");
  }
  const blob = await put(`lot-photos/${file.name}`, file, { access: "public", addRandomSuffix: true });
  return blob.url;
}

function parsePurchaseDate(raw: string | null): Date {
  if (!raw) return new Date();
  // Bare YYYY-MM-DD parses as UTC midnight per spec — appending T00:00
  // forces local-midnight so the stored date matches what was picked.
  const d = new Date(`${raw}T00:00`);
  if (Number.isNaN(d.getTime())) throw new Error("That purchase date isn't valid.");
  return d;
}

// --- Lot CRUD ---------------------------------------------------------------

/**
 * Creates a lot. Name/origin/process and a positive weight are required;
 * everything else is optional. The photo, if provided, goes to Blob.
 */
export async function createLot(formData: FormData) {
  const user = await requireUser();
  const name = str(formData, "name");
  const origin = str(formData, "origin");
  const process = str(formData, "process");
  const weightGrams = gramsFrom(formData, "weight", "weightUnit");

  if (!name || !origin || !process || weightGrams === null || weightGrams <= 0) {
    throw new Error("Name, origin, process, and a positive weight are required.");
  }

  const photoUrl = await uploadLotPhotoIfProvided(formData);

  await prisma.bean.create({
    data: {
      name,
      origin,
      process,
      weightGrams,
      remainingGrams: weightGrams,
      purchaseDate: parsePurchaseDate(str(formData, "purchaseDate")),
      producer: str(formData, "producer"),
      variety: str(formData, "variety"),
      supplier: str(formData, "supplier"),
      supplierUrl: str(formData, "supplierUrl"),
      purchasePrice: num(formData, "purchasePrice"),
      notes: str(formData, "notes"),
      photoUrl,
      reorderLevelGrams: num(formData, "reorderLevelGrams"),
      leadTimeDays: num(formData, "leadTimeDays"),
      agingThresholdDays: num(formData, "agingThresholdDays"),
      teamId: user.teamId,
    },
  });

  revalidateInventory();
}

/** Edits a lot's descriptive fields. Stock moves via adjust/set actions, not here. */
export async function updateLot(id: string, formData: FormData) {
  const user = await requireUser();
  const name = str(formData, "name");
  const origin = str(formData, "origin");
  const process = str(formData, "process");
  const weightGrams = gramsFrom(formData, "weight", "weightUnit");

  if (!name || !origin || !process) {
    throw new Error("Name, origin, and process are required.");
  }
  if (weightGrams === null || weightGrams < 0) {
    throw new Error("Total purchased can't be negative.");
  }

  const lot = await prisma.bean.findFirstOrThrow({ where: { id, teamId: user.teamId } });
  if (weightGrams < lot.remainingGrams) {
    throw new Error(`Total purchased can't be less than the ${lot.remainingGrams}g currently remaining.`);
  }

  const newPhotoUrl = await uploadLotPhotoIfProvided(formData);

  await prisma.bean.update({
    where: { id },
    data: {
      name,
      origin,
      process,
      weightGrams,
      purchaseDate: parsePurchaseDate(str(formData, "purchaseDate") ?? lot.purchaseDate.toISOString().slice(0, 10)),
      producer: str(formData, "producer"),
      variety: str(formData, "variety"),
      supplier: str(formData, "supplier"),
      supplierUrl: str(formData, "supplierUrl"),
      purchasePrice: num(formData, "purchasePrice"),
      notes: str(formData, "notes"),
      ...(newPhotoUrl ? { photoUrl: newPhotoUrl } : {}),
      reorderLevelGrams: num(formData, "reorderLevelGrams"),
      leadTimeDays: num(formData, "leadTimeDays"),
      agingThresholdDays: num(formData, "agingThresholdDays"),
    },
  });

  revalidateInventory();
}

/** Deletes a lot. Refuses when roasts are logged against it — history is
 * never silently orphaned. */
export async function deleteLot(id: string) {
  const user = await requireUser();
  await prisma.bean.findFirstOrThrow({ where: { id, teamId: user.teamId } });

  const sessionCount = await prisma.roastSession.count({ where: { beanId: id } });
  if (sessionCount > 0) {
    throw new Error(
      `Can't delete this lot — ${sessionCount} roast${sessionCount === 1 ? "" : "s"} logged against it.`
    );
  }

  await prisma.bean.delete({ where: { id } });
  revalidateInventory();
}

// --- Stock -------------------------------------------------------------------

/**
 * Add/remove stock. A delta moves the total right along with the
 * remaining amount — coffee genuinely entering or leaving possession —
 * via the shared adjustBeanStock (same semantics as the roasting app's
 * StockAdjuster, one implementation).
 */
export async function adjustLotStock(id: string, formData: FormData) {
  const direction = str(formData, "direction");
  const grams = gramsFrom(formData, "amount", "amountUnit");
  if (direction !== "add" && direction !== "remove") throw new Error("Choose add or remove.");
  if (grams === null || grams <= 0) throw new Error("Amount must be positive.");
  await adjustBeanStock(id, direction, grams);
  revalidateInventory();
}

/** Set the exact remaining amount — a recount, touching remaining only. */
export async function setLotStock(id: string, formData: FormData) {
  const grams = gramsFrom(formData, "amount", "amountUnit");
  if (grams === null || grams < 0) throw new Error("Remaining stock can't be negative.");
  await setBeanStock(id, grams);
  revalidateInventory();
}

/**
 * Adds a new purchase to an existing lot — the intake "add to existing
 * lot" path. Optionally grows the recorded purchase price alongside the
 * weight (the new money spent is real cost of the lot).
 */
export async function addStockToLot(formData: FormData) {
  const user = await requireUser();
  const lotId = str(formData, "lotId");
  const grams = gramsFrom(formData, "weight", "weightUnit");
  if (!lotId) throw new Error("Choose a lot.");
  if (grams === null || grams <= 0) throw new Error("Weight must be positive.");

  const lot = await prisma.bean.findFirstOrThrow({ where: { id: lotId, teamId: user.teamId } });
  const addedPrice = num(formData, "purchasePrice");

  await prisma.$transaction(async (tx) => {
    await tx.bean.update({
      where: { id: lotId },
      data: {
        weightGrams: lot.weightGrams + grams,
        remainingGrams: lot.remainingGrams + grams,
        ...(addedPrice != null ? { purchasePrice: (lot.purchasePrice ?? 0) + addedPrice } : {}),
        lowStockDismissed: false,
      },
    });
  });

  revalidateInventory();
}

// --- Roast logging ------------------------------------------------------------

/**
 * Quick single-lot roast log: a completed session created after the fact,
 * deducting green immediately. For live roasts with probes/curves, the
 * main /roasts flow is still the right tool — this is the business
 * logbook, not the roast console.
 */
export async function logRoast(formData: FormData) {
  const user = await requireUser();
  const beanId = str(formData, "beanId");
  const greenWeightGrams = gramsFrom(formData, "greenWeightGrams", "greenWeightGramsUnit");
  const roastLevel = str(formData, "roastLevel");
  const roasterDefinitionIdInput = str(formData, "roasterDefinitionId");

  if (!beanId) throw new Error("Choose a lot.");
  if (greenWeightGrams === null || greenWeightGrams <= 0) {
    throw new Error("Green weight must be positive.");
  }
  if (!roastLevel) throw new Error("Roast level is required.");

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    const bean = await tx.bean.findFirstOrThrow({ where: { id: beanId, teamId: user.teamId } });
    if (bean.remainingGrams < greenWeightGrams) {
      throw new Error(`Only ${bean.remainingGrams}g of ${bean.name} left in stock.`);
    }
    await tx.bean.update({
      where: { id: beanId },
      data: { remainingGrams: bean.remainingGrams - greenWeightGrams },
    });

    const roasterDefinitionId = roasterDefinitionIdInput
      ? (await tx.roasterDefinition.findFirstOrThrow({ where: { id: roasterDefinitionIdInput, teamId: user.teamId } }))
          .id
      : (await tx.roasterDefinition.findFirst({ where: { teamId: user.teamId, isDefault: true } }))?.id ??
        (await tx.roasterDefinition.findFirstOrThrow({ where: { teamId: user.teamId } })).id;

    const roastedWeightGrams = gramsFrom(formData, "roastedWeightGrams", "roastedWeightGramsUnit");
    await tx.roastSession.create({
      data: {
        beanId,
        greenWeightGrams,
        roastedWeightGrams,
        roastedRemainingGrams: roastedWeightGrams,
        roastLevel,
        rating: num(formData, "rating"),
        notes: str(formData, "notes"),
        roasterDefinitionId,
        startedAt: now,
        endedAt: now,
        teamId: user.teamId,
      },
    });
  });

  revalidateInventory();
}

/**
 * Logs one blend roast: one completed RoastSession per component, each
 * deducting its proportional share of green from its own lot, all sharing
 * a blendBatchId so the roast log renders them as one roast.
 */
export async function logBlendRoast(formData: FormData) {
  const user = await requireUser();
  const blendRecipeId = str(formData, "blendRecipeId");
  const totalGreenGrams = gramsFrom(formData, "totalGreenGrams", "totalGreenGramsUnit");
  const roastLevel = str(formData, "roastLevel");
  const roasterDefinitionIdInput = str(formData, "roasterDefinitionId");

  if (!blendRecipeId) throw new Error("Choose a blend recipe.");
  if (totalGreenGrams === null || totalGreenGrams <= 0) {
    throw new Error("Total green weight must be positive.");
  }
  if (!roastLevel) throw new Error("Roast level is required.");

  const recipe = await prisma.blendRecipe.findFirstOrThrow({
    where: { id: blendRecipeId, teamId: user.teamId },
    include: { components: { include: { bean: true } } },
  });

  // A lot deletion can leave a recipe's ratios under 100% — refuse to log
  // until the recipe is fixed rather than silently under-deducting.
  const ratioTotal = recipe.components.reduce((sum, c) => sum + c.ratioPercent, 0);
  if (Math.abs(ratioTotal - 100) > 0.01) {
    throw new Error(
      `This blend's ratios only add up to ${Math.round(ratioTotal * 10) / 10}% — fix the recipe before logging a roast.`
    );
  }

  const roasterDefinitionId = roasterDefinitionIdInput
    ? (await prisma.roasterDefinition.findFirstOrThrow({ where: { id: roasterDefinitionIdInput, teamId: user.teamId } })).id
    : (await prisma.roasterDefinition.findFirst({ where: { teamId: user.teamId, isDefault: true } }))?.id ??
      (await prisma.roasterDefinition.findFirstOrThrow({ where: { teamId: user.teamId } })).id;

  const now = new Date();
  const blendBatchId = randomUUID();
  const roastedWeightGrams = gramsFrom(formData, "roastedWeightGrams", "roastedWeightGramsUnit");

  await prisma.$transaction(async (tx) => {
    for (const component of recipe.components) {
      const greenWeightGrams = (totalGreenGrams * component.ratioPercent) / 100;
      const bean = await tx.bean.findFirstOrThrow({ where: { id: component.beanId, teamId: user.teamId } });
      if (bean.remainingGrams < greenWeightGrams) {
        throw new Error(
          `Only ${bean.remainingGrams}g of ${bean.name} left — not enough for its ${component.ratioPercent}% share (${Math.round(greenWeightGrams)}g).`
        );
      }
      await tx.bean.update({
        where: { id: bean.id },
        data: { remainingGrams: bean.remainingGrams - greenWeightGrams },
      });

      await tx.roastSession.create({
        data: {
          beanId: bean.id,
          greenWeightGrams,
          // Yield split proportionally when recorded; null stays null
          // (the cost math returns null, never a fake number).
          roastedWeightGrams:
            roastedWeightGrams != null ? (roastedWeightGrams * component.ratioPercent) / 100 : null,
          roastedRemainingGrams:
            roastedWeightGrams != null ? (roastedWeightGrams * component.ratioPercent) / 100 : null,
          roastLevel,
          rating: num(formData, "rating"),
          notes: str(formData, "notes"),
          roasterDefinitionId,
          startedAt: now,
          endedAt: now,
          blendRecipeId: recipe.id,
          blendBatchId,
          teamId: user.teamId,
        },
      });
    }
  });

  revalidateInventory();
}

// --- Artisan import ------------------------------------------------------------

/**
 * Imports an Artisan .alog/.json roast file into the inventory logbook.
 * Same parse as the roasting app's import, but inventory-owned: it
 * deducts stock and stays inside /inventory (no redirect to /roasts).
 */
export async function importArtisanRoast(formData: FormData): Promise<{ ok: true; sessionId: string }> {
  const user = await requireUser();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Choose an Artisan .alog or .json file to import.");
  }
  const beanMode = str(formData, "beanMode");
  const beanId = str(formData, "beanId");
  const newBeanName = str(formData, "newBeanName");
  const newBeanOrigin = str(formData, "newBeanOrigin");
  const newBeanProcess = str(formData, "newBeanProcess");
  const roasterDefinitionId = str(formData, "roasterDefinitionId");
  const roastLevel = str(formData, "roastLevel");
  const rating = num(formData, "rating");
  const notes = str(formData, "notes");

  if (beanMode !== "existing" && beanMode !== "new") {
    throw new Error("Choose an existing lot or provide a new one.");
  }
  if (beanMode === "existing" && !beanId) {
    throw new Error("Select a lot.");
  }
  if (beanMode === "new" && (!newBeanOrigin || !newBeanProcess)) {
    throw new Error("A new lot needs at least an origin and a process — the name can come from the file.");
  }
  if (!roasterDefinitionId) {
    throw new Error("Select which roaster this was run on.");
  }
  if (!roastLevel) {
    throw new Error("Roast level is required.");
  }

  const text = await file.text();
  let profile;
  try {
    profile = parseArtisanFile(text);
  } catch (e) {
    throw e instanceof Error ? e : new Error("Couldn't read this Artisan file.");
  }

  const definition = await prisma.roasterDefinition.findFirstOrThrow({
    where: { id: roasterDefinitionId, teamId: user.teamId },
  });
  const controls = parseControls(definition.controlsJson);
  const result = buildArtisanImportResult(profile, controls);

  const session = await prisma.$transaction(async (tx) => {
    let resolvedBeanId: string;
    if (beanMode === "existing") {
      const bean = await tx.bean.findFirstOrThrow({ where: { id: beanId!, teamId: user.teamId } });
      if (bean.remainingGrams < result.greenWeightGrams) {
        throw new Error(
          `Only ${bean.remainingGrams}g of ${bean.name} left in stock — can't import a ${result.greenWeightGrams}g roast.`
        );
      }
      await tx.bean.update({
        where: { id: bean.id },
        data: { remainingGrams: bean.remainingGrams - result.greenWeightGrams },
      });
      resolvedBeanId = bean.id;
    } else {
      const created = await tx.bean.create({
        data: {
          name: newBeanName || result.beanNameGuess.name,
          origin: newBeanOrigin!,
          process: newBeanProcess!,
          weightGrams: result.greenWeightGrams,
          remainingGrams: 0,
          teamId: user.teamId,
        },
      });
      resolvedBeanId = created.id;
    }

    const created = await tx.roastSession.create({
      data: {
        beanId: resolvedBeanId,
        greenWeightGrams: result.greenWeightGrams,
        roastedWeightGrams: result.roastedWeightGrams,
        roastedRemainingGrams: result.roastedWeightGrams,
        roasterDefinitionId,
        startedAt: result.startedAt,
        endedAt: result.endedAt,
        roastLevel,
        rating,
        notes,
        teamId: user.teamId,
      },
    });

    if (result.events.length > 0) {
      await tx.roastEvent.createMany({
        data: result.events.map((e) => ({ roastSessionId: created.id, ...e })),
      });
    }
    if (result.temperatureReadings.length > 0) {
      await tx.temperatureReading.createMany({
        data: result.temperatureReadings.map((r) => ({ roastSessionId: created.id, ...r })),
      });
    }

    return created;
  });

  revalidateInventory();
  return { ok: true, sessionId: session.id };
}

// --- Blend recipes ---------------------------------------------------------------

interface BlendComponentInput {
  beanId: string;
  ratioPercent: number;
}

async function validatedBlendInput(formData: FormData, teamId: string) {
  const name = str(formData, "name");
  if (!name) throw new Error("Blend name is required.");

  const raw = str(formData, "componentsJson");
  if (!raw) throw new Error("Add at least two lots to the blend.");
  let components: unknown;
  try {
    components = JSON.parse(raw);
  } catch {
    throw new Error("Couldn't read the blend components — try again.");
  }
  if (!Array.isArray(components) || components.length < 2) {
    throw new Error("A blend needs at least two lots.");
  }

  const parsed: BlendComponentInput[] = components.map((c) => {
    const beanId = typeof (c as { beanId?: unknown }).beanId === "string" ? (c as { beanId: string }).beanId : "";
    const ratioPercent = Number((c as { ratioPercent?: unknown }).ratioPercent);
    if (!beanId || !Number.isFinite(ratioPercent) || ratioPercent <= 0 || ratioPercent > 100) {
      throw new Error("Each component needs a lot and a share between 0 and 100%.");
    }
    return { beanId, ratioPercent };
  });

  // No lot twice in one blend.
  const ids = parsed.map((c) => c.beanId);
  if (new Set(ids).size !== ids.length) {
    throw new Error("The same lot can't appear twice in one blend.");
  }

  // Shares must cover the whole blend — a 97% blend silently drops 3% of
  // every batch, so this is a hard error, not a warning.
  const total = parsed.reduce((sum, c) => sum + c.ratioPercent, 0);
  if (Math.abs(total - 100) > 0.01) {
    throw new Error(`Component shares must add up to 100% (currently ${Math.round(total * 10) / 10}%).`);
  }

  // Every lot re-checked against this team regardless of what the form
  // sent — never trusted just because the client picked it.
  for (const c of parsed) {
    await prisma.bean.findFirstOrThrow({ where: { id: c.beanId, teamId } });
  }

  return { name, notes: str(formData, "notes"), components: parsed };
}

export async function createBlendRecipe(formData: FormData) {
  const user = await requireUser();
  const { name, notes, components } = await validatedBlendInput(formData, user.teamId);

  await prisma.blendRecipe.create({
    data: {
      name,
      notes,
      teamId: user.teamId,
      components: { create: components },
    },
  });

  revalidateInventory();
}

export async function updateBlendRecipe(id: string, formData: FormData) {
  const user = await requireUser();
  await prisma.blendRecipe.findFirstOrThrow({ where: { id, teamId: user.teamId } });
  const { name, notes, components } = await validatedBlendInput(formData, user.teamId);

  // Replace the component set wholesale in one transaction — editing a
  // ratio is a new fact about the recipe, and past blend roasts already
  // snapshotted their own sessions, so nothing historical is rewritten.
  await prisma.$transaction(async (tx) => {
    await tx.blendComponent.deleteMany({ where: { blendRecipeId: id } });
    await tx.blendRecipe.update({
      where: { id },
      data: { name, notes, components: { create: components } },
    });
  });

  revalidateInventory();
}

export async function deleteBlendRecipe(id: string) {
  const user = await requireUser();
  await prisma.blendRecipe.findFirstOrThrow({ where: { id, teamId: user.teamId } });

  // RoastSessions keep their history via blendRecipeId's SetNull — deleting
  // the recipe never deletes roasts logged from it.
  await prisma.blendRecipe.delete({ where: { id } });

  revalidateInventory();
}

// --- Monthly plans (wrappers over the shared plan actions) ------------------------

/** Plans are team commitments, not stock moves — actual roasts decrement
 * inventory when they happen. These wrap the shared plan actions and add
 * inventory-side revalidation. The target weight goes through the unit
 * switcher, so it's normalized to grams before delegating. */
function normalizePlanUnits(formData: FormData) {
  const grams = gramsFrom(formData, "targetGrams", "targetGramsUnit");
  if (grams != null) formData.set("targetGrams", String(grams));
}

export async function createPlan(formData: FormData) {
  normalizePlanUnits(formData);
  await createProductionPlan(formData);
  revalidateInventory();
}

export async function updatePlan(id: string, formData: FormData) {
  normalizePlanUnits(formData);
  await updateProductionPlan(id, formData);
  revalidateInventory();
}

export async function deletePlan(id: string) {
  await deleteProductionPlan(id);
  revalidateInventory();
}

// --- Lot cuppings ---------------------------------------------------------------

const CUPPING_SCORE_KEYS = [
  "fragranceAroma",
  "flavor",
  "aftertaste",
  "acidity",
  "body",
  "balance",
  "uniformity",
  "cleanCup",
  "sweetness",
  "overall",
  "defects",
] as const;

/**
 * A cupping attached directly to a green lot (arrival sample, pre-roast
 * check) — roast-attached cuppings keep using the roasting app's flow.
 */
export async function createLotCupping(formData: FormData) {
  const user = await requireUser();
  const beanId = str(formData, "beanId");
  if (!beanId) throw new Error("Choose a lot.");
  await prisma.bean.findFirstOrThrow({ where: { id: beanId, teamId: user.teamId } });

  const scores: Record<string, number | null> = {};
  for (const key of CUPPING_SCORE_KEYS) {
    const v = num(formData, key);
    if (v !== null && (v < 0 || v > 10)) throw new Error(`${key} must be between 0 and 10.`);
    scores[key] = v;
  }
  if (Object.values(scores).every((v) => v === null) && !str(formData, "notes")) {
    throw new Error("Add at least one score or a note.");
  }

  const cuppedAtRaw = str(formData, "cuppedAt");
  await prisma.cuppingNote.create({
    data: {
      beanId,
      roastSessionId: null,
      cuppedAt: cuppedAtRaw ? new Date(`${cuppedAtRaw}T00:00`) : new Date(),
      ...scores,
      notes: str(formData, "notes"),
    },
  });

  revalidateInventory();
}

export async function deleteLotCupping(id: string) {
  const user = await requireUser();
  const note = await prisma.cuppingNote.findFirstOrThrow({
    where: { id, beanId: { not: null } },
    include: { bean: true },
  });
  if (note.bean?.teamId !== user.teamId) throw new Error("Not found.");
  await prisma.cuppingNote.delete({ where: { id } });

  revalidateInventory();
}

// --- Receipt intake ---------------------------------------------------------------

const RECEIPT_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
]);
const RECEIPT_MAX_BYTES = 15 * 1024 * 1024;

export interface ReceiptExtractionResult {
  ok: boolean;
  error?: string;
  receiptUrl?: string;
  fields?: ReceiptInfo;
}

/**
 * Receipt intake, step 1: uploads the photo/PDF to Blob (persisted as the
 * lot's source document) and runs Claude vision over it. Returns the
 * extracted fields — nothing saves to the database except the Blob file
 * itself; the lot is only created from the confirm step.
 */
export async function scanReceipt(formData: FormData): Promise<ReceiptExtractionResult> {
  const user = await requireUser();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose a receipt photo or PDF." };
  }
  if (!RECEIPT_MIME_TYPES.has(file.type)) {
    return { ok: false, error: "That file type isn't supported — use a photo (JPG/PNG/WebP) or PDF." };
  }
  if (file.size > RECEIPT_MAX_BYTES) {
    return { ok: false, error: "That file is over 15MB — try a smaller photo." };
  }

  try {
    const blob = await put(`receipts/${user.teamId}/${file.name}`, file, {
      access: "public",
      addRandomSuffix: true,
    });

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");
    const fields = await extractReceiptInfo(base64, file.type);

    return { ok: true, receiptUrl: blob.url, fields };
  } catch (e) {
    console.error("scanReceipt failed", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Couldn't read that receipt — try again.",
    };
  }
}

// --- Smart add ---------------------------------------------------------------------

export interface SmartAddResult {
  ok: boolean;
  error?: string;
  fields?: LotDetails;
}

/**
 * Smart add: paste a supplier product page URL → Claude pulls the lot
 * details → confirm → createLot. URL-based only: the roaster pastes the
 * link (usually straight from the order confirmation email).
 */
export async function extractLotFromUrl(formData: FormData): Promise<SmartAddResult> {
  await requireUser();

  const url = str(formData, "url");
  if (!url) return { ok: false, error: "Paste the supplier's product page URL." };
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, error: "That doesn't look like a valid URL." };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, error: "Only http(s) URLs." };
  }

  try {
    const fields = await extractLotDetails(parsed.toString());
    return { ok: true, fields };
  } catch (e) {
    console.error("extractLotFromUrl failed", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Couldn't read that page — try again.",
    };
  }
}

// --- Dashboard widget preferences ----------------------------------------------------

/**
 * Persists which dashboard widgets the team has hidden. Unknown keys are
 * dropped — the widget list is the source of truth, not the form.
 */
export async function setWidgetPrefs(formData: FormData) {
  const user = await requireUser();
  const validKeys: Set<string> = new Set(INVENTORY_WIDGETS.map((w) => w.key));
  let hidden: string[];
  try {
    const parsed: unknown = JSON.parse(str(formData, "hidden") ?? "[]");
    hidden = Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === "string" && validKeys.has(k)) : [];
  } catch {
    throw new Error("Couldn't read the widget preferences — try again.");
  }

  await prisma.inventoryWidgetPrefs.upsert({
    where: { teamId: user.teamId },
    create: { teamId: user.teamId, hiddenWidgets: JSON.stringify(hidden) },
    update: { hiddenWidgets: JSON.stringify(hidden) },
  });

  revalidatePath("/inventory");
}
