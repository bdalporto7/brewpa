"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Fan, Flame, ChevronDown, Check } from "lucide-react";
import { generateRoastSuggestion, recordSuggestionFeedback, acceptRoastSuggestion } from "@/lib/actions";
import { saveProfileFromSuggestion } from "@/lib/profile-actions";
import { ROAST_BREW_TARGETS } from "@/lib/constants";
import { formatMMSS } from "@/lib/format";
import type { RoastPlan } from "@/lib/roastAdvisor";
import Button from "@/components/ui/Button";
import SaveProfileForm from "@/components/roasts/SaveProfileForm";
import CybarMark from "@/components/ui/CybarMark";

function parsePlan(raw: string | null): RoastPlan | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as RoastPlan;
  } catch {
    return null;
  }
}

const TARGET_LABELS: { key: keyof RoastPlan["targets"]; label: string; format: (v: number) => string }[] = [
  { key: "dryEndSeconds", label: "Dry end", format: formatMMSS },
  { key: "yellowingEndSeconds", label: "Yellowing end", format: formatMMSS },
  { key: "firstCrackSeconds", label: "1st crack", format: formatMMSS },
  { key: "developmentSeconds", label: "Development", format: formatMMSS },
  { key: "dropTempF", label: "Drop temp", format: (v) => `${v}°F` },
  { key: "targetWeightLossPercent", label: "Target weight loss", format: (v) => `${v}%` },
];

