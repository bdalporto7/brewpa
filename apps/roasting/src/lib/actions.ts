"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { EventType } from "@/lib/constants";
import { parseMMSS } from "@/lib/format";
import { generateRoastAdvice, type RoastPlan } from "@/lib/roastAdvisor";
import { extractSupplierInfo } from "@/lib/supplierExtractor";

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
      moisturePercent: num(formData, "moisturePercent"),
      densityGramsPerLiter: num(formData, "densityGramsPerLiter"),
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
      moisturePercent: num(formData, "moisturePercent"),
      densityGramsPerLiter: num(formData, "densityGramsPerLiter"),
      notes: str(formData, "notes"),
    },
  });

  revalidatePath("/beans");
  revalidatePath("/");
}

/** LowStockBanner's per-bean "×" — see the Bean.lowStockDismissed schema comment for why this is one flag, not one per warning reason. */
export async function dismissLowStock(beanId: string) {
  await prisma.bean.update({ where: { id: beanId }, data: { lowStockDismissed: true } });
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
        // A genuine restock is the one unambiguous signal that an earlier
        // "yes, I know it's low" dismissal (LowStockBanner) no longer
        // applies — only on "add" though, not "remove" (spoilage/loss
        // isn't the roaster acknowledging anything new).
        ...(direction === "add" ? { lowStockDismissed: false } : {}),
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

/**
 * Picked during setup so the live view can overlay a chosen roast's curve
 * against this one's progress in real time (see RoastComparisonChart's
 * live variant) — deliberately separate from tips.ts's automatic golden/
 * last-roast reference, which only ever drives text tips.
 */
export async function setCompareRoast(roastSessionId: string, compareToId: string | null) {
  if (compareToId === roastSessionId) {
    throw new Error("A roast can't compare against itself.");
  }
  if (compareToId) {
    const target = await prisma.roastSession.findUniqueOrThrow({ where: { id: compareToId } });
    if (!target.endedAt) {
      throw new Error("Only a completed roast can be picked as a comparison.");
    }
  }

  await prisma.roastSession.update({ where: { id: roastSessionId }, data: { compareToId } });
  revalidatePath(`/roasts/${roastSessionId}`);
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
 *
 * If an AI/profile plan was accepted for this session, its *later* dial
 * changes (atSeconds > 0) get pre-filled as real events too — an editable
 * starting point the roaster adjusts as the actual roast diverges from plan,
 * not a claim that these already happened. The atSeconds: 0 entry is never
 * taken from the plan: it's always whatever fan/heat the roaster actually
 * dialed in at this exact moment, which is what makes the drift comparison
 * elsewhere (computeAdjustedPlan) meaningful in the first place.
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

    if (session.aiSuggestionAcceptedAt && session.aiSuggestionPlan) {
      let plan: RoastPlan | null = null;
      try {
        plan = JSON.parse(session.aiSuggestionPlan) as RoastPlan;
      } catch {
        plan = null; // malformed plan JSON shouldn't block starting the roast
      }
      const laterChanges = plan?.settingChanges.filter((c) => c.atSeconds > 0) ?? [];
      const prefilled = laterChanges.flatMap((c) => [
        c.fanLevel != null ? { roastSessionId, type: "FAN" as const, atSeconds: c.atSeconds, fanLevel: c.fanLevel } : null,
        c.heatLevel != null ? { roastSessionId, type: "HEAT" as const, atSeconds: c.atSeconds, heatLevel: c.heatLevel } : null,
      ]).filter((e): e is NonNullable<typeof e> => e != null);
      if (prefilled.length > 0) {
        await tx.roastEvent.createMany({ data: prefilled });
      }
    }
  });

  revalidatePath(`/roasts/${roastSessionId}`);
  revalidatePath("/roasts");
  revalidatePath("/");
}

/**
 * Generates and persists an AI roast suggestion (src/lib/roastAdvisor.ts)
 * for a pending roast — factors in the bean's own attributes plus its past
 * roasts and their cupping scores, so asking for e.g. "more acidity" reasons
 * from what was actually tried before, not generic advice. Persisted on the
 * session (not thrown away after use) so the next roast of this bean has
 * this one's inputs and result to build on too.
 */
// Global (not per-user — see AiSuggestionCall's schema comment) daily cap on
// Anthropic API calls from this feature. Defense in depth alongside the
// spend limit set directly in the Anthropic Console, not a replacement for
// it — this bounds app-level abuse (e.g. a compromised session looping the
// action); the Console limit bounds everything else.
const AI_SUGGESTION_DAILY_LIMIT = 20;

