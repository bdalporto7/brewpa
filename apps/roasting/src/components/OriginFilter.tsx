"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

export default function OriginFilter({ origins }: { origins: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get("origin") ?? "";

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="origin-filter" className="text-xs font-medium text-muted">
        Origin
      </label>
      <select
        id="origin-filter"
        value={current}
        onChange={(e) => {
          const params = new URLSearchParams(searchParams.toString());
          if (e.target.value) {
            params.set("origin", e.target.value);
          } else {
            params.delete("origin");
          }
          const query = params.toString();
          router.push(query ? `${pathname}?${query}` : pathname);
        }}
        className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm focus:border-accent focus:outline-none"
      >
        <option value="">All origins</option>
        {origins.map((origin) => (
          <option key={origin} value={origin}>
            {origin}
          </option>
        ))}
      </select>
    </div>
  );
}
