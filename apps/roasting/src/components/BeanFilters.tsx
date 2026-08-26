"use client";

import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

export default function BeanFilters({
  origins,
  processes,
}: {
  origins: string[];
  processes: string[];
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

  // Debounce the free-text search so every keystroke doesn't push a new URL.
  useEffect(() => {
    const current = searchParams.get("q") ?? "";
    if (search === current) return;
    const timeout = setTimeout(() => setParam("q", search), 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const origin = searchParams.get("origin") ?? "";
  const process = searchParams.get("process") ?? "";
  const hasFilters = origin || process || (searchParams.get("q") ?? "");

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border-2 border-[var(--border-strong)] bg-surface shadow-[2px_2px_0_var(--shadow-ink)] p-3">
      <div className="relative min-w-[160px] flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
        <input
          type="text"
          placeholder="Search beans…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-md border border-border bg-surface py-1.5 pr-2.5 pl-8 text-sm focus:border-accent focus:outline-none"
        />
      </div>

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
        value={process}
        onChange={(e) => setParam("process", e.target.value)}
        className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm focus:border-accent focus:outline-none"
      >
        <option value="">All processes</option>
        {processes.map((p) => (
          <option key={p} value={p}>
            {p}
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
    </div>
  );
}
