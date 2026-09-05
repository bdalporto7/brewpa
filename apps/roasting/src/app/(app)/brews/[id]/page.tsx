import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatMMSS } from "@/lib/format";
import { getCurrentAllowedUser } from "@/lib/admin";
import BrewHeader from "@/components/brews/BrewHeader";
import Stat from "@/components/ui/Stat";

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

  return (
    <div className="flex flex-col gap-6">
      <BrewHeader brew={brew} recipes={recipes} />

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
