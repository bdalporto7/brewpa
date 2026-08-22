"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { EventType } from "@/lib/constants";
import { writeRoastPage, removeRoastPage, writeIndexPage, type PublishableSession } from "@/lib/publish";
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

  if (!name || !origin || !process) {
    throw new Error("Name, origin, and process are required.");
  }

  await prisma.bean.update({
    where: { id },
    data: {
      name,
      origin,
      process,
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

export async function endRoast(roastSessionId: string, formData: FormData) {
  const roastedWeightGrams = num(formData, "roastedWeightGrams");
  const roastLevel = str(formData, "roastLevel");
  const rating = num(formData, "rating");
  const notes = str(formData, "notes");

  if (!roastLevel) {
    throw new Error("Roast level is required to end the roast.");
  }

  await prisma.$transaction(async (tx) => {
    const session = await tx.roastSession.findUniqueOrThrow({ where: { id: roastSessionId } });
    if (session.endedAt) {
      throw new Error("This roast has already ended.");
    }

    const endedAt = new Date();
    const atSeconds = Math.max(
      0,
      Math.round((endedAt.getTime() - session.startedAt.getTime()) / 1000)
    );

    await tx.roastEvent.create({
      data: { roastSessionId, type: "DROP", atSeconds },
    });

    await tx.roastSession.update({
      where: { id: roastSessionId },
      data: {
        endedAt,
        roastedWeightGrams,
        roastedRemainingGrams: roastedWeightGrams,
        roastLevel,
        rating,
        notes,
      },
    });
  });

  revalidatePath(`/roasts/${roastSessionId}`);
  revalidatePath("/roasts");
  revalidatePath("/");
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

  revalidatePath(`/roasts/${id}`);
}

export async function unpublishRoast(id: string) {
  await prisma.roastSession.update({ where: { id }, data: { publishedAt: null } });
  await removeRoastPage(id);
  await regeneratePublishedIndex();

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
