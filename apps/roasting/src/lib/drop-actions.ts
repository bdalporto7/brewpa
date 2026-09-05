"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { DROP_ORDER_ROAST_STYLES } from "@/lib/constants";

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

/**
 * 24 random bytes, base64url-encoded — 32 URL-safe characters, ~144 bits
 * of entropy. This is the *entire* access-control mechanism for the
 * public drop page (src/app/drop/[token]/page.tsx): knowing it is
 * indistinguishable from being allowed in, so it has to be long enough
 * that guessing or brute-forcing it isn't practically feasible — a short,
 * human-typeable code wouldn't be.
 */
function generateAccessToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

// ===== Admin actions (reachable only from session-gated pages, same as every other action in this app) =====

export async function createDrop(formData: FormData) {
  const name = str(formData, "name");
  const notes = str(formData, "notes");
  const beanIds = formData.getAll("beanIds").map(String).filter(Boolean);

  if (!name) throw new Error("A name is required.");
  if (beanIds.length === 0) throw new Error("Pick at least one bean.");

  const drop = await prisma.drop.create({
    data: {
      name,
      notes,
      accessToken: generateAccessToken(),
      beans: { connect: beanIds.map((id) => ({ id })) },
    },
  });

  revalidatePath("/friends");
  redirect(`/drops/${drop.id}`);
}

/** No gram-restoration step (unlike the old startDrop/deleteDrop) — a drop never reserves anything out of a bean's stock; see the schema's Drop doc comment. */
export async function deleteDrop(dropId: string) {
  await prisma.drop.delete({ where: { id: dropId } });
  revalidatePath("/friends");
  redirect("/friends");
}

export async function closeDrop(dropId: string) {
  await prisma.drop.update({ where: { id: dropId }, data: { closedAt: new Date() } });
  revalidatePath("/friends");
  revalidatePath(`/drops/${dropId}`);
}

export async function reopenDrop(dropId: string) {
  await prisma.drop.update({ where: { id: dropId }, data: { closedAt: null } });
  revalidatePath("/friends");
  revalidatePath(`/drops/${dropId}`);
}

/** Invalidates any previously shared link for this drop (a fresh token) — for when one leaked or was shared somewhere it shouldn't have been. */
export async function regenerateDropLink(dropId: string) {
  await prisma.drop.update({ where: { id: dropId }, data: { accessToken: generateAccessToken() } });
  revalidatePath(`/drops/${dropId}`);
}

export async function deleteDropOrder(dropId: string, orderId: string) {
  await prisma.dropOrder.delete({ where: { id: orderId } });
  revalidatePath(`/drops/${dropId}`);
}

/** Removes one bean+style pick from an order without canceling the whole thing — e.g. a bean in someone's order ran out before it could be fulfilled. */
export async function deleteDropOrderItem(dropId: string, itemId: string) {
  await prisma.dropOrderItem.delete({ where: { id: itemId } });
  revalidatePath(`/drops/${dropId}`);
}

export async function setDropOrderItemPaid(dropId: string, itemId: string, paid: boolean) {
  await prisma.dropOrderItem.update({ where: { id: itemId }, data: { paid } });
  revalidatePath(`/drops/${dropId}`);
}

/**
 * Fulfilling a pick means real roasted coffee actually changed hands — so
 * this creates a real Sale (drawn from a specific completed roast) rather
 * than flipping a flag, keeping the pick and the roasted-stock ledger
 * reconciled through one row instead of two trackers that could drift
 * apart. Same pattern the old fulfillDropClaim used, one level deeper
 * (per-item instead of per-claim, since one order can span several beans).
 */
