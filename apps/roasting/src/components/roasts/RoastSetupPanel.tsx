"use client";

import { useState, useTransition } from "react";
import { Play } from "lucide-react";
import { beginRoast } from "@/lib/actions";
import { useServerSyncedState } from "@/lib/useServerSyncedState";
import LevelStepper from "@/components/roasts/LevelStepper";
import Button from "@/components/ui/Button";
import { CONTROL_ICONS, type RoasterControl } from "@/lib/roasters";

export default function RoastSetupPanel({
  roastSessionId,
  controls,
  initialLevels,
}: {
  roastSessionId: string;
  controls: RoasterControl[];
  /** Pre-filled from an AI suggestion (AiSuggestionPanel) once one exists,
   * falling back to each control's own defaultValue otherwise —
   * useServerSyncedState (not plain useState) so dialing this in still
   * updates correctly if a suggestion is generated after this panel already
   * mounted, same drift problem useServerSyncedState was built for. */
  initialLevels: Record<string, number>;
}) {
  const [levels, setLevels] = useServerSyncedState(initialLevels);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleBegin() {
    setError(null);
    startTransition(async () => {
      try {
        await beginRoast(roastSessionId, levels);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        Dial in your starting {controls.map((c) => c.label.toLowerCase()).join(" and ")} to match the roaster, then
        begin when you&apos;re ready — the timer starts the moment you tap Begin.
      </p>

      <div className="grid grid-cols-2 gap-3">
        {controls.map((control) => {
          const Icon = CONTROL_ICONS[control.icon];
          return (
            <LevelStepper
              key={control.key}
              label={control.label}
              icon={<Icon className="h-3.5 w-3.5" />}
              level={levels[control.key] ?? control.defaultValue}
              min={control.min}
              max={control.max}
              pending={isPending}
              onChange={(next) => setLevels({ ...levels, [control.key]: next })}
            />
          );
        })}
      </div>

      <Button onClick={handleBegin} disabled={isPending} className="self-center">
        <Play className="h-4 w-4" /> {isPending ? "Starting…" : "Begin Roast"}
      </Button>

      {error && <p className="text-center text-sm text-danger">{error}</p>}
    </div>
  );
}
