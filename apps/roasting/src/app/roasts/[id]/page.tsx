import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { Download } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { deleteRoastSession } from "@/lib/actions";
import { getCurrentAllowedUser } from "@/lib/admin";
import BrewCard from "@/components/brews/BrewCard";
import { formatMMSS } from "@/lib/format";
import { computeRoastPhases } from "@/lib/phases";
import { computeHistoricalBaseline, type ReferenceRoast } from "@/lib/tips";
import { getCurveReadings } from "@/lib/curve";
import type { EventType } from "@/lib/constants";
import { MILESTONE_EVENT_TYPES } from "@/lib/constants";
import LiveTimerBar from "@/components/roasts/LiveTimerBar";
import LiveProbePanel from "@/components/roasts/LiveProbePanel";
import RoastSetupPanel from "@/components/roasts/RoastSetupPanel";
import RoastPlanCard from "@/components/roasts/RoastPlanCard";
import EventLogPanel from "@/components/roasts/EventLogPanel";
import EventTimeline from "@/components/roasts/EventTimeline";
import DropRoastButton from "@/components/roasts/DropRoastButton";
import RoastDetailsForm from "@/components/roasts/RoastDetailsForm";
import PublishControl from "@/components/roasts/PublishControl";
import GoldenRoastToggle from "@/components/roasts/GoldenRoastToggle";
import RoastCurveChart from "@/components/roasts/RoastCurveChart";
import PhaseBar from "@/components/roasts/PhaseBar";
import LiveTipsPanel from "@/components/roasts/LiveTipsPanel";
import SalesPanel from "@/components/roasts/SalesPanel";
import AddEventForm from "@/components/roasts/AddEventForm";
import CuppingTab from "@/components/roasts/CuppingTab";
import CompareTab from "@/components/roasts/CompareTab";
import DeleteButton from "@/components/DeleteButton";
import BeanBurst from "@/components/ui/BeanBurst";
import RatingBeans from "@/components/ui/RatingBeans";
import type { ReactNode } from "react";

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border-2 border-[var(--border-strong)] bg-surface shadow-[2px_2px_0_var(--shadow-ink)] p-3">
      <p className="font-mono text-lg font-semibold">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}

