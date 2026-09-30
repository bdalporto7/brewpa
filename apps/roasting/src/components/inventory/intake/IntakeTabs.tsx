"use client";

import { useState } from "react";
import { ScanLine, Sparkles } from "lucide-react";
import ReceiptScanFlow from "@/components/inventory/intake/ReceiptScanFlow";
import SmartAddFlow from "@/components/inventory/intake/SmartAddFlow";
import type { Bean } from "@prisma/client";

export default function IntakeTabs({
  beans,
  initialTab,
}: {
  beans: Pick<Bean, "id" | "name" | "remainingGrams">[];
  initialTab: "receipt" | "smart";
}) {
  const [tab, setTab] = useState<"receipt" | "smart">(initialTab);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1.5">
        {(
          [
            { key: "receipt", label: "Receipt scan", icon: ScanLine },
            { key: "smart", label: "Smart add", icon: Sparkles },
          ] as const
        ).map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition ${
                active ? "bg-accent text-accent-foreground" : "border border-border bg-surface text-muted hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border border-border bg-surface p-4">
        {tab === "receipt" ? <ReceiptScanFlow beans={beans} /> : <SmartAddFlow />}
      </div>
    </div>
  );
}
