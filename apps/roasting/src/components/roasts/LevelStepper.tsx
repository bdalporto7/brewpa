"use client";

import { Minus, Plus } from "lucide-react";
import Card from "@/components/ui/Card";
import Eyebrow from "@/components/ui/Eyebrow";

export default function LevelStepper({
  label,
  icon,
  level,
  min,
  max,
  onChange,
  pending,
}: {
  label: string;
  icon: React.ReactNode;
  level: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
  pending: boolean;
}) {
  return (
    <Card interactive={false} className="flex flex-col items-center gap-2 p-4">
      <Eyebrow icon={icon}>{label}</Eyebrow>
      <div className="flex items-center gap-4">
        <button
          type="button"
          disabled={pending || level <= min}
          onClick={() => onChange(level - 1)}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-foreground transition hover:border-accent hover:text-accent disabled:opacity-30"
          aria-label={`Decrease ${label}`}
        >
          <Minus className="h-4 w-4" />
        </button>
        <span className="w-8 text-center font-mono text-3xl font-semibold tabular-nums">{level}</span>
        <button
          type="button"
          disabled={pending || level >= max}
          onClick={() => onChange(level + 1)}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-foreground transition hover:border-accent hover:text-accent disabled:opacity-30"
          aria-label={`Increase ${label}`}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </Card>
  );
}
