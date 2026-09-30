"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/admin";
import { adjustBeanStock } from "@/lib/actions";
import { extractReceiptInfo, type ReceiptInfo } from "@/lib/receiptExtractor";
import { extractLotDetails, type LotDetails } from "@/lib/supplierExtractor";

/**
 * Server Actions for the /inventory section (blends, quick roast logging,
 * lot cuppings, receipt + smart-add intake). Bean CRUD itself is reused
 * from actions.ts (createBean/updateBean/deleteBean) and stock moves from
 * adjustBeanStock/setBeanStock — this file only holds what's genuinely new.
 *
 * Team-scoped via requireUser throughout, same as the rest of the app.
 * "Derived, not stored": blend roasts are N real RoastSessions sharing a
 * blendBatchId (each deducting its own bean's stock through the same
 * transaction pattern as startRoast), never a parallel stock ledger.
 */

const INVENTORY_PATHS = ["/inventory", "/inventory/lots", "/inventory/roasts", "/inventory/blends"];

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

// --- Blend recipes -----------------------------------------------------------

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

  revalidatePath("/inventory/blends");
  revalidatePath("/inventory");
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

  revalidatePath("/inventory/blends");
  revalidatePath("/inventory");
}

export async function deleteBlendRecipe(id: string) {
  const user = await requireUser();
  await prisma.blendRecipe.findFirstOrThrow({ where: { id, teamId: user.teamId } });

  // RoastSessions keep their history via blendRecipeId's SetNull — deleting
  // the recipe never deletes roasts logged from it.
  await prisma.blendRecipe.delete({ where: { id } });

  revalidatePath("/inventory/blends");
  revalidatePath("/inventory");
}

// --- Blend roast logging -------------------------------------------------------

/**
 * Logs one blend roast: creates one completed RoastSession per component,
 * each deducting its proportional share of green from its own lot, all
 * sharing a blendBatchId so the roast log can render them as one roast.
 * Mirrors startRoast's stock check + deduction, per component.
 */
export async function logBlendRoast(formData: FormData) {
  const user = await requireUser();
  const blendRecipeId = str(formData, "blendRecipeId");
  const totalGreenGrams = num(formData, "totalGreenGrams");
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
  const roastedWeightGrams = num(formData, "roastedWeightGrams");

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
          // (economics.ts returns null, never a fake number).
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

/**
 * Quick single-lot roast log (the inventory roast log's "log a roast"):
 * a completed session created after the fact, deducting green immediately.
 * For live roasts with probes/curves, the main /roasts flow is still the
 * right tool — this is the business logbook, not the roast console.
 */
export async function logRoast(formData: FormData) {
  const user = await requireUser();
  const beanId = str(formData, "beanId");
  const greenWeightGrams = num(formData, "greenWeightGrams");
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

    const roastedWeightGrams = num(formData, "roastedWeightGrams");
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
  revalidatePath("/inventory/costs");
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
 * check) — roast-attached cuppings keep using the existing flow. Exactly
 * one of beanId/roastSessionId must be set (app-level, same convention as
 * Brew's roastSessionId/beanName).
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

  await prisma.cuppingNote.create({
    data: {
      beanId,
      roastSessionId: null,
      cuppedAt: str(formData, "cuppedAt") ? new Date(str(formData, "cuppedAt")!) : new Date(),
      ...scores,
      notes: str(formData, "notes"),
    },
  });

  revalidatePath("/inventory/cupping");
  revalidatePath(`/inventory/lots/${beanId}`);
}

export async function deleteLotCupping(id: string) {
  const user = await requireUser();
  const note = await prisma.cuppingNote.findFirstOrThrow({
    where: { id, beanId: { not: null } },
    include: { bean: true },
  });
  if (note.bean?.teamId !== user.teamId) throw new Error("Not found.");
  await prisma.cuppingNote.delete({ where: { id } });

  revalidatePath("/inventory/cupping");
  if (note.beanId) revalidatePath(`/inventory/lots/${note.beanId}`);
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
 * Step 1 of receipt intake: uploads the photo/PDF to Blob (persisted as
 * the lot's source document) and runs Claude vision over it. Returns the
 * extracted fields — nothing saves to the database except the Blob file
 * itself; the lot is only created/updated from the confirm screen (step
 * 2), which posts to the existing createBean / adjustBeanStock actions.
 */
export async function extractReceipt(formData: FormData): Promise<ReceiptExtractionResult> {
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
    console.error("extractReceipt failed", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Couldn't read that receipt — try again.",
    };
  }
}

// --- Smart Add ---------------------------------------------------------------------

export interface SmartAddResult {
  ok: boolean;
  error?: string;
  fields?: LotDetails;
}

/**
 * Smart Add: paste a supplier product page URL → Claude pulls the lot
 * details → confirm screen → createBean. URL-based only: there's no search
 * API configured, so "find the page" is the roaster pasting the link
 * (usually straight from the order confirmation email).
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

/**
 * Adds purchased weight to an existing lot — the receipt-intake "add to
 * existing lot" path. Thin wrapper over adjustBeanStock (which owns the
 * stock math + team checks); the FormData shape is what the confirm form
 * submits.
 */
export async function addStockToBean(formData: FormData) {
  const beanId = str(formData, "beanId");
  const grams = num(formData, "grams");
  if (!beanId) throw new Error("Choose a lot.");
  if (grams === null || grams <= 0) throw new Error("Weight must be positive.");
  await adjustBeanStock(beanId, "add", grams);
}
