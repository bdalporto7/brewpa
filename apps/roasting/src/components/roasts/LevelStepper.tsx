"use client";

import { Minus, Plus } from "lucide-react";
import { SR800_LEVEL_MIN, SR800_LEVEL_MAX } from "@/lib/constants";

export default function LevelStepper({
  label,
  icon,
  level,
  onChange,
  pending,
}: {
  label: string;
  icon: React.ReactNode;
  level: number;
  onChange: (next: number) => void;
  pending: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-surface p-4">
      <span className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted uppercase">
        {icon}
        {label}
      </span>
      <div className="flex items-center gap-4">
        <button
          type="button"
          disabled={pending || level <= SR800_LEVEL_MIN}
          onClick={() => onChange(level - 1)}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-foreground transition hover:border-accent hover:text-accent disabled:opacity-30"
          aria-label={`Decrease ${label}`}
        >
          <Minus className="h-4 w-4" />
        </button>
        <span className="w-8 text-center font-mono text-3xl font-semibold tabular-nums">{level}</span>
        <button
          type="button"
          disabled={pending || level >= SR800_LEVEL_MAX}
          onClick={() => onChange(level + 1)}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-foreground transition hover:border-accent hover:text-accent disabled:opacity-30"
          aria-label={`Increase ${label}`}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