export async function fulfillDropOrderItem(dropId: string, itemId: string, formData: FormData) {
  const roastSessionId = str(formData, "roastSessionId");
  const roastedWeightGrams = num(formData, "roastedWeightGrams");

  if (!roastSessionId || roastedWeightGrams === null || roastedWeightGrams <= 0) {
    throw new Error("A roast and a positive roasted weight are required to fulfill this pick.");
  }

  await prisma.$transaction(async (tx) => {
    const item = await tx.dropOrderItem.findUniqueOrThrow({ where: { id: itemId } });
    if (item.saleId) {
      throw new Error("This pick is already fulfilled.");
    }

    const session = await tx.roastSession.findUniqueOrThrow({ where: { id: roastSessionId } });
    const onHand = session.roastedRemainingGrams ?? 0;
    if (onHand < roastedWeightGrams) {
      throw new Error(`Only ${Math.round(onHand * 10) / 10}g of roasted coffee left from that roast.`);
    }

    await tx.roastSession.update({
      where: { id: roastSessionId },
      data: { roastedRemainingGrams: onHand - roastedWeightGrams },
    });

    const order = await tx.dropOrder.findUniqueOrThrow({ where: { id: item.dropOrderId } });

    const sale = await tx.sale.create({
      data: {
        roastSessionId,
        friendId: order.friendId,
        weightGrams: roastedWeightGrams,
        price: item.price,
        notes: item.notes,
      },
    });

    await tx.dropOrderItem.update({ where: { id: itemId }, data: { saleId: sale.id } });
  });

  revalidatePath(`/drops/${dropId}`);
  revalidatePath("/roasts");
  revalidatePath(`/roasts/${roastSessionId}`);
}

/** Undoes a fulfillment: restores the roasted weight and removes the Sale, unlinking the pick. */
export async function unfulfillDropOrderItem(dropId: string, itemId: string) {
  await prisma.$transaction(async (tx) => {
    const item = await tx.dropOrderItem.findUniqueOrThrow({ where: { id: itemId } });
    if (!item.saleId) return;

    const sale = await tx.sale.findUniqueOrThrow({ where: { id: item.saleId } });
    const session = await tx.roastSession.findUniqueOrThrow({ where: { id: sale.roastSessionId } });
    await tx.roastSession.update({
      where: { id: sale.roastSessionId },
      data: { roastedRemainingGrams: (session.roastedRemainingGrams ?? 0) + sale.weightGrams },
    });
    // Deleting the Sale sets DropOrderItem.saleId to null automatically (onDelete: SetNull).
    await tx.sale.delete({ where: { id: sale.id } });
  });

  revalidatePath(`/drops/${dropId}`);
  revalidatePath("/roasts");
}

// ===== Public action — reachable from src/app/drop/[token]/page.tsx, which proxy.ts excludes from the session gate. accessToken is re-checked here, not just trusted because the page rendered. =====

export async function submitDropOrder(dropId: string, accessToken: string, formData: FormData) {
  const name = str(formData, "name");
  const beanIds = formData.getAll("beanId").map(String);
  const roastStyles = formData.getAll("roastStyle").map(String);

  if (!name) throw new Error("Your name is required.");
  if (beanIds.length === 0 || beanIds.length !== roastStyles.length) {
    throw new Error("Pick at least one bean and roast style.");
  }
  const validStyles = new Set<string>(DROP_ORDER_ROAST_STYLES);
  for (const style of roastStyles) {
    if (!validStyles.has(style)) throw new Error("Invalid roast style.");
  }

  await prisma.$transaction(async (tx) => {
    const drop = await tx.drop.findUniqueOrThrow({ where: { id: dropId }, include: { beans: true } });
    if (drop.accessToken !== accessToken) {
      throw new Error("Invalid or expired link.");
    }
    if (drop.closedAt) {
      throw new Error("This drop is closed.");
    }

    const allowedBeanIds = new Set(drop.beans.map((b) => b.id));
    for (const beanId of beanIds) {
      if (!allowedBeanIds.has(beanId)) throw new Error("That bean isn't part of this drop.");
    }

    // Same case-insensitive match-or-create pattern addDropClaim/recordSale already used.
    const existingFriends = await tx.friend.findMany();
    const match = existingFriends.find((f) => f.name.toLowerCase() === name.toLowerCase());
    const friend = match ?? (await tx.friend.create({ data: { name } }));

    await tx.dropOrder.create({
      data: {
        dropId,
        friendId: friend.id,
        name,
        items: {
          create: beanIds.map((beanId, i) => ({ beanId, roastStyle: roastStyles[i] })),
        },
      },
    });
  });

  redirect(`/drop/${accessToken}?submitted=1`);
}
