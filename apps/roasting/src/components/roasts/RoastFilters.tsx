"use client";

import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Card from "@/components/ui/Card";

/**
 * Same URL-search-param pattern as BeanFilters — filtering happens
 * server-side in RoastsPage on every navigation, so a shared/bookmarked
 * filtered link renders the same list server-rendered, not a client-side
 * re-filter of an already-fetched full history.
 */
export default function RoastFilters({
  origins,
  levels,
}: {
  origins: string[];
  levels: readonly string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get("q") ?? "");

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  useEffect(() => {
    const current = searchParams.get("q") ?? "";
    if (search === current) return;
    const timeout = setTimeout(() => setParam("q", search), 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const origin = searchParams.get("origin") ?? "";
  const level = searchParams.get("level") ?? "";
  const stock = searchParams.get("stock") ?? "";
  const hasFilters = origin || level || stock || (searchParams.get("q") ?? "");

  return (
    <Card interactive={false} className="flex flex-wrap items-center gap-3 p-3">
      <div className="relative min-w-[160px] flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
        <input
          type="text"
          placeholder="Search roasts…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-md border border-border bg-surface py-1.5 pr-2.5 pl-8 text-sm focus:border-accent focus:outline-none"
        />
      </div>

      <select
        value={stock}
        onChange={(e) => setParam("stock", e.target.value)}
        className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm focus:border-accent focus:outline-none"
      >
        <option value="">In stock or not</option>
        <option value="in">Roasted coffee on hand</option>
        <option value="out">None left</option>
      </select>

      <select
        value={origin}
        onChange={(e) => setParam("origin", e.target.value)}
        className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm focus:border-accent focus:outline-none"
      >
        <option value="">All origins</option>
        {origins.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>

      <select
        value={level}
        onChange={(e) => setParam("level", e.target.value)}
        className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm focus:border-accent focus:outline-none"
      >
        <option value="">All roast levels</option>
        {levels.map((l) => (
          <option key={l} value={l}>
            {l}
          </option>
        ))}
      </select>

      {hasFilters && (
        <button
          type="button"
          onClick={() => {
            setSearch("");
            router.push(pathname);
          }}
          className="flex items-center gap-1 text-xs font-medium text-muted transition hover:text-foreground"
        >
          <X className="h-3 w-3" /> Clear
        </button>
      )}
    </Card>
  );
}
