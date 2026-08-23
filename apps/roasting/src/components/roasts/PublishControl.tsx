"use client";

import { useState, useTransition } from "react";
import { Globe } from "lucide-react";
import { publishRoast, unpublishRoast } from "@/lib/actions";
import { roastPageUrl } from "@/lib/publish-url";

export default function PublishControl({
  roastSessionId,
  publishedAt,
}: {
  roastSessionId: string;
  publishedAt: Date | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2 text-xs">
        {publishedAt ? (
          <>
            <a
              href={roastPageUrl(roastSessionId)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 font-medium text-accent hover:opacity-80"
            >
              <Globe className="h-3.5 w-3.5" />
              Published
            </a>
            <button
              type="button"
              disabled={isPending}
              onClick={() => run(() => unpublishRoast(roastSessionId))}
              className="text-muted transition hover:text-foreground disabled:opacity-50"
            >
              {isPending ? "Unpublishing…" : "Unpublish"}
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={isPending}
            onClick={() => run(() => publishRoast(roastSessionId))}
            className="flex items-center gap-1.5 font-medium text-muted transition hover:text-foreground disabled:opacity-50"
          >
            <Globe className="h-3.5 w-3.5" />
            {isPending ? "Publishing…" : "Publish"}
          </button>
        )}
      </div>
      {error && <p className="max-w-[16rem] text-right text-xs text-danger">{error}</p>}
    </div>
  );
}
