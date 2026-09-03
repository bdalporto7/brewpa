"use client";

import { useRouter } from "next/navigation";
import { format } from "date-fns";
import Card from "@/components/ui/Card";
import { BrewedCupIcon } from "@/components/ui/CoffeeIcons";
import SteamWisp from "@/components/ui/SteamWisp";
import TapCircleLink from "@/components/ui/TapCircleLink";
import type { Bean, Brew, RoastSession } from "@prisma/client";

export default function BrewCard({
  brew,
}: {
  brew: Brew & { roastSession: (RoastSession & { bean: Bean }) | null };
}) {
  const router = useRouter();
  const ratio = Math.round((brew.waterGrams / brew.doseGrams) * 10) / 10;
  const beanLabel = brew.roastSession?.bean.name ?? brew.beanName ?? "Coffee";

  return (
    // router.push, not a wrapping <Link> — TapCircleLink on the name
    // already renders a real anchor; see RoastSessionCard for the reasoning.
    <Card
      className="cursor-pointer p-4 transition hover:border-accent"
      onClick={() => router.push(`/brews/${brew.id}`)}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-2.5">
          <span className="relative mt-0.5 inline-flex h-4 w-4 flex-none text-accent">
            <BrewedCupIcon className="h-4 w-4" />
            <SteamWisp className="pointer-events-none absolute -top-2.5 left-0.5 h-2.5 w-3.5 text-foreground" />
          </span>
          <div>
            <h3 className="font-medium" onClick={(e) => e.stopPropagation()}>
              <TapCircleLink href={`/brews/${brew.id}`}>{beanLabel}</TapCircleLink>
            </h3>
            <p className="text-sm text-muted">
              {brew.method} · {brew.doseGrams}g : {brew.waterGrams}g (1:{ratio})
            </p>
          </div>
        </div>
        {brew.rating != null && (
          <span className="shrink-0 font-mono text-sm text-accent">{brew.rating}/10</span>
        )}
      </div>
      <p className="mt-2 font-mono text-xs text-muted">{format(brew.brewedAt, "MMM d, yyyy")}</p>
    </Card>
  );
}
