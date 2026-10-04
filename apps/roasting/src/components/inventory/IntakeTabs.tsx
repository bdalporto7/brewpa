"use client";

import { useState } from "react";
import type { ReactNode } from "react";

const TABS = [
  { key: "manual", label: "Manual" },
  { key: "receipt", label: "Receipt scan" },
  { key: "smart", label: "Smart add" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

/** Simple tab switcher for the three intake modes — no nested routes. */
export default function IntakeTabs({
  manual,
  receipt,
  smart,
}: {
  manual: ReactNode;
  receipt: ReactNode;
  smart: ReactNode;
}) {
  const [tab, setTab] = useState<TabKey>("manual");

  return (
    <div>
      <div className="flex gap-1 border-b-2 border-[var(--border-strong)]" role="tablist" aria-label="Intake method">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-0.5 px-4 py-2 text-sm font-medium transition ${
              tab === t.key
                ? "border-b-2 border-accent text-foreground"
                : "text-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="pt-6" role="tabpanel">
        {tab === "manual" && manual}
        {tab === "receipt" && receipt}
        {tab === "smart" && smart}
      </div>
    </div>
  );
}
