import { notFound } from "next/navigation";
import { format } from "date-fns";
import { Download, Globe } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { deleteRoastSession, publishRoast, unpublishRoast } from "@/lib/actions";
import { roastPageUrl } from "@/lib/publish";
import { formatMMSS } from "@/lib/format";
import { computeRoastPhases } from "@/lib/phases";
import { computeHistoricalBaseline } from "@/lib/tips";
import type { EventType } from "@/lib/constants";
import { MILESTONE_EVENT_TYPES } from "@/lib/constants";
import Timer from "@/components/roasts/Timer";
import RoastSetupPanel from "@/components/roasts/RoastSetupPanel";
import EventLogPanel from "@/components/roasts/EventLogPanel";
import EventTimeline from "@/components/roasts/EventTimeline";
import DropRoastButton from "@/components/roasts/DropRoastButton";
import RoastDetailsForm from "@/components/roasts/RoastDetailsForm";
import RoastCurveChart from "@/components/roasts/RoastCurveChart";
import PhaseBar from "@/components/roasts/PhaseBar";
import LiveTipsPanel from "@/components/roasts/LiveTipsPanel";
import SalesPanel from "@/components/roasts/SalesPanel";
import AddEventForm from "@/components/roasts/AddEventForm";
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

  const isPending = session.startedAt == null && session.endedAt == null;
  const isLive = session.startedAt != null && session.endedAt == null;
  const isCompleted = session.endedAt != null;
  const durationSeconds =
    isCompleted && session.startedAt
      ? (session.endedAt!.getTime() - session.startedAt.getTime()) / 1000
      : null;

  const latestFan = [...session.events].reverse().find((e) => e.type === "FAN");
  const latestHeat = [...session.events].reverse().find((e) => e.type === "HEAT");
  const loggedMilestoneTypes = Array.from(new Set(session.events.map((e) => e.type))).filter(
    (t): t is EventType => (MILESTONE_EVENT_TYPES as string[]).includes(t)
  );

  const weightLoss =
    session.roastedWeightGrams != null
      ? (1 - session.roastedWeightGrams / session.greenWeightGrams) * 100
      : null;

  const phases = computeRoastPhases(session.events, durationSeconds ?? 0);

  let baseline = null;
  if (isLive) {
    let baselineSessions = await prisma.roastSession.findMany({
      where: { beanId: session.beanId, endedAt: { not: null }, id: { not: session.id } },
      include: { events: true },
    });
    if (baselineSessions.length === 0) {
      baselineSessions = await prisma.roastSession.findMany({
        where: { endedAt: { not: null } },
        include: { events: true },
        take: 50,
      });
    }
    baseline = computeHistoricalBaseline(baselineSessions);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{session.bean.name}</h1>
          <p className="text-sm text-muted">
            {session.startedAt
              ? format(session.startedAt, "MMM d, yyyy 'at' h:mm a")
              : "Not started yet"}{" "}
            · {session.greenWeightGrams}g green
          </p>
        </div>
        <div className="flex items-center gap-4">
          {isCompleted && (
            <>
              <a
                href={`/roasts/${session.id}/export`}
                className="flex items-center gap-1.5 text-xs font-medium text-muted transition hover:text-foreground"
              >
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </a>
              {session.publishedAt ? (
                <div className="flex items-center gap-2 text-xs">
                  <a
                    href={roastPageUrl(session.id)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 font-medium text-accent hover:opacity-80"
                  >
                    <Globe className="h-3.5 w-3.5" />
                    Published
                  </a>
                  <form action={unpublishRoast.bind(null, session.id)}>
                    <button type="submit" className="text-muted transition hover:text-foreground">
                      Unpublish
                    </button>
                  </form>
                </div>
              ) : (
                <form action={publishRoast.bind(null, session.id)}>
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 text-xs font-medium text-muted transition hover:text-foreground"
                  >
                    <Globe className="h-3.5 w-3.5" />
                    Publish
                  </button>
                </form>
              )}
            </>
          )}
          <DeleteButton
            action={deleteRoastSession.bind(null, session.id)}
            confirmText={
              isPending
                ? "Cancel this roast setup? Green weight will be returned to bean inventory."
                : isLive
                  ? "Abandon this roast? Green weight will be returned to bean inventory."
                  : "Delete this roast? Green weight will be returned to bean inventory."
            }
            label={isCompleted ? "Delete" : isPending ? "Cancel" : "Abandon"}
          />
        </div>
      </div>

      {isPending && <RoastSetupPanel roastSessionId={session.id} />}

      {isLive && (
        <>
          <Timer startedAt={session.startedAt!.toISOString()} />
          {baseline && (
            <LiveTipsPanel
              startedAt={session.startedAt!.toISOString()}
              events={session.events}
              baseline={baseline}
            />
          )}
          <EventLogPanel
            roastSessionId={session.id}
            startedAt={session.startedAt!.toISOString()}
            initialFanLevel={latestFan?.fanLevel ?? 5}
            initialHeatLevel={latestHeat?.heatLevel ?? 5}
            loggedMilestoneTypes={loggedMilestoneTypes}
          />
          <EventTimeline events={session.events} editable />
          <DropRoastButton roastSessionId={session.id} />
        </>
      )}

      {isCompleted && (
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
          <RoastDetailsForm session={session} />
          <RoastCurveChart events={session.events} totalSeconds={durationSeconds ?? 0} />
          <PhaseBar phases={phases} />
          {session.notes && <p className="text-sm text-foreground/80">{session.notes}</p>}
          {session.roastedWeightGrams != null && (
            <SalesPanel
              roastSessionId={session.id}
              roastedRemainingGrams={session.roastedRemainingGrams ?? 0}
              sales={session.sales}
              friends={friends}
            />
          )}
          <div className="rounded-lg border border-border bg-surface p-4">
            <p className="mb-3 text-xs font-medium tracking-wide text-muted uppercase">Add event</p>
            <AddEventForm roastSessionId={session.id} />
          </div>
          <EventTimeline events={session.events} editable />
        </>
      )}
    </div>
  );
}
