import fs from "node:fs/promises";
import path from "node:path";
import { format } from "date-fns";
import { buildRoastCurveSvg } from "@/lib/curve";
import { formatMMSS } from "@/lib/format";
import { computeRoastPhases } from "@/lib/phases";
import { describeEvent } from "@/lib/constants";
import type { Bean, Friend, RoastEvent, RoastSession, Sale } from "@prisma/client";

/** This repo's GitHub Pages origin — single-repo app, not meant to be portable. */
export const GITHUB_PAGES_BASE_URL = "https://bdalporto7.github.io/brewpa";

export type PublishableSession = RoastSession & {
  bean: Bean;
  events: RoastEvent[];
  sales: (Sale & { friend: Friend | null })[];
};

// docs/ lives at the repo root; this file runs from apps/roasting.
function docsDir(): string {
  return path.join(process.cwd(), "..", "..", "docs");
}

function roastsDir(): string {
  return path.join(docsDir(), "roasts");
}

export function roastPageUrl(id: string): string {
  return `${GITHUB_PAGES_BASE_URL}/roasts/${id}.html`;
}

function escapeHtml(value: string | number | null | undefined): string {
  if (value == null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const PAGE_STYLE = `
:root {
  --background: #faf6f0; --surface: #ffffff; --foreground: #2b1d14;
  --muted: #7a6a5c; --border: #e5dcd0; --accent: #b5502c;
  --accent-foreground: #fdf6f0; --accent-soft: #f3e0d3;
  --mark-dry-end: #8a7a63; --mark-first-crack: #c17d1f; --mark-second-crack: #8a3a24; --mark-drop: #2b1d14;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, monospace;
}
@media (prefers-color-scheme: dark) {
  :root {
    --background: #1a140f; --surface: #241c15; --foreground: #f3eadd;
    --muted: #a89684; --border: #3a2e24; --accent: #d97a4f;
    --accent-foreground: #1a140f; --accent-soft: #3a2418;
    --mark-dry-end: #b8a68e; --mark-first-crack: #d99a3f; --mark-second-crack: #d97a4f; --mark-drop: #f3eadd;
  }
}
* { box-sizing: border-box; }
body {
  margin: 0; background: var(--background); color: var(--foreground);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
.wrap { max-width: 44rem; margin: 0 auto; padding: 2rem 1.5rem 4rem; }
a { color: inherit; }
.back { font-size: 0.8rem; color: var(--muted); text-decoration: none; }
.back:hover { color: var(--foreground); }
h1 { font-size: 1.375rem; margin: 0.75rem 0 0.125rem; }
.subtitle { font-size: 0.875rem; color: var(--muted); margin: 0; }
.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(7rem, 1fr)); gap: 0.75rem; margin: 1.5rem 0; }
.stat { border: 1px solid var(--border); background: var(--surface); border-radius: 0.5rem; padding: 0.75rem; }
.stat-value { font-family: var(--font-mono); font-size: 1.125rem; font-weight: 600; margin: 0; }
.stat-label { font-size: 0.75rem; color: var(--muted); margin: 0.125rem 0 0; }
.card { border: 1px solid var(--border); background: var(--surface); border-radius: 0.5rem; padding: 1rem; margin: 1rem 0; }
.section-title { font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.02em; color: var(--muted); margin: 0 0 0.75rem; }
ol, ul { list-style: none; margin: 0; padding: 0; }
.timeline li, .drops li { display: flex; justify-content: space-between; gap: 0.75rem; padding: 0.625rem 0; border-top: 1px solid var(--border); font-size: 0.875rem; }
.timeline li:first-child, .drops li:first-child { border-top: none; }
.t { font-family: var(--font-mono); font-size: 0.75rem; color: var(--muted); width: 3rem; flex-shrink: 0; display: inline-block; }
.notes { font-size: 0.875rem; white-space: pre-wrap; }
.roast-curve-svg { width: 100%; min-width: 560px; }
.mono-10 { font-family: var(--font-mono); font-size: 10px; }
.marker-label { font-size: 9px; font-weight: 500; }
.footer { margin-top: 2.5rem; font-size: 0.75rem; color: var(--muted); }
.index-list li { border: 1px solid var(--border); background: var(--surface); border-radius: 0.5rem; padding: 0.75rem 1rem; margin-bottom: 0.5rem; }
.index-list a { text-decoration: none; font-weight: 500; }
.index-list .meta { font-size: 0.8rem; color: var(--muted); margin-top: 0.125rem; }
`;

export function buildRoastPageHtml(session: PublishableSession): string {
  const durationSeconds = session.endedAt
    ? (session.endedAt.getTime() - session.startedAt.getTime()) / 1000
    : 0;
  const weightLoss =
    session.roastedWeightGrams != null
      ? (1 - session.roastedWeightGrams / session.greenWeightGrams) * 100
      : null;
  const svg = buildRoastCurveSvg(session.events, durationSeconds);
  const sortedEvents = [...session.events].sort((a, b) => b.atSeconds - a.atSeconds);
  const phases = computeRoastPhases(session.events, durationSeconds);

  const stats = [
    ["Duration", formatMMSS(durationSeconds)],
    ["Roast level", session.roastLevel ?? "—"],
    ["Weight loss", weightLoss != null ? `${weightLoss.toFixed(1)}%` : "—"],
    ["Rating", session.rating != null ? "★".repeat(session.rating) : "—"],
    ["Green → roasted", `${session.greenWeightGrams}g → ${session.roastedWeightGrams ?? "—"}g`],
    ["Development", phases.developmentPercent != null ? `${phases.developmentPercent.toFixed(0)}%` : "—"],
  ];

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(session.bean.name)} — ${format(session.startedAt, "MMM d, yyyy")}</title>
<style>${PAGE_STYLE}</style>
</head>
<body>
<div class="wrap">
  <a class="back" href="../index.html">← All roasts</a>
  <h1>${escapeHtml(session.bean.name)}</h1>
  <p class="subtitle">${format(session.startedAt, "MMM d, yyyy 'at' h:mm a")} · ${escapeHtml(session.bean.origin)} · ${escapeHtml(session.bean.process)}</p>

  <div class="stats">
    ${stats
      .map(([label, value]) => `<div class="stat"><p class="stat-value">${escapeHtml(value)}</p><p class="stat-label">${escapeHtml(label)}</p></div>`)
      .join("\n    ")}
  </div>

  ${svg ? svg : `<p class="subtitle">Not enough temperature readings were logged to draw a curve.</p>`}

  ${session.notes ? `<p class="notes">${escapeHtml(session.notes)}</p>` : ""}

  ${
    session.sales.length > 0
      ? `<div class="card">
    <p class="section-title">Drops</p>
    <ul class="drops">
      ${session.sales
        .map(
          (sale) =>
            `<li><span>${escapeHtml(sale.weightGrams)}g${sale.friend ? ` — ${escapeHtml(sale.friend.name)}` : ""}${sale.price != null ? ` · $${sale.price.toFixed(2)}` : ""}</span><span>${format(sale.soldAt, "MMM d")}</span></li>`
        )
        .join("\n      ")}
    </ul>
  </div>`
      : ""
  }

  <div class="card">
    <p class="section-title">Event log</p>
    <ol class="timeline">
      ${sortedEvents
        .map(
          (e) =>
            `<li><span><span class="t">${formatMMSS(e.atSeconds)}</span>${escapeHtml(describeEvent(e))}</span></li>`
        )
        .join("\n      ")}
    </ol>
  </div>

  <p class="footer">Published from a personal roasting log.</p>
</div>
</body>
</html>
`;
}

export function buildIndexHtml(sessions: PublishableSession[]): string {
  const sorted = [...sessions].sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Roasts</title>
<style>${PAGE_STYLE}</style>
</head>
<body>
<div class="wrap">
  <h1>Roasts</h1>
  <p class="subtitle">Published roast logs.</p>
  ${
    sorted.length === 0
      ? `<p class="subtitle" style="margin-top: 1.5rem;">Nothing published yet.</p>`
      : `<ul class="index-list" style="margin-top: 1.5rem;">
    ${sorted
      .map(
        (s) =>
          `<li><a href="roasts/${s.id}.html">${escapeHtml(s.bean.name)} — ${escapeHtml(s.roastLevel ?? "")}</a><p class="meta">${format(s.startedAt, "MMM d, yyyy")}</p></li>`
      )
      .join("\n    ")}
  </ul>`
  }
</div>
</body>
</html>
`;
}

export async function writeRoastPage(session: PublishableSession): Promise<void> {
  await fs.mkdir(roastsDir(), { recursive: true });
  await fs.writeFile(path.join(roastsDir(), `${session.id}.html`), buildRoastPageHtml(session), "utf-8");
}

export async function removeRoastPage(id: string): Promise<void> {
  await fs.rm(path.join(roastsDir(), `${id}.html`), { force: true });
}

export async function writeIndexPage(sessions: PublishableSession[]): Promise<void> {
  await fs.mkdir(docsDir(), { recursive: true });
  await fs.writeFile(path.join(docsDir(), "index.html"), buildIndexHtml(sessions), "utf-8");
}