// Same defense-in-depth reasoning as AI_SUGGESTION_DAILY_LIMIT, its own
// table/constant since supplier extraction is a separate, lighter-weight
// feature with its own rate budget.
const SUPPLIER_EXTRACTION_DAILY_LIMIT = 20;

export async function fetchSupplierInfo(beanId: string) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentCalls = await prisma.supplierExtractionCall.count({ where: { calledAt: { gte: since } } });
  if (recentCalls >= SUPPLIER_EXTRACTION_DAILY_LIMIT) {
    throw new Error(
      `Hit today's limit of ${SUPPLIER_EXTRACTION_DAILY_LIMIT} supplier lookups across the app — try again tomorrow.`
    );
  }
  await prisma.supplierExtractionCall.create({ data: {} });

  const bean = await prisma.bean.findUniqueOrThrow({ where: { id: beanId } });
  if (!bean.supplierUrl) {
    throw new Error("This bean has no seller link set.");
  }

  const info = await extractSupplierInfo(bean.supplierUrl, bean.name);
  await prisma.bean.update({
    where: { id: beanId },
    data: {
      tastingNotes: info.tastingNotes,
      qGrade: info.qGrade,
      tastingNotesFetchedAt: new Date(),
    },
  });
  revalidatePath(`/beans/${beanId}`);
}

/**
 * Hand-editing/clearing tasting notes — the fallback this feature always
 * needs since fetchSupplierInfo can fail or come back empty. Clears
 * tastingNotesFetchedAt: once a human has rewritten or erased the text,
 * the "fetched from supplier, unverified" provenance caption no longer
 * describes what's actually stored.
 */
export async function updateBeanTastingNotes(beanId: string, tastingNotes: string) {
  await prisma.bean.update({
    where: { id: beanId },
    data: { tastingNotes: tastingNotes || null, tastingNotesFetchedAt: null },
  });
  revalidatePath(`/beans/${beanId}`);
}

export async function updateBeanQGrade(beanId: string, qGrade: number | null) {
  await prisma.bean.update({
    where: { id: beanId },
    data: { qGrade },
  });
  revalidatePath(`/beans/${beanId}`);
}

export async function generateRoastSuggestion(
  roastSessionId: string,
  ambientTempF: number,
  roastGoal: string,
  brewTarget: string | null
) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentCalls = await prisma.aiSuggestionCall.count({ where: { calledAt: { gte: since } } });
  if (recentCalls >= AI_SUGGESTION_DAILY_LIMIT) {
    throw new Error(
      `Hit today's limit of ${AI_SUGGESTION_DAILY_LIMIT} AI suggestions across the app — try again tomorrow.`
    );
  }
  await prisma.aiSuggestionCall.create({ data: {} });

  const session = await prisma.roastSession.findUniqueOrThrow({
    where: { id: roastSessionId },
    include: { bean: true },
  });

  const history = await prisma.roastSession.findMany({
    where: { beanId: session.beanId, endedAt: { not: null } },
    include: { events: true, cuppingNotes: true },
    orderBy: { startedAt: "desc" },
    take: 5,
  });

  // Machine-calibration data (src/lib/roastAdvisor.ts): every completed
  // roast of ANY bean, but trimmed to just the handful of fields actually
  // used — the charge-time FAN/HEAT events, the two milestone events, and
  // one probe reading — rather than every event and every probe reading
  // (which alone can be 80-100+ rows per roast) across 40+ roasts.
  const calibration = await prisma.roastSession.findMany({
    where: { endedAt: { not: null } },
    select: {
      id: true,
      startedAt: true,
      endedAt: true,
      ambientTempF: true,
      roastedWeightGrams: true,
      greenWeightGrams: true,
      aiSuggestionFeedback: true,
      bean: { select: { process: true } },
      events: {
        where: {
          OR: [
            { type: "FAN", atSeconds: 0 },
            { type: "HEAT", atSeconds: 0 },
            { type: "DRY_END" },
            { type: "FIRST_CRACK_START" },
          ],
        },
        select: { type: true, atSeconds: true, fanLevel: true, heatLevel: true },
      },
      temperatureReadings: {
        orderBy: { atSeconds: "desc" },
        take: 1,
        select: { tempFahrenheit: true },
      },
    },
    orderBy: { startedAt: "desc" },
  });

  // Fallback drop-temp source for roasts with no probe reading at all —
  // one lightweight query for the last hand-logged TEMP event per roast
  // (via `distinct`), instead of fetching every TEMP event per roast just
  // to find the last one.
  const needsHandLoggedTemp = calibration
    .filter((r) => r.temperatureReadings.length === 0)
    .map((r) => r.id);
  const lastTempEvents =
    needsHandLoggedTemp.length > 0
      ? await prisma.roastEvent.findMany({
          where: { roastSessionId: { in: needsHandLoggedTemp }, type: "TEMP" },
          orderBy: [{ roastSessionId: "asc" }, { atSeconds: "desc" }],
          distinct: ["roastSessionId"],
          select: { roastSessionId: true, tempFahrenheit: true },
        })
      : [];
  const calibrationLastTemp = new Map(
    lastTempEvents
      .filter((e) => e.tempFahrenheit != null)
      .map((e) => [e.roastSessionId, e.tempFahrenheit as number])
  );

  const advice = await generateRoastAdvice(
    session.bean,
    history,
    calibration,
    calibrationLastTemp,
    ambientTempF,
    roastGoal,
    brewTarget
  );

  await prisma.roastSession.update({
    where: { id: roastSessionId },
    data: {
      ambientTempF,
      roastGoal,
      brewTarget,
      suggestedFanLevel: advice.suggestedFanLevel,
      suggestedHeatLevel: advice.suggestedHeatLevel,
      aiSuggestionSummary: advice.summary,
      aiSuggestionPlan: JSON.stringify(advice.plan),
      aiSuggestionAcceptedAt: null,
      aiSuggestionNotes: advice.rationale,
      // A fresh AI suggestion replaces whatever this session's plan used to
      // be — if it came from an applied profile, that provenance is no
      // longer accurate once it's been overwritten here.
      profileId: null,
    },
  });

  revalidatePath(`/roasts/${roastSessionId}`);
}

