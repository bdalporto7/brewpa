import Link from "next/link";
import { format } from "date-fns";
import Card from "@/components/ui/Card";
import type { Bean, Brew, RoastSession } from "@prisma/client";

export default function BrewCard({
  brew,
}: {
  brew: Brew & { roastSession: (RoastSession & { bean: Bean }) | null };
}) {
  const ratio = Math.round((brew.waterGrams / brew.doseGrams) * 10) / 10;
  const beanLabel = brew.roastSession?.bean.name ?? brew.beanName ?? "Coffee";

  return (
    <Link href={`/brews/${brew.id}`}>
      <Card className="p-4 transition hover:border-accent">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-medium">{beanLabel}</h3>
            <p className="text-sm text-muted">
              {brew.method} · {brew.doseGrams}g : {brew.waterGrams}g (1:{ratio})
            </p>
          </div>
          {brew.rating != null && (
            <span className="shrink-0 font-mono text-sm text-accent">{brew.rating}/10</span>
          )}
        </div>
        <p className="mt-2 font-mono text-xs text-muted">{format(brew.brewedAt, "MMM d, yyyy")}</p>
      </Card>
    </Link>
  );
}