export default async function RoastSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; vs?: string }>;
}) {
  const { id } = await params;
  const { tab, vs } = await searchParams;
  const activeTab = tab === "cupping" ? "cupping" : tab === "compare" ? "compare" : "roast";
  const user = await getCurrentAllowedUser();
  if (!user) notFound();

  const [session, friends] = await Promise.all([
    prisma.roastSession.findUnique({
      where: { id },
      include: {
        bean: true,
        events: { orderBy: { atSeconds: "asc" } },
        sales: { orderBy: { soldAt: "desc" }, include: { friend: true } },
        cuppingNotes: { orderBy: { cuppedAt: "desc" } },
        temperatureReadings: { orderBy: { atSeconds: "asc" } },
        brews: {
          where: { userId: user.id },
          orderBy: { brewedAt: "desc" },
          include: { roastSession: { include: { bean: true } } },
        },
      },
    }),
    prisma.friend.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!session) notFound();

  const isPending = session.startedAt == null && session.endedAt == null;
  const isLive = session.startedAt != null && session.endedAt == null;
  const isCompleted = session.endedAt != null;
  // Gated server-side on "ended a few seconds ago," not a client flag passed
  // from DropRoastButton — simpler, and it doesn't care whether the roast
  // was just dropped live or the page was refreshed right after. A fresh
  // request-time check like this in a Server Component isn't the kind of
  // impurity the purity rule is guarding against (nothing here is memoized
  // across renders the way a Client Component would be).
  // eslint-disable-next-line react-hooks/purity -- request-time freshness check, not memoized
  const justCompleted = isCompleted && Date.now() - session.endedAt!.getTime() < 8000;
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
  let referenceRoast: ReferenceRoast | null = null;
  if (isLive) {
    const sameBeanCompleted = await prisma.roastSession.findMany({
      where: { beanId: session.beanId, endedAt: { not: null }, id: { not: session.id } },
      include: { events: true },
    });
    let baselineSessions = sameBeanCompleted;
    if (baselineSessions.length === 0) {
      baselineSessions = await prisma.roastSession.findMany({
        where: { endedAt: { not: null } },
        include: { events: true },
        take: 50,
      });
    }
    baseline = computeHistoricalBaseline(baselineSessions);

    // The reference roast to compare live progress against never falls back
    // across beans (unlike the averages above) — a different bean's curve
    // isn't a meaningful target. Prefers the bean's explicitly-marked golden
    // roast; falls back to its own most recent completed roast.
    let refSession = session.bean.goldenRoastId
      ? sameBeanCompleted.find((s) => s.id === session.bean.goldenRoastId)
      : undefined;
    let label = "Golden roast";
    if (!refSession) {
      refSession = [...sameBeanCompleted].sort((a, b) => b.startedAt!.getTime() - a.startedAt!.getTime())[0];
      label = "Last roast";
    }
    if (refSession) {
      const readings = getCurveReadings(refSession.events);
      if (readings.length > 0) referenceRoast = { label, readings };
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="relative flex items-start justify-between gap-4">
        {justCompleted && <BeanBurst />}
        <div>
          <h1 className="text-4xl font-black tracking-tight">{session.bean.name}</h1>
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
              <GoldenRoastToggle
                beanId={session.beanId}
                roastSessionId={session.id}
                isGolden={session.bean.goldenRoastId === session.id}
              />
              <PublishControl roastSessionId={session.id} publishedAt={session.publishedAt} />
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

      {isPending && (
        <>
          <LiveProbePanel roastSessionId={session.id} />
          <RoastSetupPanel roastSessionId={session.id} />
          <RoastPlanCard roastSessionId={session.id} notes={session.notes} />
        </>
      )}

      {isLive && (
        <>
          <LiveTimerBar startedAt={session.startedAt!.toISOString()} beanName={session.bean.name} />
          <LiveProbePanel roastSessionId={session.id} />
          <RoastPlanCard roastSessionId={session.id} notes={session.notes} />
          {baseline && (
            <LiveTipsPanel
              startedAt={session.startedAt!.toISOString()}
              events={session.events}
              baseline={baseline}
              referenceRoast={referenceRoast}
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
        <div className="flex gap-4 border-b border-border text-sm font-medium">
          <a
            href={`/roasts/${session.id}`}
            className={`-mb-px border-b-2 px-1 pb-2 transition ${
              activeTab === "roast"
                ? "border-accent text-foreground"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            Roast
          </a>
          <a
            href={`/roasts/${session.id}?tab=cupping`}
            className={`-mb-px border-b-2 px-1 pb-2 transition ${
              activeTab === "cupping"
                ? "border-accent text-foreground"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            Cupping{session.cuppingNotes.length > 0 ? ` (${session.cuppingNotes.length})` : ""}
          </a>
          <a
            href={`/roasts/${session.id}?tab=compare`}
            className={`-mb-px border-b-2 px-1 pb-2 transition ${
              activeTab === "compare"
                ? "border-accent text-foreground"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            Compare
          </a>
        </div>
      )}

      {isCompleted && activeTab === "cupping" && (
        <CuppingTab roastSessionId={session.id} cuppingNotes={session.cuppingNotes} />
      )}

      {isCompleted && activeTab === "compare" && <CompareTab currentSession={session} selectedId={vs ?? null} />}

      {isCompleted && activeTab === "roast" && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Stat label="Duration" value={formatMMSS(durationSeconds ?? 0)} />
            <Stat label="Roast level" value={session.roastLevel ?? "—"} />
            <Stat label="Weight loss" value={weightLoss != null ? `${weightLoss.toFixed(1)}%` : "—"} />
            <Stat
              label="Rating"
              value={session.rating != null ? <RatingBeans rating={session.rating} /> : "—"}
            />
            <Stat
              label="Roasted on hand"
              value={
                session.roastedRemainingGrams != null
                  ? `${Math.round(session.roastedRemainingGrams * 10) / 10}g`
                  : "—"
              }
            />
          </div>
          <RoastDetailsForm session={session} />
          <RoastCurveChart
            events={session.events}
            totalSeconds={durationSeconds ?? 0}
            probeReadings={session.temperatureReadings}
          />
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
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-medium">Your brews</h2>
              <Link href={`/brews?roastSessionId=${session.id}`} className="text-sm text-muted hover:text-foreground">
                Log a brew from this roast →
              </Link>
            </div>
            {session.brews.length === 0 ? (
              <p className="text-sm text-muted">You haven&apos;t brewed this roast yet.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {session.brews.map((brew) => (
                  <BrewCard key={brew.id} brew={brew} />
                ))}
              </div>
            )}
          </div>
          <div className="rounded-xl border-2 border-[var(--border-strong)] bg-surface shadow-[2px_2px_0_var(--shadow-ink)] p-4">
            <p className="mb-3 text-xs font-medium tracking-wide text-muted uppercase">Add event</p>
            <AddEventForm roastSessionId={session.id} />
          </div>
          <EventTimeline events={session.events} editable />
        </>
      )}
    </div>
  );
}