/**
 * Marks the current AI suggestion as accepted — a plain DB write, no LLM
 * call — which is what makes its target milestones/drop temp actually
 * render as dashed reference lines on the live chart (src/lib/curve.ts).
 * A suggestion the roaster never acted on shouldn't clutter the chart, so
 * generateRoastSuggestion resets this to null on every regeneration.
 */
export async function acceptRoastSuggestion(roastSessionId: string) {
  await prisma.roastSession.update({
    where: { id: roastSessionId },
    data: { aiSuggestionAcceptedAt: new Date() },
  });
  revalidatePath(`/roasts/${roastSessionId}`);
}

/**
 * Records a correction on a past AI suggestion (e.g. "fan 8/heat 8 roasted
 * way faster than predicted") — plain DB write, no LLM call, so recording
 * feedback is free. Read back into every future generateRoastSuggestion
 * call for ANY bean via the calibration query, since a dial-timing
 * correction is a fact about the machine, not the one bean it happened on.
 */
export async function recordSuggestionFeedback(roastSessionId: string, feedback: string) {
  await prisma.roastSession.update({
    where: { id: roastSessionId },
    data: { aiSuggestionFeedback: feedback },
  });
  revalidatePath(`/roasts/${roastSessionId}`);
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

export async function deleteRoastSession(id: string) {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.roastSession.findUniqueOrThrow({ where: { id } });
    await tx.bean.update({
      where: { id: existing.beanId },
      data: { remainingGrams: { increment: existing.greenWeightGrams } },
    });
    await tx.roastSession.delete({ where: { id } });
  });

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
 * Folds one friend's history into another (e.g. "Jake" typed once as
 * "Jake S." elsewhere) — reassigns every Sale/DropClaim from source to
 * target, then deletes source. Target keeps its own id/notes; nothing
 * about the target friend changes except now owning source's history too.
 */
export async function mergeFriend(sourceId: string, formData: FormData) {
  const targetId = str(formData, "targetId");
  if (!targetId) {
    throw new Error("Pick who to merge into.");
  }
  if (sourceId === targetId) {
    throw new Error("Can't merge a friend into themselves.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.sale.updateMany({ where: { friendId: sourceId }, data: { friendId: targetId } });
    await tx.dropClaim.updateMany({ where: { friendId: sourceId }, data: { friendId: targetId } });
    await tx.friend.delete({ where: { id: sourceId } });
  });

  revalidatePath("/friends");
  revalidatePath(`/friends/${targetId}`);
  redirect(`/friends/${targetId}`);
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
