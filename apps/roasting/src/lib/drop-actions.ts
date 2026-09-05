"use server";

import crypto from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { DROP_ORDER_ROAST_STYLES } from "@/lib/constants";
import { getUnlockedDrop, setDropUnlockCookie } from "@/lib/drop-session";

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

// Excludes 0/O/1/I/L — a human is typing this off a screen or hearing it
// read aloud, so visually/verbally ambiguous characters cost real support
// requests for no security benefit. 8 chars from this 32-symbol alphabet
// is ~40 bits of entropy — not brute-forceable by hand, but a script
// could grind through it quickly if given the chance, which is exactly
// what redeemDropCode's rate limit (below) exists to prevent; unlike the
// old URL-token design, entropy alone isn't this code's whole security
// story.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function generateDropCode(): string {
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  }
  return code;
}

const RATE_LIMIT_MAX_ATTEMPTS = 8;
const RATE_LIMIT_WINDOW_MINUTES = 15;

async function getClientIp(): Promise<string> {
  const h = await headers();
  const forwardedFor = h.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return "unknown";
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
      code: generateDropCode(),
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

/**
 * Invalidates the previous code — and every browser's unlock cookie for
 * it, since those are signed against the drop's code at the time it was
 * entered (see drop-session.ts) — for when a code leaked or was shared
 * somewhere it shouldn't have been.
 */
export async function regenerateDropCode(dropId: string) {
  await prisma.drop.update({ where: { id: dropId }, data: { code: generateDropCode() } });
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

// ===== Public actions — reachable from src/app/drop/page.tsx, which proxy.ts excludes from the session gate. Neither action trusts anything the client sends about *which* drop this is: redeemDropCode looks a drop up by the code itself, and submitDropOrder re-derives the drop from the signed unlock cookie rather than taking a dropId/code from form fields a crafted request could forge. =====

/**
 * Every submission — right or wrong — counts against the rate limit
 * before the code is even looked up, so a script can't dodge the counter
 * by aborting requests that would fail some later check. The fixed delay
 * after that is a cheap second layer: rate limiting alone still lets a
 * burst of concurrent requests land before the count catches up, and the
 * delay flattens the throughput of any scripted attempt regardless.
 */
export async function redeemDropCode(formData: FormData) {
  const ip = await getClientIp();
  await prisma.dropCodeAttempt.create({ data: { ip } });

  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000);
  const recentAttempts = await prisma.dropCodeAttempt.count({ where: { ip, attemptedAt: { gt: since } } });
  if (recentAttempts > RATE_LIMIT_MAX_ATTEMPTS) {
    throw new Error("Too many attempts — try again in a few minutes.");
  }

  await new Promise((resolve) => setTimeout(resolve, 400));

  const rawCode = str(formData, "code");
  if (!rawCode) throw new Error("Enter a code.");
  const code = rawCode.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

  const drop = await prisma.drop.findUnique({ where: { code } });
  if (!drop || drop.closedAt) {
    throw new Error("That code isn't valid.");
  }

  await setDropUnlockCookie(drop.id, drop.code);
  revalidatePath("/drop");
}

export async function submitDropOrder(formData: FormData) {
  const drop = await getUnlockedDrop();
  if (!drop) throw new Error("Enter this drop's code first.");

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
    // Re-fetched inside the transaction (not just trusting the
    // getUnlockedDrop() read above) so a drop closed or a bean removed in
    // the instant between that read and this write still gets caught.
    const current = await tx.drop.findUniqueOrThrow({ where: { id: drop.id }, include: { beans: true } });
    if (current.closedAt) {
      throw new Error("This drop is closed.");
    }

    const allowedBeanIds = new Set(current.beans.map((b) => b.id));
    for (const beanId of beanIds) {
      if (!allowedBeanIds.has(beanId)) throw new Error("That bean isn't part of this drop.");
    }

    // Same case-insensitive match-or-create pattern addDropClaim/recordSale already used.
    const existingFriends = await tx.friend.findMany();
    const match = existingFriends.find((f) => f.name.toLowerCase() === name.toLowerCase());
    const friend = match ?? (await tx.friend.create({ data: { name } }));

    await tx.dropOrder.create({
      data: {
        dropId: drop.id,
        friendId: friend.id,
        name,
        items: {
          create: beanIds.map((beanId, i) => ({ beanId, roastStyle: roastStyles[i] })),
        },
      },
    });
  });

  redirect("/drop?submitted=1");
}
