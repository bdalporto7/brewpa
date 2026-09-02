"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Pencil } from "lucide-react";
import { deleteBrew } from "@/lib/brew-actions";
import DeleteButton from "@/components/DeleteButton";
import BrewEditForm from "@/components/brews/BrewEditForm";
import type { Bean, Brew, Recipe, RoastSession } from "@prisma/client";

type FullBrew = Brew & { roastSession: (RoastSession & { bean: Bean }) | null; recipe: Recipe | null };

/** Same whole-header-swap isEditing pattern as BeanHeader/FriendHeader —
 * was previously the one detail page with a cramped inline edit toggle
 * confined to the actions row instead of replacing the whole header. */
export default function BrewHeader({ brew, recipes }: { brew: FullBrew; recipes: Recipe[] }) {
  const [isEditing, setIsEditing] = useState(false);
  // Fallback chain matters: a brew doesn't have to trace back to a
  // roastSession logged in this app (store-bought coffee, or one roasted
  // before this feature existed) — brew.beanName is the free-text name
  // entered for exactly that case.
  const beanLabel = brew.roastSession?.bean.name ?? brew.beanName ?? "Coffee";

  if (isEditing) {
    return <BrewEditForm brew={brew} recipes={recipes} onDone={() => setIsEditing(false)} />;
  }

  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-4xl font-black tracking-tight">
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
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="flex items-center gap-1 text-xs font-medium text-muted transition hover:text-foreground"
        >
          <Pencil className="h-3 w-3" /> Edit
        </button>
        <DeleteButton
          action={deleteBrew.bind(null, brew.id)}
          confirmText={
            brew.roastSession ? "Delete this brew? The dose will be returned to roasted stock." : "Delete this brew?"
          }
          label="Delete"
        />
      </div>
    </div>
  );
}
