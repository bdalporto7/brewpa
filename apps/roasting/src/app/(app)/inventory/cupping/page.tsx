import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentAllowedUser } from "@/lib/admin";
import { deleteLotCupping } from "@/lib/inventory-actions";
import { computeCuppingTotal } from "@/lib/cupping";
import LotCuppingForm from "@/components/inventory/LotCuppingForm";
import DeleteButton from "@/components/DeleteButton";
import DecoratedEmptyState from "@/components/ui/DecoratedEmptyState";

/**
 * Cupping index: every lot-attached cupping, grouped by lot. Roast-
 * attached cuppings live on their roast pages — this is the green-side
 * ledger (arrival samples, pre-roast checks).
 */
export default async function CuppingPage() {
  const user = await getCurrentAllowedUser();
  if (!user) notFound();

  const [notes, beans] = await Promise.all([
    prisma.cuppingNote.findMany({
      where: { beanId: { not: null }, bean: { teamId: user.teamId } },
      include: { bean: { select: { id: true, name: true } } },
      orderBy: { cuppedAt: "desc" },
    }),
    prisma.bean.findMany({
      where: { teamId: user.teamId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <p className="-mt-2 text-sm text-muted">
        Green-side cuppings per lot — arrival samples and pre-roast checks. Roast cuppings stay on
        their roast pages.
      </p>

      {notes.length === 0 ? (
        <DecoratedEmptyState>
          No lot cuppings yet — log an arrival sample below.
        </DecoratedEmptyState>
      ) : (
        <ul className="flex flex-col gap-2">
          {notes.map((note) => {
            const total = computeCuppingTotal(note);
            return (
              <li key={note.id} className="flex items-start justify-between gap-3 rounded-xl border border-border bg-surface p-3.5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-2">
                    {note.bean && (
                      <Link href={`/inventory/lots/${note.bean.id}`} className="text-sm font-semibold hover:text-accent">
                        {note.bean.name}
                      </Link>
                    )}
                    <span className="font-mono text-sm font-bold">{total != null ? total.toFixed(2) : "—"}</span>
                    <span className="text-xs text-muted">
                      {note.cuppedAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  </div>
                  {note.notes && <p className="mt-1 text-sm">{note.notes}</p>}
                </div>
                <DeleteButton
                  action={deleteLotCupping.bind(null, note.id)}
                  confirmText="Delete this cupping note?"
                  variant="icon"
                />
              </li>
            );
          })}
        </ul>
      )}

      <details className="group rounded-xl border border-border bg-surface">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
          <Plus className="h-4 w-4 text-accent" />
          Log a cupping
        </summary>
        <div className="border-t border-border p-4">
          <LotCuppingForm beans={beans} />
        </div>
      </details>
    </div>
  );
}
