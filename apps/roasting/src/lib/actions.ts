"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import type { EventType } from "@/lib/constants";
import { writeRoastPage, removeRoastPage, writeIndexPage, type PublishableSession } from "@/lib/publish";
import { syncGeneratedDocs } from "@/lib/git";
import { parseMMSS } from "@/lib/format";

const PUBLISHABLE_SESSION_INCLUDE = {
  bean: true,
  events: { orderBy: { atSeconds: "asc" as const } },
  sales: { include: { friend: true } },
};

async function regeneratePublishedIndex() {
  const published = (await prisma.roastSession.findMany({
    where: { publishedAt: { not: null } },
    include: PUBLISHABLE_SESSION_INCLUDE,
  })) as PublishableSession[];
  await writeIndexPage(published);
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

export async function createBean(formData: FormData) {
  const name = str(formData, "name");
  const origin = str(formData, "origin");
  const process = str(formData, "process");
  const weightGrams = num(formData, "weightGrams");

  if (!name || !origin || !process || weightGrams === null || weightGrams <= 0) {
    throw new Error("Name, origin, process, and a positive weight are required.");
  }

  await prisma.bean.create({
    data: {
      name,
      origin,
      process,
      weightGrams,
      remainingGrams: weightGrams,
      producer: str(formData, "producer"),
      variety: str(formData, "variety"),
      supplier: str(formData, "supplier"),
      supplierUrl: str(formData, "supplierUrl"),
      purchasePrice: num(formData, "purchasePrice"),
      notes: str(formData, "notes"),
    },
  });

  revalidatePath("/beans");
  revalidatePath("/");
}

export async function updateBean(id: string, formData: FormData) {
  const name = str(formData, "name");
  const origin = str(formData, "origin");
  const process = str(formData, "process");
  const weightGrams = num(formData, "weightGrams");

  if (!name || !origin || !process) {
    throw new Error("Name, origin, and process are required.");
  }
  if (weightGrams === null || weightGrams < 0) {
    throw new Error("Total purchased can't be negative.");
  }

  const bean = await prisma.bean.findUniqueOrThrow({ where: { id } });
  if (weightGrams < bean.remainingGrams) {
    throw new Error(
      `Total purchased can't be less than the ${bean.remainingGrams}g currently remaining.`
    );
  }

  await prisma.bean.update({
    where: { id },
    data: {
      name,
      origin,
      process,
      weightGrams,
      producer: str(formData, "producer"),
      variety: str(formData, "variety"),
      supplier: str(formData, "supplier"),
      supplierUrl: str(formData, "supplierUrl"),
      purchasePrice: num(formData, "purchasePrice"),
      notes: str(formData, "notes"),
    },
  });

  revalidatePath("/beans");
  revalidatePath("/");
}

export async function adjustBeanStock(beanId: string, direction: "add" | "remove", amount: number) {
  if (amount <= 0) throw new Error("Amount must be positive.");

  // Add/remove shifts the total right along with the remaining amount — this
  // represents coffee genuinely entering or leaving your possession (another
  // bag arrived, some spoiled/got lost), so the gap between total and
  // remaining — how much has gone through a roast — stays put. That gap only
  // ever moves via roast actions (startRoast/deleteRoastSession), never here.
  // "Set exact" (setBeanStock) is the other kind of correction — a recount
  // that only touches remainingGrams, deliberately not total.
  await prisma.$transaction(async (tx) => {
    const bean = await tx.bean.findUniqueOrThrow({ where: { id: beanId } });
    const delta = direction === "add" ? amount : -amount;
    const nextRemaining = bean.remainingGrams + delta;
    if (nextRemaining < 0) {
      throw new Error(`Only ${bean.remainingGrams}g left — can't remove ${amount}g.`);
    }
    await tx.bean.update({
      where: { id: beanId },
      data: {
        remainingGrams: Math.round(nextRemaining * 10) / 10,
        weightGrams: Math.round((bean.weightGrams + delta) * 10) / 10,
      },
    });
  });

  revalidatePath("/beans");
  revalidatePath("/");
}

export async function setBeanStock(beanId: string, amount: number) {
  if (amount < 0) throw new Error("Remaining stock can't be negative.");

  await prisma.bean.update({
    where: { id: beanId },
    data: { remainingGrams: Math.round(amount * 10) / 10 },
  });

  revalidatePath("/beans");
  revalidatePath("/");
}

/**
 * Marks (or unmarks, passing null) one of a bean's own completed roasts as
 * the target to compare future roasts of that bean against — see
 * `computeHistoricalBaseline`'s caller in `/roasts/[id]/page.tsx` for how
 * that comparison surfaces live.
 */
export async function setGoldenRoast(beanId: string, roastSessionId: string | null) {
  if (roastSessionId) {
    const session = await prisma.roastSession.findUniqueOrThrow({ where: { id: roastSessionId } });
    if (session.beanId !== beanId) {
      throw new Error("That roast isn't for this bean.");
    }
    if (!session.endedAt) {
      throw new Error("Only a completed roast can be set as the golden roast.");
    }
  }

  await prisma.bean.update({ where: { id: beanId }, data: { goldenRoastId: roastSessionId } });

  if (roastSessionId) revalidatePath(`/roasts/${roastSessionId}`);
  revalidatePath(`/beans/${beanId}`);
  revalidatePath("/roasts");
}

export async function deleteBean(id: string) {
  const sessionCount = await prisma.roastSession.count({ where: { beanId: id } });
  if (sessionCount > 0) {
    throw new Error(
      `Can't delete this bean — ${sessionCount} roast${sessionCount === 1 ? "" : "s"} logged against it.`
    );
  }

  await prisma.bean.delete({ where: { id } });
  revalidatePath("/beans");
  revalidatePath("/");
}

export async function startRoast(formData: FormData) {
  const beanId = str(formData, "beanId");
  const greenWeightGrams = num(formData, "greenWeightGrams");

  if (!beanId || greenWeightGrams === null || greenWeightGrams <= 0) {
    throw new Error("Bean and a positive green weight are required.");
  }

  const session = await prisma.$transaction(async (tx) => {
    const active = await tx.roastSession.findFirst({ where: { endedAt: null } });
    if (active) {
      throw new Error("A roast is already in progress — end it before starting another.");
    }

    const bean = await tx.bean.findUniqueOrThrow({ where: { id: beanId } });
    if (bean.remainingGrams < greenWeightGrams) {
      throw new Error(
        `Only ${bean.remainingGrams}g of ${bean.name} left in stock — can't start a ${greenWeightGrams}g roast.`
      );
    }

    await tx.bean.update({
      where: { id: beanId },
      data: { remainingGrams: bean.remainingGrams - greenWeightGrams },
    });

    return tx.roastSession.create({ data: { beanId, greenWeightGrams } });
  });

  revalidatePath("/roasts");
  revalidatePath("/");
  redirect(`/roasts/${session.id}`);
}

/**
 * The second half of starting a roast: the session already exists (bean and
 * green weight picked via startRoast) but the timer hasn't started — this is
 * the moment the roaster has dialed in their starting fan/heat and is
 * actually turning the roaster on. Sets startedAt (which is what makes the
 * session "live") and logs the initial fan/heat as atSeconds: 0 events.
 */
export async function beginRoast(roastSessionId: string, fanLevel: number, heatLevel: number) {
  await prisma.$transaction(async (tx) => {
    const session = await tx.roastSession.findUniqueOrThrow({ where: { id: roastSessionId } });
    if (session.startedAt) {
      throw new Error("This roast has already begun.");
    }

    await tx.roastSession.update({ where: { id: roastSessionId }, data: { startedAt: new Date() } });
    await tx.roastEvent.createMany({
      data: [
        { roastSessionId, type: "FAN", atSeconds: 0, fanLevel },
        { roastSessionId, type: "HEAT", atSeconds: 0, heatLevel },
      ],
    });
  });

  revalidatePath(`/roasts/${roastSessionId}`);
  revalidatePath("/roasts");
  revalidatePath("/");
}

/**
 * The same RoastSession.notes column RoastDetailsForm edits post-roast —
 * this just lets it be set/edited before a roast starts (a plan) or while
 * it's live (a running note), with no completed-roast gate.
 */
export async function updateRoastNotes(roastSessionId: string, formData: FormData) {
  const notes = str(formData, "notes");
  await prisma.roastSession.update({ where: { id: roastSessionId }, data: { notes } });
  revalidatePath(`/roasts/${roastSessionId}`);
}

export async function startPastRoast(formData: FormData) {
  const beanId = str(formData, "beanId");
  const greenWeightGrams = num(formData, "greenWeightGrams");
  const startedAtRaw = str(formData, "startedAt");
  const durationRaw = str(formData, "duration");
  const roastedWeightGrams = num(formData, "roastedWeightGrams");
  const roastLevel = str(formData, "roastLevel");
  const rating = num(formData, "rating");
  const notes = str(formData, "notes");

  if (!beanId || greenWeightGrams === null || greenWeightGrams <= 0) {
    throw new Error("Bean and a positive green weight are required.");
  }
  if (!startedAtRaw) {
    throw new Error("Start date/time is required.");
  }
  const startedAt = new Date(startedAtRaw);
  if (Number.isNaN(startedAt.getTime())) {
    throw new Error("Start date/time is invalid.");
  }
  const durationSeconds = durationRaw ? parseMMSS(durationRaw) : null;
  if (!durationRaw || durationSeconds === null || durationSeconds <= 0) {
    throw new Error("Duration is required, as m:ss (e.g. 6:30).");
  }
  if (!roastLevel) {
    throw new Error("Roast level is required.");
  }

  const endedAt = new Date(startedAt.getTime() + durationSeconds * 1000);

  const session = await prisma.$transaction(async (tx) => {
    const bean = await tx.bean.findUniqueOrThrow({ where: { id: beanId } });
    if (bean.remainingGrams < greenWeightGrams) {
      throw new Error(
        `Only ${bean.remainingGrams}g of ${bean.name} left in stock — can't log a ${greenWeightGrams}g roast.`
      );
    }

    await tx.bean.update({
      where: { id: beanId },
      data: { remainingGrams: bean.remainingGrams - greenWeightGrams },
    });

    const created = await tx.roastSession.create({
      data: {
        beanId,
        greenWeightGrams,
        startedAt,
        endedAt,
        roastedWeightGrams,
        roastedRemainingGrams: roastedWeightGrams,
        roastLevel,
        rating,
        notes,
      },
    });

    await tx.roastEvent.create({
      data: { roastSessionId: created.id, type: "DROP", atSeconds: durationSeconds },
    });

    return created;
  });

  revalidatePath("/roasts");
  revalidatePath("/");
  redirect(`/roasts/${session.id}`);
}

export async function logEvent(input: {
  roastSessionId: string;
  type: EventType;
  atSeconds: number;
  fanLevel?: number;
  heatLevel?: number;
  tempFahrenheit?: number;
  note?: string;
}) {
  await prisma.roastEvent.create({
    data: {
      roastSessionId: input.roastSessionId,
      type: input.type,
      atSeconds: input.atSeconds,
      fanLevel: input.fanLevel,
      heatLevel: input.heatLevel,
      tempFahrenheit: input.tempFahrenheit,
      note: input.note,
    },
  });

  revalidatePath(`/roasts/${input.roastSessionId}`);
}

export async function deleteEvent(roastSessionId: string, eventId: string) {
  await prisma.roastEvent.delete({ where: { id: eventId } });
  revalidatePath(`/roasts/${roastSessionId}`);
}

/**
 * Ends a roast immediately — no form, no required fields. Splitting this
 * from the follow-up details (updateRoastDetails, below) matters for the
 * same reason the pending/live split on the start side does: filling in a
 * dropdown shouldn't add seconds to the recorded roast duration. Dropping
 * IS the moment that matters; the roast level/weight/rating can be filled
 * in at whatever pace afterward without affecting anything already logged.
 */
export async function dropRoast(roastSessionId: string) {
  await prisma.$transaction(async (tx) => {
    const session = await tx.roastSession.findUniqueOrThrow({ where: { id: roastSessionId } });
    if (session.endedAt) {
      throw new Error("This roast has already ended.");
    }
    if (!session.startedAt) {
      throw new Error("This roast hasn't begun yet.");
    }

    const endedAt = new Date();
    const atSeconds = Math.max(
      0,
      Math.round((endedAt.getTime() - session.startedAt.getTime()) / 1000)
    );

    await tx.roastEvent.create({
      data: { roastSessionId, type: "DROP", atSeconds },
    });

    await tx.roastSession.update({ where: { id: roastSessionId }, data: { endedAt } });
  });

  revalidatePath(`/roasts/${roastSessionId}`);
  revalidatePath("/roasts");
  revalidatePath("/");
}

/**
 * Fills in (or edits) a completed roast's weight/level/rating/notes,
 * independent of when it was actually dropped. Re-editable, not one-shot:
 * if roastedWeightGrams was already set and some of it has since been
 * dropped to friends, correcting the total preserves the already-dropped
 * amount rather than resetting roastedRemainingGrams back to the full new
 * total — same "correcting a total shouldn't erase consumption" logic as
 * adjustBeanStock/updateBean's weightGrams field.
 */
export async function updateRoastDetails(roastSessionId: string, formData: FormData) {
  const roastedWeightGrams = num(formData, "roastedWeightGrams");
  const roastLevel = str(formData, "roastLevel");
  const rating = num(formData, "rating");
  const notes = str(formData, "notes");

  if (roastedWeightGrams !== null && roastedWeightGrams < 0) {
    throw new Error("Roasted weight can't be negative.");
  }

  await prisma.$transaction(async (tx) => {
    const session = await tx.roastSession.findUniqueOrThrow({ where: { id: roastSessionId } });
    if (!session.endedAt) {
      throw new Error("This roast hasn't been dropped yet.");
    }

    let roastedRemainingGrams = session.roastedRemainingGrams;
    if (roastedWeightGrams !== null) {
      if (session.roastedWeightGrams == null) {
        roastedRemainingGrams = roastedWeightGrams;
      } else {
        const alreadyDropped = session.roastedWeightGrams - (session.roastedRemainingGrams ?? 0);
        roastedRemainingGrams = Math.max(0, Math.round((roastedWeightGrams - alreadyDropped) * 10) / 10);
      }
    }

    await tx.roastSession.update({
      where: { id: roastSessionId },
      data: {
        roastedWeightGrams: roastedWeightGrams ?? session.roastedWeightGrams,
        roastedRemainingGrams,
        roastLevel,
        rating,
        notes,
      },
    });
  });

  revalidatePath(`/roasts/${roastSessionId}`);
  revalidatePath("/roasts");
  revalidatePath("/beans");
  revalidatePath("/");
}

function cuppingScoresFromForm(formData: FormData) {
  return {
    fragranceAroma: num(formData, "fragranceAroma"),
    flavor: num(formData, "flavor"),
    aftertaste: num(formData, "aftertaste"),
    acidity: num(formData, "acidity"),
    body: num(formData, "body"),
    balance: num(formData, "balance"),
    uniformity: num(formData, "uniformity"),
    cleanCup: num(formData, "cleanCup"),
    sweetness: num(formData, "sweetness"),
    overall: num(formData, "overall"),
    defects: num(formData, "defects"),
    notes: str(formData, "notes"),
  };
}

export async function addCuppingNote(roastSessionId: string, formData: FormData) {
  const session = await prisma.roastSession.findUniqueOrThrow({ where: { id: roastSessionId } });
  if (!session.endedAt) {
    throw new Error("Only a completed roast can be cupped.");
  }

  const cuppedAtRaw = str(formData, "cuppedAt");
  // A date-only string ("2026-08-24") parses as UTC midnight per spec, which
  // display-formats as the *previous* day in any timezone behind UTC —
  // appending a bare time (no "Z"/offset) forces local-midnight parsing
  // instead, matching what the date picker actually showed the user.
  const cuppedAt = cuppedAtRaw ? new Date(`${cuppedAtRaw}T00:00`) : new Date();
  await prisma.cuppingNote.create({
    data: {
      roastSessionId,
      cuppedAt,
      ...cuppingScoresFromForm(formData),
    },
  });

  revalidatePath(`/roasts/${roastSessionId}`);
}

export async function updateCuppingNote(cuppingNoteId: string, formData: FormData) {
  const note = await prisma.cuppingNote.update({
    where: { id: cuppingNoteId },
    data: cuppingScoresFromForm(formData),
  });

  revalidatePath(`/roasts/${note.roastSessionId}`);
}

export async function deleteCuppingNote(roastSessionId: string, cuppingNoteId: string) {
  await prisma.cuppingNote.delete({ where: { id: cuppingNoteId } });
  revalidatePath(`/roasts/${roastSessionId}`);
}

export async function adjustRoastedStock(
  roastSessionId: string,
  direction: "add" | "remove",
  amount: number
) {
  if (amount <= 0) throw new Error("Amount must be positive.");

  // Same model as adjustBeanStock: add/remove shifts the total (roastedWeightGrams)
  // right along with the remaining amount, keeping "how much has been dropped"
  // unchanged. Set exact (setRoastedStock) only touches remaining.
  await prisma.$transaction(async (tx) => {
    const session = await tx.roastSession.findUniqueOrThrow({ where: { id: roastSessionId } });
    const currentRemaining = session.roastedRemainingGrams ?? 0;
    const currentTotal = session.roastedWeightGrams ?? 0;
    const delta = direction === "add" ? amount : -amount;
    const nextRemaining = currentRemaining + delta;
    if (nextRemaining < 0) {
      throw new Error(`Only ${currentRemaining}g left — can't remove ${amount}g.`);
    }
    await tx.roastSession.update({
      where: { id: roastSessionId },
      data: {
        roastedRemainingGrams: Math.round(nextRemaining * 10) / 10,
        roastedWeightGrams: Math.round((currentTotal + delta) * 10) / 10,
      },
    });
  });

  revalidatePath(`/roasts/${roastSessionId}`);
  revalidatePath("/roasts");
  revalidatePath("/beans");
  revalidatePath("/");
}

export async function setRoastedStock(roastSessionId: string, amount: number) {
  if (amount < 0) throw new Error("Remaining stock can't be negative.");

  await prisma.roastSession.update({
    where: { id: roastSessionId },
    data: { roastedRemainingGrams: Math.round(amount * 10) / 10 },
  });

  revalidatePath(`/roasts/${roastSessionId}`);
  revalidatePath("/roasts");
  revalidatePath("/beans");
  revalidatePath("/");
}

export async function recordSale(roastSessionId: string, formData: FormData) {
  const weightGrams = num(formData, "weightGrams");
  const friendName = str(formData, "friendName");
  const price = num(formData, "price");
  const notes = str(formData, "notes");

  if (weightGrams === null || weightGrams <= 0) {
    throw new Error("A positive weight is required to log a drop.");
  }

  await prisma.$transaction(async (tx) => {
    const session = await tx.roastSession.findUniqueOrThrow({ where: { id: roastSessionId } });
    const onHand = session.roastedRemainingGrams ?? 0;
    if (onHand < weightGrams) {
      throw new Error(`Only ${onHand}g of roasted coffee left from this roast.`);
    }

    let friendId: string | null = null;
    if (friendName) {
      const existing = await tx.friend.findMany();
      const match = existing.find((f) => f.name.toLowerCase() === friendName.toLowerCase());
      const friend = match ?? (await tx.friend.create({ data: { name: friendName } }));
      friendId = friend.id;
    }

    await tx.roastSession.update({
      where: { id: roastSessionId },
      data: { roastedRemainingGrams: onHand - weightGrams },
    });

    await tx.sale.create({
      data: { roastSessionId, weightGrams, friendId, price, notes },
    });
  });

  revalidatePath(`/roasts/${roastSessionId}`);
  revalidatePath("/roasts");
  revalidatePath("/");
}

export async function deleteSale(roastSessionId: string, saleId: string) {
  await prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findUniqueOrThrow({ where: { id: saleId } });
    const session = await tx.roastSession.findUniqueOrThrow({ where: { id: roastSessionId } });
    await tx.roastSession.update({
      where: { id: roastSessionId },
      data: { roastedRemainingGrams: (session.roastedRemainingGrams ?? 0) + sale.weightGrams },
    });
    await tx.sale.delete({ where: { id: saleId } });
  });

  revalidatePath(`/roasts/${roastSessionId}`);
  revalidatePath("/roasts");
  revalidatePath("/");
}

