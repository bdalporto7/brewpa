import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import { formatMMSS } from "@/lib/format";
import { getCurrentAllowedUser } from "@/lib/admin";
import { deleteBrew } from "@/lib/brew-actions";
import DeleteButton from "@/components/DeleteButton";
import BrewEditForm from "@/components/brews/BrewEditForm";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <p className="font-mono text-lg font-semibold">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}

export default async function BrewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentAllowedUser();
  if (!user) notFound();

  const [brew, recipes] = await Promise.all([
    prisma.brew.findUnique({
      where: { id },
      include: { roastSession: { include: { bean: true } }, recipe: true },
    }),
    prisma.recipe.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!brew || brew.userId !== user.id) notFound();

  const ratio = Math.round((brew.waterGrams / brew.doseGrams) * 10) / 10;
  const beanLabel = brew.roastSession?.bean.name ?? brew.beanName ?? "Coffee";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">
            {brew.roastSession ? (
              <Link href={`/beans/${brew.roastSession.beanId}`} className="hover:text-accent">
                {beanLabel}
              </Link>
            ) : (
              beanLabel
            )}
          </h1>
          <p className="text-sm text-muted">
            {format(brew.brewedAt, "MMM d, yyyy 'at' h:mm a")}
            {brew.roastSession && (
              <>
                {" "}
                · from{" "}
                <Link href={`/roasts/${brew.roastSessionId}`} className="underline hover:text-accent">
                  {format(brew.roastSession.startedAt ?? brew.roastSession.createdAt, "MMM d, yyyy")} roast
                </Link>
              </>
            )}
            {brew.recipe && (
              <>
                {" "}
                ·{" "}
                <Link href={`/recipes/${brew.recipe.id}`} className="underline hover:text-accent">
                  {brew.recipe.name}
                </Link>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <BrewEditForm brew={brew} recipes={recipes} />
          <DeleteButton
            action={deleteBrew.bind(null, brew.id)}
            confirmText={
              brew.roastSession
                ? "Delete this brew? The dose will be returned to roasted stock."
                : "Delete this brew?"
            }
            label="Delete"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Method" value={brew.method} />
        <Stat label="Dose : Water" value={`${brew.doseGrams}g : ${brew.waterGrams}g`} />
        <Stat label="Ratio" value={`1:${ratio}`} />
        <Stat label="Rating" value={brew.rating != null ? `${brew.rating}/10` : "—"} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Grind" value={brew.grindSetting ?? "—"} />
        <Stat label="Water temp" value={brew.waterTempF != null ? `${brew.waterTempF}°F` : "—"} />
        <Stat label="Brew time" value={brew.brewTimeSeconds != null ? formatMMSS(brew.brewTimeSeconds) : "—"} />
      </div>

      {brew.notes && <p className="text-sm whitespace-pre-line text-foreground/80">{brew.notes}</p>}
    </div>
  );
}