export default function AiSuggestionPanel({
  roastSessionId,
  initialAmbientTempF,
  initialRoastGoal,
  initialBrewTarget,
  suggestedFanLevel,
  suggestedHeatLevel,
  aiSuggestionSummary,
  aiSuggestionNotes,
  aiSuggestionPlan,
  aiSuggestionAcceptedAt,
  aiSuggestionFeedback,
  profileName,
}: {
  roastSessionId: string;
  initialAmbientTempF: number | null;
  initialRoastGoal: string | null;
  initialBrewTarget: string | null;
  suggestedFanLevel: number | null;
  suggestedHeatLevel: number | null;
  aiSuggestionSummary: string | null;
  aiSuggestionNotes: string | null;
  aiSuggestionPlan: string | null;
  aiSuggestionAcceptedAt: Date | null;
  aiSuggestionFeedback: string | null;
  /** Set when this session's current plan came from RoastProfilePicker's
   * applyRoastProfile rather than a fresh AI call — same underlying fields
   * (aiSuggestionPlan etc.), just a different origin worth being honest
   * about in the header. */
  profileName?: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const ambientRef = useRef<HTMLInputElement>(null);
  const goalRef = useRef<HTMLTextAreaElement>(null);
  const brewRef = useRef<HTMLSelectElement>(null);
  const [expanded, setExpanded] = useState(false);

  const [isAccepting, startAcceptTransition] = useTransition();
  const [isSavingFeedback, startFeedbackTransition] = useTransition();
  const [feedbackSaved, setFeedbackSaved] = useState(false);
  const feedbackRef = useRef<HTMLTextAreaElement>(null);

  const plan = useMemo(() => parsePlan(aiSuggestionPlan), [aiSuggestionPlan]);

  function handleSaveFeedback() {
    const feedback = feedbackRef.current?.value.trim();
    if (!feedback) return;
    setFeedbackSaved(false);
    startFeedbackTransition(async () => {
      await recordSuggestionFeedback(roastSessionId, feedback);
      setFeedbackSaved(true);
    });
  }

  function handleAccept() {
    startAcceptTransition(async () => {
      await acceptRoastSuggestion(roastSessionId);
    });
  }

  function handleGenerate() {
    const ambientTempF = Number(ambientRef.current?.value);
    const roastGoal = goalRef.current?.value.trim();
    const brewTarget = brewRef.current?.value || null;
    if (!ambientTempF || !roastGoal) {
      setError("Fill in both ambient temp and what you're going for.");
      return;
    }
    setError(null);
    setExpanded(false);
    startTransition(async () => {
      try {
        await generateRoastSuggestion(roastSessionId, ambientTempF, roastGoal, brewTarget);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="rounded-xl border-2 border-[var(--border-strong)] bg-surface shadow-[2px_2px_0_var(--shadow-ink)] p-4">
      <span className="mb-3 flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted uppercase">
        <CybarMark dancing={false} className="h-4 w-auto" />
        {profileName ? `From saved profile — ${profileName}` : "AI roast suggestion"}
      </span>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="w-full sm:w-32">
          <label htmlFor="ambientTempF" className="text-xs font-medium text-muted">
            Ambient (°F)
          </label>
          <input
            id="ambientTempF"
            ref={ambientRef}
            type="number"
            defaultValue={initialAmbientTempF ?? undefined}
            placeholder="72"
            disabled={isPending}
            className="mt-1 w-full rounded-md border border-border bg-surface px-2.5 py-1.5 font-mono text-sm focus:border-accent focus:outline-none"
          />
        </div>
        <div className="w-full sm:w-40">
          <label htmlFor="brewTarget" className="text-xs font-medium text-muted">
            Brewing for
          </label>
          <select
            id="brewTarget"
            ref={brewRef}
            defaultValue={initialBrewTarget ?? ""}
            disabled={isPending}
            className="mt-1 w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm focus:border-accent focus:outline-none"
          >
            <option value="">Not sure yet</option>
            {ROAST_BREW_TARGETS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label htmlFor="roastGoal" className="text-xs font-medium text-muted">
            What are you going for?
          </label>
          <textarea
            id="roastGoal"
            ref={goalRef}
            defaultValue={initialRoastGoal ?? undefined}
            placeholder="More acidity, medium roast, no smoky notes…"
            rows={1}
            disabled={isPending}
            className="mt-1 w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm focus:border-accent focus:outline-none"
          />
        </div>
      </div>

      <Button onClick={handleGenerate} disabled={isPending} variant="secondary" className="mt-3">
        <CybarMark dancing={isPending} className="h-4 w-auto" />
        {isPending ? "Thinking…" : aiSuggestionSummary ? "Regenerate" : "Get suggestion"}
      </Button>

      {error && <p className="mt-2 text-xs text-danger">{error}</p>}

      {aiSuggestionSummary && (
        <div className="mt-4 flex flex-col gap-2 border-t border-border pt-3">
          <div className="flex items-center gap-4 text-sm font-medium">
            <span className="flex items-center gap-1.5">
              <Fan className="h-3.5 w-3.5 text-accent" /> Fan {suggestedFanLevel}
            </span>
            <span className="flex items-center gap-1.5">
              <Flame className="h-3.5 w-3.5 text-accent" /> Heat {suggestedHeatLevel}
            </span>
          </div>
          <p className="text-sm text-foreground/80">{aiSuggestionSummary}</p>

          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex w-fit items-center gap-1 text-xs font-medium text-accent"
          >
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
            {expanded ? "Hide full plan" : "Show full plan"}
          </button>

          {expanded && (
            <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
              {plan && plan.settingChanges.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-medium tracking-wide text-muted uppercase">Dial changes</p>
                  <ul className="flex flex-col gap-0.5 font-mono text-xs">
                    {plan.settingChanges.map((c, i) => (
                      <li key={i}>
                        {formatMMSS(c.atSeconds)} —{" "}
                        {[c.fanLevel != null ? `Fan ${c.fanLevel}` : null, c.heatLevel != null ? `Heat ${c.heatLevel}` : null]
                          .filter(Boolean)
                          .join(" / ")}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {plan && Object.values(plan.targets).some((v) => v != null) && (
                <div>
                  <p className="mb-1 text-xs font-medium tracking-wide text-muted uppercase">Targets</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 font-mono text-xs sm:grid-cols-3">
                    {TARGET_LABELS.map(({ key, label, format }) => {
                      const value = plan.targets[key];
                      if (value == null) return null;
                      return (
                        <span key={key}>
                          {label}: {format(value)}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
              {aiSuggestionNotes && (
                <div>
                  <p className="mb-1 text-xs font-medium tracking-wide text-muted uppercase">Why</p>
                  <p className="text-sm text-foreground/80">{aiSuggestionNotes}</p>
                </div>
              )}
            </div>
          )}

          <p className="text-xs text-muted">Dial-in below has been pre-filled with these levels.</p>

          {aiSuggestionAcceptedAt ? (
            <p className="flex items-center gap-1.5 text-xs font-medium text-accent">
              <Check className="h-3.5 w-3.5" /> Accepted — targets will show on the live chart.
            </p>
          ) : (
            plan && (
              <Button onClick={handleAccept} disabled={isAccepting} size="sm" variant="ghost" className="w-fit">
                {isAccepting ? "Accepting…" : "Accept plan — show targets on chart"}
              </Button>
            )
          )}

          {plan && !profileName && (
            <SaveProfileForm action={saveProfileFromSuggestion.bind(null, roastSessionId)} />
          )}

          <div className="mt-2 flex flex-col gap-1.5">
            <label htmlFor="aiSuggestionFeedback" className="text-xs font-medium text-muted">
              Was this on target? Leave a correction — it helps every future suggestion, not just
              this bean&apos;s.
            </label>
            <div className="flex gap-2">
              <textarea
                id="aiSuggestionFeedback"
                ref={feedbackRef}
                defaultValue={aiSuggestionFeedback ?? undefined}
                placeholder="e.g. fan 8/heat 8 roasted way faster than predicted, done in 5 min"
                rows={1}
                disabled={isSavingFeedback}
                className="flex-1 rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm focus:border-accent focus:outline-none"
              />
              <Button onClick={handleSaveFeedback} disabled={isSavingFeedback} size="sm" variant="ghost">
                {isSavingFeedback ? "Saving…" : "Save"}
              </Button>
            </div>
            {feedbackSaved && <p className="text-xs text-accent">Saved — thanks, next suggestion will use this.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