export async function publishRoast(id: string) {
  const session = await prisma.roastSession.findUniqueOrThrow({
    where: { id },
    include: PUBLISHABLE_SESSION_INCLUDE,
  });
  if (!session.endedAt) {
    throw new Error("Only a completed roast can be published.");
  }

  await prisma.roastSession.update({ where: { id }, data: { publishedAt: new Date() } });
  await writeRoastPage(session as PublishableSession);
  await regeneratePublishedIndex();

  try {
    await syncGeneratedDocs(
      `Publish roast: ${session.bean.name} (${format(session.startedAt!, "yyyy-MM-dd")})`
    );
  } catch (err) {
    // Local files are already correct — only the DB's "this is live" claim needs undoing.
    await prisma.roastSession.update({ where: { id }, data: { publishedAt: null } });
    const detail = err instanceof Error ? err.message : "unknown error";
    throw new Error(`Generated the page, but couldn't push it live: ${detail}`);
  }

  revalidatePath(`/roasts/${id}`);
}

export async function unpublishRoast(id: string) {
  const session = await prisma.roastSession.findUniqueOrThrow({ where: { id }, include: { bean: true } });
  const previousPublishedAt = session.publishedAt;

  await prisma.roastSession.update({ where: { id }, data: { publishedAt: null } });
  await removeRoastPage(id);
  await regeneratePublishedIndex();

  try {
    await syncGeneratedDocs(`Unpublish roast: ${session.bean.name}`);
  } catch (err) {
    await prisma.roastSession.update({ where: { id }, data: { publishedAt: previousPublishedAt } });
    const detail = err instanceof Error ? err.message : "unknown error";
    throw new Error(`Removed the page, but couldn't push that live: ${detail}`);
  }

  revalidatePath(`/roasts/${id}`);
}

