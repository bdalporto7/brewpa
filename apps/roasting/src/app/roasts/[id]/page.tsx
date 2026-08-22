import { notFound } from "next/navigation";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { deleteRoastSession } from "@/lib/actions";
import { formatMMSS } from "@/lib/format";
import type { EventType } from "@/lib/constants";
import { CRACK_EVENT_TYPES } from "@/lib/constants";
import Timer from "@/components/roasts/Timer";
import EventLogPanel from "@/components/roasts/EventLogPanel";
import EventTimeline from "@/components/roasts/EventTimeline";
import EndRoastForm from "@/components/roasts/EndRoastForm";
import RoastCurveChart from "@/components/roasts/RoastCurveChart";
import SalesPanel from "@/components/roasts/SalesPanel";
import DeleteButton from "@/components/DeleteButton";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <p className="font-mono text-lg font-semibold">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}

export default async function RoastSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [session, friends] = await Promise.all([
    prisma.roastSession.findUnique({
      where: { id },
      include: {
        bean: true,
        events: { orderBy: { atSeconds: "asc" } },
        sales: { orderBy: { soldAt: "desc" }, include: { friend: true } },
      },
    }),
    prisma.friend.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!session) notFound();

  const isLive = session.endedAt == null;
  const durationSeconds = isLive
    ? null
    : (session.endedAt!.getTime() - session.startedAt.getTime()) / 1000;

  const latestFan = [...session.events].reverse().find((e) => e.type === "FAN");
  const latestHeat = [...session.events].reverse().find((e) => e.type === "HEAT");
  const loggedCrackTypes = Array.from(new Set(session.events.map((e) => e.type))).filter(
    (t): t is EventType => (CRACK_EVENT_TYPES as string[]).includes(t)
  );

  const weightLoss =
    session.roastedWeightGrams != null
      ? (1 - session.roastedWeightGrams / session.greenWeightGrams) * 100
      : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{session.bean.name}</h1>
          <p className="text-sm text-muted">
            {format(session.startedAt, "MMM d, yyyy 'at' h:mm a")} · {session.greenWeightGrams}g green
          </p>
        </div>
        <DeleteButton
          action={deleteRoastSession.bind(null, session.id)}
          confirmText={
            isLive
              ? "Abandon this roast? Green weight will be returned to bean inventory."
              : "Delete this roast? Green weight will be returned to bean inventory."
          }
          label={isLive ? "Abandon" : "Delete"}
        />
      </div>

      {isLive ? (
        <>
          <Timer startedAt={session.startedAt.toISOString()} />
          <EventLogPanel
            roastSessionId={session.id}
            startedAt={session.startedAt.toISOString()}
            initialFanLevel={latestFan?.fanLevel ?? 5}
            initialHeatLevel={latestHeat?.heatLevel ?? 5}
            loggedCrackTypes={loggedCrackTypes}
          />
          <EventTimeline events={session.events} editable />
          <EndRoastForm roastSessionId={session.id} />
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Stat label="Duration" value={formatMMSS(durationSeconds ?? 0)} />
            <Stat label="Roast level" value={session.roastLevel ?? "—"} />
            <Stat label="Weight loss" value={weightLoss != null ? `${weightLoss.toFixed(1)}%` : "—"} />
            <Stat label="Rating" value={session.rating != null ? "★".repeat(session.rating) : "—"} />
            <Stat
              label="Roasted on hand"
              value={session.roastedRemainingGrams != null ? `${session.roastedRemainingGrams}g` : "—"}
            />
          </div>
          <RoastCurveChart events={session.events} totalSeconds={durationSeconds ?? 0} />
          {session.notes && <p className="text-sm text-foreground/80">{session.notes}</p>}
          {session.roastedWeightGrams != null && (
            <SalesPanel
              roastSessionId={session.id}
              roastedRemainingGrams={session.roastedRemainingGrams ?? 0}
              sales={session.sales}
              friends={friends}
            />
          )}
          <EventTimeline events={session.events} />
        </>
      )}
    </div>
  );
}
