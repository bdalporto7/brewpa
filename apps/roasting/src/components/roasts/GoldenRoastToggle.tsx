"use client";

import { useTransition } from "react";
import { RoastedBeanIcon } from "@/components/ui/CoffeeIcons";
import { setGoldenRoast } from "@/lib/actions";
import { useToast } from "@/components/ui/ToastProvider";

/** A plain button (no wrapping element) so it can sit inline next to a
 * page's <h1>, same convention as FavoriteToggle — errors go through the
 * shared toast instead of an inline message, since a wrapped error <p>
 * wouldn't fit cleanly inside a heading's flow content. */
export default function GoldenRoastToggle({
  beanId,
  roastSessionId,
  isGolden,
}: {
  beanId: string;
  roastSessionId: string;
  isGolden: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const toast = useToast();

  function toggle() {
    startTransition(async () => {
      try {
        await setGoldenRoast(beanId, isGolden ? null : roastSessionId);
      } catch (e) {
        toast(e instanceof Error ? e.message : "Something went wrong.", "error");
      }
    });
  }

  const label = isGolden ? "Golden roast — click to unset" : "Set as golden roast";

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={toggle}
      aria-label={label}
      title={label}
      className={`flex-none rounded-full p-1 transition hover:bg-accent-soft disabled:opacity-50 ${isGolden ? "ring-2 ring-warning/50" : ""}`}
    >
      {/* Full opacity = set, dimmed = not — same convention RatingBeans
          uses for its own bean-icon state (opacity-25 on the unfilled
          ones), so "a bean icon dims when not active" reads consistently
          wherever it shows up. The hover background + ring-when-set give
          it a "this is a real toggle" affordance a plain bean icon
          otherwise lacks — unlike a star, a bean isn't an already-familiar
          "mark as special" symbol on its own. */}
      <RoastedBeanIcon className={`h-6 w-6 ${isGolden ? "" : "opacity-25"}`} />
    </button>
  );
}