export async function deleteRoastSession(id: string) {
  const session = await prisma.$transaction(async (tx) => {
    const existing = await tx.roastSession.findUniqueOrThrow({ where: { id } });
    await tx.bean.update({
      where: { id: existing.beanId },
      data: { remainingGrams: { increment: existing.greenWeightGrams } },
    });
    await tx.roastSession.delete({ where: { id } });
    return existing;
  });

  if (session.publishedAt) {
    await removeRoastPage(id);
    await regeneratePublishedIndex();
    // Best-effort: the roast is already gone from the DB, so there's nothing
    // left to roll back to if this fails — just leave the stale page live
    // until the next successful publish/unpublish resyncs docs/.
    await syncGeneratedDocs(`Remove roast page: ${id}`).catch((err) => {
      console.error("Failed to push docs/ after deleting a published roast:", err);
    });
  }

  revalidatePath("/roasts");
  revalidatePath("/");
  redirect("/roasts");
}

export async function updateFriend(id: string, formData: FormData) {
  const name = str(formData, "name");
  const notes = str(formData, "notes");

  if (!name) {
    throw new Error("Name is required.");
  }

  await prisma.friend.update({ where: { id }, data: { name, notes } });

  revalidatePath("/friends");
  revalidatePath(`/friends/${id}`);
  revalidatePath("/roasts/[id]", "page");
}

