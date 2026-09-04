import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { Download, PlusCircle, History } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { deleteRoastSession } from "@/lib/actions";
import { getCurrentAllowedUser } from "@/lib/admin";
import BrewCard from "@/components/brews/BrewCard";
import { formatMMSS } from "@/lib/format";
import { computeRoastPhases } from "@/lib/phases";
import { computeHistoricalBaseline, computeMilestoneTempBaseline, projectNextMilestone, type ReferenceRoast } from "@/lib/tips";
import { getCurveReadings, computeAdjustedPlan, type PlanSettingChange, type PlanTargets } from "@/lib/curve";
import { saveProfileFromCompletedRoast } from "@/lib/profile-actions";
import type { EventType } from "@/lib/constants";
import { MILESTONE_EVENT_TYPES } from "@/lib/constants";
import LiveRoastBars from "@/components/roasts/LiveRoastBars";
import LiveRoastPoller from "@/components/roasts/LiveRoastPoller";
import LiveProbePanel from "@/components/roasts/LiveProbePanel";
import RoastSetupPanel from "@/components/roasts/RoastSetupPanel";
import AiSuggestionPanel from "@/components/roasts/AiSuggestionPanel";
import RoastProfilePicker from "@/components/roasts/RoastProfilePicker";
import SaveProfileForm from "@/components/roasts/SaveProfileForm";
import RoastPlanCard from "@/components/roasts/RoastPlanCard";
import EventLogPanel from "@/components/roasts/EventLogPanel";
import EventTimeline from "@/components/roasts/EventTimeline";
import RoastDetailsForm from "@/components/roasts/RoastDetailsForm";
import AiFeedbackForm from "@/components/roasts/AiFeedbackForm";
import GoldenRoastToggle from "@/components/roasts/GoldenRoastToggle";
import RoastCurveChart from "@/components/roasts/RoastCurveChart";
import PhaseBar from "@/components/roasts/PhaseBar";
import LiveTipsPanel from "@/components/roasts/LiveTipsPanel";
import SalesPanel from "@/components/roasts/SalesPanel";
import AddEventForm from "@/components/roasts/AddEventForm";
import CuppingTab from "@/components/roasts/CuppingTab";
import CompareTab from "@/components/roasts/CompareTab";
import CompareRoastSelector from "@/components/roasts/CompareRoastSelector";
import LiveComparisonChart from "@/components/roasts/LiveComparisonChart";
import DeleteButton from "@/components/DeleteButton";
import BeanBurst from "@/components/ui/BeanBurst";
import RatingBeans from "@/components/ui/RatingBeans";
import SectionCard from "@/components/ui/SectionCard";
import { BrewedCupIcon, RoastedBeanIcon } from "@/components/ui/CoffeeIcons";
import { estimateRoastLevel } from "@/lib/roastLevelColor";
import { roastMargin } from "@/lib/economics";
import Stat from "@/components/ui/Stat";

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

  const [session, friends, compareCandidates, profiles] = await Promise.all([
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
        compareTo: { include: { bean: true, events: true, temperatureReadings: true } },
        profile: true,
      },
    }),
    prisma.friend.findMany({ orderBy: { name: "asc" } }),
    // Only actually used while pending (the picker), but cheap enough (id/bean/date/level
    // only) to just fetch alongside everything else rather than branching the query shape.
    prisma.roastSession.findMany({
      where: { endedAt: { not: null }, id: { not: id } },
      include: { bean: true },
      orderBy: { startedAt: "desc" },
    }),
    // Same treatment — only used by RoastProfilePicker while pending, cheap enough to just always fetch.
    prisma.roastProfile.findMany({
      orderBy: [{ isFavorite: "desc" }, { name: "asc" }],
      select: { id: true, name: true, process: true, brewTarget: true },
    }),
  ]);

  if (!session) notFound();

  const isPending = session.startedAt == null && session.endedAt == null;
  const isLive = session.startedAt != null && session.endedAt == null;
  const isCompleted = session.endedAt != null;
  // Gated server-side on "ended a few seconds ago," not a client flag passed
  // from wherever Drop was tapped — simpler, and it doesn't care whether the
  // roast was just dropped live or the page was refreshed right after. A fresh
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
  const liveElapsedSeconds = Math.max(
    1,
    ...session.events.map((e) => e.atSeconds),
    ...session.temperatureReadings.map((r) => r.atSeconds ?? 0)
  );
  // Only once the roaster has explicitly accepted a suggestion (or applied
  // a profile, which auto-accepts) — a generated-but-unused plan shouldn't
  // clutter the live chart with reference lines nobody asked to follow.
  // computeAdjustedPlan recomputes fresh from the stored plan + actual
  // events on every render, so the overlay stays live-rebased as dial
  // changes land (see curve.ts for the timing-drift/divergence logic).
  const acceptedPlan =
    session.aiSuggestionAcceptedAt && session.aiSuggestionPlan
      ? (JSON.parse(session.aiSuggestionPlan) as { settingChanges: PlanSettingChange[]; targets: PlanTargets })
      : undefined;
  const adjustedPlan = acceptedPlan ? computeAdjustedPlan(acceptedPlan, session.events) : undefined;
  const acceptedPlanTargets = adjustedPlan?.targets;
  const planDivergedAtSeconds = adjustedPlan?.diverged ? adjustedPlan.divergedAtSeconds : undefined;

  const weightLoss =
    session.roastedWeightGrams != null
      ? (1 - session.roastedWeightGrams / session.greenWeightGrams) * 100
      : null;
  const estimatedRoast = weightLoss != null ? estimateRoastLevel(weightLoss) : null;
  const margin = roastMargin(session, session.bean, session.sales);

  const phases = computeRoastPhases(session.events, durationSeconds ?? 0);

  let baseline = null;
  let milestoneTempBaseline = null;
  let referenceRoast: ReferenceRoast | null = null;
  let projectedTargets = acceptedPlanTargets;
  if (isLive) {
    const sameBeanCompleted = await prisma.roastSession.findMany({
      where: { beanId: session.beanId, endedAt: { not: null }, id: { not: session.id } },
      include: { events: true, temperatureReadings: true },
    });
    let baselineSessions = sameBeanCompleted;
    if (baselineSessions.length === 0) {
      baselineSessions = await prisma.roastSession.findMany({
        where: { endedAt: { not: null } },
        include: { events: true, temperatureReadings: true },
        take: 50,
      });
    }
    baseline = computeHistoricalBaseline(baselineSessions);
    milestoneTempBaseline = computeMilestoneTempBaseline(baselineSessions);

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
      const readings = getCurveReadings(refSession.events, refSession.temperatureReadings);
      if (readings.length > 0) referenceRoast = { label, readings };
    }

    // Live RoR-based re-projection of the next unreached milestone — see
    // src/lib/tips.ts's projectNextMilestone for why this extrapolates
    // directly-measured RoR rather than a fan/heat causal model. Only
    // overrides the one field it projects; every other target (already-
    // reached milestones, developmentSeconds, dropTempF) is untouched.
    const projection = acceptedPlan
      ? projectNextMilestone({
          events: session.events,
          curveReadings: getCurveReadings(session.events, session.temperatureReadings),
          elapsedSeconds: liveElapsedSeconds,
          milestoneTempBaseline,
          hasYellowingTarget: acceptedPlan.targets.yellowingEndSeconds != null,
        })
      : null;
    if (projection && projectedTargets) {
      projectedTargets = {
        ...projectedTargets,
        ...(projection.milestone === "DRY_END" && { dryEndSeconds: Math.round(projection.projectedAtSeconds) }),
        ...(projection.milestone === "YELLOWING_END" && {
          yellowingEndSeconds: Math.round(projection.projectedAtSeconds),
        }),
        ...(projection.milestone === "FIRST_CRACK_START" && {
          firstCrackSeconds: Math.round(projection.projectedAtSeconds),
        }),
      };
    }
  }

  return (
    <div className={`flex flex-col gap-6 ${isLive ? "pt-24 sm:pt-28" : ""}`}>
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        {justCompleted && <BeanBurst />}
        <div>
          <h1 className="flex items-center gap-2.5 text-4xl font-black tracking-tight">
            {session.bean.name}
            {isCompleted && (
              <GoldenRoastToggle
                beanId={session.beanId}
                roastSessionId={session.id}
                isGolden={session.bean.goldenRoastId === session.id}
              />
            )}
          </h1>
          <p className="text-sm text-muted">
            {session.startedAt
              ? format(session.startedAt, "MMM d, yyyy 'at' h:mm a")
              : "Not started yet"}{" "}
            · {session.greenWeightGrams}g green
          </p>
        </div>
        {/* flex-wrap: three text-labeled actions (Export CSV, Save as
            profile, Delete) next to a real bean name genuinely don't fit
            in one row on a phone — wrapping beats the row silently
            overflowing the page sideways. */}
        <div className="flex flex-wrap items-center gap-4">
          {isCompleted && (
            <>
              <a
                href={`/roasts/${session.id}/export`}
                className="flex items-center gap-1.5 text-xs font-medium text-muted transition hover:text-foreground"
              >
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </a>
              <SaveProfileForm
                action={saveProfileFromCompletedRoast.bind(null, session.id)}
                defaultName={`${session.bean.name}${session.roastLevel ? ` — ${session.roastLevel}` : ""}`}
                defaultProcess={session.bean.process}
                defaultBrewTarget={session.brewTarget}
              />
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
          <AiSuggestionPanel
            roastSessionId={session.id}
            initialAmbientTempF={session.ambientTempF}
            initialRoastGoal={session.roastGoal}
            initialBrewTarget={session.brewTarget}
            suggestedFanLevel={session.suggestedFanLevel}
            suggestedHeatLevel={session.suggestedHeatLevel}
            aiSuggestionSummary={session.aiSuggestionSummary}
            aiSuggestionNotes={session.aiSuggestionNotes}
            aiSuggestionPlan={session.aiSuggestionPlan}
            aiSuggestionAcceptedAt={session.aiSuggestionAcceptedAt}
            aiSuggestionFeedback={session.aiSuggestionFeedback}
            profileName={session.profile?.name ?? null}
          />
          <RoastProfilePicker profiles={profiles} roastSessionId={session.id} beanProcess={session.bean.process} />
          <RoastSetupPanel
            roastSessionId={session.id}
            initialFanLevel={session.suggestedFanLevel ?? undefined}
            initialHeatLevel={session.suggestedHeatLevel ?? undefined}
          />
          <CompareRoastSelector
            roastSessionId={session.id}
            candidates={compareCandidates.map((c) => ({
              id: c.id,
              label: `${c.bean.name} — ${c.startedAt ? format(c.startedAt, "MMM d, yyyy") : "undated"}${c.roastLevel ? ` (${c.roastLevel})` : ""}`,
            }))}
            initialCompareToId={session.compareToId}
          />
          <RoastPlanCard roastSessionId={session.id} notes={session.notes} />
        </>
      )}

      {isLive && (
        <>
          <LiveRoastPoller />
          {/* Two permanent fixed bars (top: timer/hint/drop, bottom:
              fan/heat/temp/milestones) — see LiveRoastBars for why they're
              split. Everything below them is reference material (chart,
              tips, plan) you check periodically, not controls you touch
              every 10-30s, so the chart comes first as the actual focus
              while roasting and the rest follows by how often it's needed. */}
          <LiveRoastBars
            startedAt={session.startedAt!.toISOString()}
            beanName={session.bean.name}
            roastSessionId={session.id}
            initialFanLevel={latestFan?.fanLevel ?? 5}
            initialHeatLevel={latestHeat?.heatLevel ?? 5}
            loggedMilestoneTypes={loggedMilestoneTypes}
            events={session.events}
            baseline={baseline}
            referenceRoast={referenceRoast}
            planDivergedAtSeconds={planDivergedAtSeconds}
            milestoneTempBaseline={milestoneTempBaseline}
            originalPlanTargets={acceptedPlan?.targets}
          />
          {/* Probe readings can arrive on their own, ahead of the latest
              hand-logged event, so the chart's time axis has to account for
              both rather than just the latest RoastEvent. Also require the
              comparison roast to actually have 2+ readings of its own —
              LiveComparisonChart renders nothing at all (not even an empty
              state) when buildLiveComparisonSvg can't build a comparison
              line, which used to silently kill the *entire* chart, live
              curve included, just because whatever past roast was picked
              to compare against had too little hand-logged temp data. */}
          {session.compareTo && getCurveReadings(session.compareTo.events).length >= 2 ? (
            <LiveComparisonChart
              currentEvents={session.events}
              currentLabel={`${session.bean.name} (live)`}
              currentElapsedSeconds={liveElapsedSeconds}
              comparisonEvents={session.compareTo.events}
              comparisonLabel={`${session.compareTo.bean.name} — ${session.compareTo.startedAt ? format(session.compareTo.startedAt, "MMM d, yyyy") : "undated"}`}
              comparisonTotalSeconds={
                session.compareTo.startedAt && session.compareTo.endedAt
                  ? (session.compareTo.endedAt.getTime() - session.compareTo.startedAt.getTime()) / 1000
                  : 0
              }
              currentProbeReadings={session.temperatureReadings}
              comparisonProbeReadings={session.compareTo.temperatureReadings}
            />
          ) : (
            <RoastCurveChart
              events={session.events}
              totalSeconds={liveElapsedSeconds}
              probeReadings={session.temperatureReadings}
              targets={projectedTargets}
            />
          )}
          {baseline && (
            <LiveTipsPanel
              roastSessionId={session.id}
              startedAt={session.startedAt!.toISOString()}
              events={session.events}
              baseline={baseline}
              referenceRoast={referenceRoast}
              planDivergedAtSeconds={planDivergedAtSeconds}
              milestoneTempBaseline={milestoneTempBaseline}
              originalPlanTargets={acceptedPlan?.targets}
            />
          )}
          <EventLogPanel roastSessionId={session.id} startedAt={session.startedAt!.toISOString()} />
          <RoastPlanCard roastSessionId={session.id} notes={session.notes} collapsedByDefault />
          <EventTimeline events={session.events} editable />
          <div className="pb-24 sm:pb-28" />
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
            <Stat
              label="Weight loss"
              value={
                weightLoss != null && estimatedRoast ? (
                  // A fun easter egg, not a real instrument reading — a bean
                  // tinted to roughly the color a roast at this weight loss
                  // would actually look, hover for the estimated level.
                  <span className="inline-flex items-center gap-1.5" title={`Estimated: ${estimatedRoast.level}`}>
                    <RoastedBeanIcon className="h-4 w-4" style={{ color: estimatedRoast.color }} />
                    {weightLoss.toFixed(1)}%
                  </span>
                ) : (
                  "—"
                )
              }
            />
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
          {session.aiSuggestionSummary && (
            <AiFeedbackForm roastSessionId={session.id} initialFeedback={session.aiSuggestionFeedback} />
          )}
          <RoastPlanCard roastSessionId={session.id} notes={session.notes} hideWhenEmpty collapsedByDefault />
          <RoastCurveChart
            events={session.events}
            totalSeconds={durationSeconds ?? 0}
            probeReadings={session.temperatureReadings}
            title="Roast curve"
          />
          <PhaseBar phases={phases} />
          {session.roastedWeightGrams != null && (
            <SalesPanel
              roastSessionId={session.id}
              roastedRemainingGrams={session.roastedRemainingGrams ?? 0}
              sales={session.sales}
              friends={friends}
              margin={margin}
            />
          )}
          <SectionCard
            icon={<BrewedCupIcon className="h-3.5 w-3.5" />}
            label="Your brews"
            collapsible
            defaultCollapsed
            headerExtra={
              <Link href={`/brews?roastSessionId=${session.id}`} className="text-xs text-muted hover:text-foreground">
                Log a brew from this roast →
              </Link>
            }
          >
            {session.brews.length === 0 ? (
              <p className="text-sm text-muted">You haven&apos;t brewed this roast yet.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {session.brews.map((brew) => (
                  <BrewCard key={brew.id} brew={brew} />
                ))}
              </div>
            )}
          </SectionCard>
          <SectionCard icon={<PlusCircle className="h-3.5 w-3.5" />} label="Add event" collapsible defaultCollapsed>
            <AddEventForm roastSessionId={session.id} />
          </SectionCard>
          <SectionCard icon={<History className="h-3.5 w-3.5" />} label="Event timeline" collapsible defaultCollapsed>
            <EventTimeline events={session.events} editable bare />
          </SectionCard>
        </>
      )}
    </div>
  );
}
