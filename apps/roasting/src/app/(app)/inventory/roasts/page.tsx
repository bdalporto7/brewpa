import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentAllowedUser } from "@/lib/admin";
import { logRoast } from "@/lib/inventory-actions";
import { ROAST_LEVELS } from "@/lib/constants";
import { formatWeight } from "@/lib/units";
import ActionForm from "@/components/ActionForm";
import Button from "@/components/ui/Button";
import { TextField, SelectField, TextareaField } from "@/components/ui/Field";
import WeightInput from "@/components/inventory/WeightInput";
import ImportArtisanRoastForm from "@/components/roasts/ImportArtisanRoastForm";
import DecoratedEmptyState from "@/components/ui/DecoratedEmptyState";

/**
 * The business roast log: every completed roast, newest first, with blend
 * batches rendered as one row. "Log a roast" is the after-the-fact
 * bookkeeping entry (deducts green immediately); the Artisan import is the
 * same form the roasting side uses, reused directly. Live roasts still
 * belong to /roasts — this page is the ledger, not the console.
 */
export default async function RoastLogPage() {
  const user = await getCurrentAllowedUser();
  if (!user) notFound();

  const [sessions, beans, roasterDefinitions] = await Promise.all([
    prisma.roastSession.findMany({
      where: { teamId: user.teamId, endedAt: { not: null } },
      include: { bean: true, blendRecipe: true },
      orderBy: { endedAt: "desc" },
      take: 100,
    }),
    prisma.bean.findMany({
      where: { teamId: user.teamId },
      orderBy: { name: "asc" },
    }),
    prisma.roasterDefinition.findMany({
      where: { teamId: user.teamId },
      orderBy: { name: "asc" },
    }),
  ]);

  // Blend roasts arrive as one session per component sharing a
  // blendBatchId — group them back into a single ledger row.
  const rows: (
    | { kind: "single"; session: (typeof sessions)[number] }
    | { kind: "blend"; batchId: string; recipeName: string | null; sessions: (typeof sessions)[number][] }
  )[] = [];
  const seenBatches = new Set<string>();
  for (const s of sessions) {
    if (s.blendBatchId) {
      if (seenBatches.has(s.blendBatchId)) continue;
      seenBatches.add(s.blendBatchId);
      const batch = sessions.filter((x) => x.blendBatchId === s.blendBatchId);
      rows.push({
        kind: "blend",
        batchId: s.blendBatchId,
        recipeName: s.blendRecipe?.name ?? null,
        sessions: batch,
      });
    } else {
      rows.push({ kind: "single", session: s });
    }
  }

  const defaultRoasterId =
    roasterDefinitions.find((r) => r.isDefault)?.id ?? roasterDefinitions[0]?.id ?? "";

  return (
    <div className="flex flex-col gap-4">
      {rows.length === 0 ? (
        <DecoratedEmptyState>
          No roasts logged yet — log one below or import from Artisan.
        </DecoratedEmptyState>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => {
            if (row.kind === "blend") {
              const totalGreen = row.sessions.reduce((sum, s) => sum + s.greenWeightGrams, 0);
              const totalRoasted = row.sessions.reduce((sum, s) => sum + (s.roastedWeightGrams ?? 0), 0);
              const first = row.sessions[0];
              return (
                <li key={row.batchId} className="rounded-xl border border-border bg-surface p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="font-semibold">
                        Blend{row.recipeName ? `: ${row.recipeName}` : ""}
                      </span>
                      <p className="mt-0.5 text-xs text-muted">
                        {row.sessions.map((s) => `${s.bean.name} ${Math.round((s.greenWeightGrams / totalGreen) * 100)}%`).join(" · ")}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-mono text-sm font-semibold">{formatWeight(totalGreen)}</div>
                      <div className="font-mono text-xs text-muted">
                        → {totalRoasted > 0 ? formatWeight(totalRoasted) : "—"}
                      </div>
                    </div>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">
                      blend · {row.sessions.length} lots
                    </span>
                    <span className="text-xs text-muted">
                      {first.endedAt?.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  </div>
                </li>
              );
            }
            const s = row.session;
            const loss =
              s.roastedWeightGrams != null && s.greenWeightGrams > 0
                ? Math.round(((s.greenWeightGrams - s.roastedWeightGrams) / s.greenWeightGrams) * 1000) / 10
                : null;
            return (
              <li key={s.id}>
                <Link
                  href={`/roasts/${s.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-3.5 py-2.5 hover:border-accent"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{s.bean.name}</span>
                    <span className="text-xs text-muted">
                      <span className="font-mono">{formatWeight(s.greenWeightGrams)}</span>
                      <span> → </span>
                      <span className="font-mono">{s.roastedWeightGrams != null ? formatWeight(s.roastedWeightGrams) : "—"}</span>
                      {loss != null && <span> · {loss}% loss</span>}
                      {s.roastLevel && <span> · {s.roastLevel}</span>}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-muted">
                    {s.endedAt?.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <details className="group rounded-xl border border-border bg-surface">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
          <Plus className="h-4 w-4 text-accent" />
          Log a roast
        </summary>
        <div className="border-t border-border p-4">
          <ActionForm action={logRoast} className="grid grid-cols-1 gap-3 sm:grid-cols-2" successMessage="Roast logged">
            <SelectField label="Lot *" name="beanId" required defaultValue="">
              <option value="" disabled>
                Select a lot
              </option>
              {beans.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({Math.round(b.remainingGrams * 10) / 10}g on hand)
                </option>
              ))}
            </SelectField>
            {roasterDefinitions.length > 1 ? (
              <SelectField label="Roaster" name="roasterDefinitionId" defaultValue={defaultRoasterId}>
                {roasterDefinitions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </SelectField>
            ) : (
              <input type="hidden" name="roasterDefinitionId" value={defaultRoasterId} />
            )}
            <WeightInput name="greenWeightGrams" label="Green weight *" required hint="Deducted from the lot immediately." />
            <WeightInput name="roastedWeightGrams" label="Roasted yield" hint="Weigh after cooling; used for loss + cost math." />
            <SelectField label="Roast level *" name="roastLevel" required defaultValue="">
              <option value="" disabled>
                Select level
              </option>
              {ROAST_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </SelectField>
            <TextField label="Rating (1–5)" name="rating" type="number" min="1" max="5" step="1" mono />
            <div className="sm:col-span-2">
              <TextareaField label="Notes" name="notes" rows={2} />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" variant="primary">
                Log roast
              </Button>
            </div>
          </ActionForm>
        </div>
      </details>

      <ImportArtisanRoastForm beans={beans} roasterDefinitions={roasterDefinitions} />
    </div>
  );
}