export async function deleteFriend(id: string) {
  await prisma.friend.delete({ where: { id } });

  revalidatePath("/friends");
  revalidatePath("/roasts/[id]", "page");
  redirect("/friends");
}

/**
 * A green-coffee group buy: reserve totalGrams out of a bean's stock (same
 * "decrement at commitment time" pattern as startRoast) and open it up for
 * friends to claim portions of. See the Drop model's own doc comment for
 * why this is a different thing from Sale/recordSale.
 */
export async function startDrop(formData: FormData) {
  const beanId = str(formData, "beanId");
  const totalGrams = num(formData, "totalGrams");
  const portionGrams = num(formData, "portionGrams");
  const pricePerGram = num(formData, "pricePerGram");
  const notes = str(formData, "notes");

  if (!beanId || totalGrams === null || totalGrams <= 0) {
    throw new Error("Bean and a positive total weight are required.");
  }

  await prisma.$transaction(async (tx) => {
    const bean = await tx.bean.findUniqueOrThrow({ where: { id: beanId } });
    if (bean.remainingGrams < totalGrams) {
      throw new Error(`Only ${bean.remainingGrams}g of ${bean.name} left in stock.`);
    }

    await tx.bean.update({
      where: { id: beanId },
      data: { remainingGrams: bean.remainingGrams - totalGrams },
    });

    await tx.drop.create({
      data: { beanId, totalGrams, portionGrams, pricePerGram, notes },
    });
  });

  revalidatePath("/friends");
  revalidatePath("/beans");
  revalidatePath("/");
}

