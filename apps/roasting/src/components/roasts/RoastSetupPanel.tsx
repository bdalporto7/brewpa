"use client";

import { useState, useTransition } from "react";
import { Fan, Flame, Play } from "lucide-react";
import { beginRoast } from "@/lib/actions";
import LevelStepper from "@/components/roasts/LevelStepper";
import Button from "@/components/ui/Button";

export default function RoastSetupPanel({ roastSessionId }: { roastSessionId: string }) {
  const [fanLevel, setFanLevel] = useState(5);
  const [heatLevel, setHeatLevel] = useState(5);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleBegin() {
    setError(null);
    startTransition(async () => {
      try {
        await beginRoast(roastSessionId, fanLevel, heatLevel);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        Dial in your starting fan and heat to match the roaster, then begin when you&apos;re
        ready — the timer starts the moment you tap Begin.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <LevelStepper
          label="Fan"
          icon={<Fan className="h-3.5 w-3.5" />}
          level={fanLevel}
          pending={isPending}
          onChange={setFanLevel}
        />
        <LevelStepper
          label="Heat"
          icon={<Flame className="h-3.5 w-3.5" />}
          level={heatLevel}
          pending={isPending}
          onChange={setHeatLevel}
        />
      </div>

      <Button onClick={handleBegin} disabled={isPending} className="self-center">
        <Play className="h-4 w-4" /> {isPending ? "Starting…" : "Begin Roast"}
      </Button>

      {error && <p className="text-center text-sm text-danger">{error}</p>}
    </div>
  );
}