/** Cancels a drop entirely — restores its reserved grams back to the bean, cascades its claims. */
export async function deleteDrop(dropId: string) {
  await prisma.$transaction(async (tx) => {
    const drop = await tx.drop.findUniqueOrThrow({ where: { id: dropId } });
    await tx.bean.update({
      where: { id: drop.beanId },
      data: { remainingGrams: { increment: drop.totalGrams } },
    });
    await tx.drop.delete({ where: { id: dropId } });
  });

  revalidatePath("/friends");
  revalidatePath("/beans");
  revalidatePath("/");
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

/** First-come-first-serve: rejects a claim that would exceed the drop's remaining (unclaimed) grams. */
export async function addDropClaim(dropId: string, formData: FormData) {
  const friendName = str(formData, "friendName");
  const gramsClaimed = num(formData, "gramsClaimed");
  const price = num(formData, "price");
  const notes = str(formData, "notes");

  if (gramsClaimed === null || gramsClaimed <= 0) {
    throw new Error("A positive amount is required to claim a portion.");
  }

  await prisma.$transaction(async (tx) => {
    const drop = await tx.drop.findUniqueOrThrow({ where: { id: dropId }, include: { claims: true } });
    if (drop.closedAt) {
      throw new Error("This drop is closed — no more claims.");
    }
    const claimed = drop.claims.reduce((sum, c) => sum + c.gramsClaimed, 0);
    const remaining = drop.totalGrams - claimed;
    if (gramsClaimed > remaining) {
      throw new Error(`Only ${Math.round(remaining * 10) / 10}g left unclaimed on this drop.`);
    }

    let friendId: string | null = null;
    if (friendName) {
      const existing = await tx.friend.findMany();
      const match = existing.find((f) => f.name.toLowerCase() === friendName.toLowerCase());
      const friend = match ?? (await tx.friend.create({ data: { name: friendName } }));
      friendId = friend.id;
    }

    await tx.dropClaim.create({
      data: { dropId, friendId, gramsClaimed, price, notes },
    });
  });

  revalidatePath("/friends");
  revalidatePath(`/drops/${dropId}`);
}

export async function deleteDropClaim(dropId: string, claimId: string) {
  await prisma.dropClaim.delete({ where: { id: claimId } });
  revalidatePath("/friends");
  revalidatePath(`/drops/${dropId}`);
}

export async function setDropClaimPaid(dropId: string, claimId: string, paid: boolean) {
  await prisma.dropClaim.update({ where: { id: claimId }, data: { paid } });
  revalidatePath(`/drops/${dropId}`);
}

/**
 * Fulfilling a claim means real roasted coffee actually changed hands — so
 * this creates a real Sale (drawn from a specific completed roast of the
 * same bean) rather than flipping a flag, keeping the claim and the
 * roasted-stock ledger reconciled through one row instead of two trackers
 * that could drift apart.
 */
export async function fulfillDropClaim(dropId: string, claimId: string, formData: FormData) {
  const roastSessionId = str(formData, "roastSessionId");
  const roastedWeightGrams = num(formData, "roastedWeightGrams");

  if (!roastSessionId || roastedWeightGrams === null || roastedWeightGrams <= 0) {
    throw new Error("A roast and a positive roasted weight are required to fulfill a claim.");
  }

  await prisma.$transaction(async (tx) => {
    const claim = await tx.dropClaim.findUniqueOrThrow({ where: { id: claimId } });
    if (claim.saleId) {
      throw new Error("This claim is already fulfilled.");
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

    const sale = await tx.sale.create({
      data: {
        roastSessionId,
        friendId: claim.friendId,
        weightGrams: roastedWeightGrams,
        price: claim.price,
        notes: claim.notes,
      },
    });

    await tx.dropClaim.update({ where: { id: claimId }, data: { saleId: sale.id } });
  });

  revalidatePath(`/drops/${dropId}`);
  revalidatePath("/roasts");
  revalidatePath(`/roasts/${roastSessionId}`);
}

/** Undoes a fulfillment: restores the roasted weight and removes the Sale, unlinking the claim. */
export async function unfulfillDropClaim(dropId: string, claimId: string) {
  await prisma.$transaction(async (tx) => {
    const claim = await tx.dropClaim.findUniqueOrThrow({ where: { id: claimId } });
    if (!claim.saleId) return;

    const sale = await tx.sale.findUniqueOrThrow({ where: { id: claim.saleId } });
    const session = await tx.roastSession.findUniqueOrThrow({ where: { id: sale.roastSessionId } });
    await tx.roastSession.update({
      where: { id: sale.roastSessionId },
      data: { roastedRemainingGrams: (session.roastedRemainingGrams ?? 0) + sale.weightGrams },
    });
    // Deleting the Sale sets DropClaim.saleId to null automatically (onDelete: SetNull).
    await tx.sale.delete({ where: { id: sale.id } });
  });

  revalidatePath(`/drops/${dropId}`);
  revalidatePath("/roasts");
}
