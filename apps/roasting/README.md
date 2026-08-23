# Roasting

A local coffee roasting app built for a **Fresh Roast SR800**: track green
bean inventory, run a live timer during a roast while logging fan/heat
changes, temperature readings, and crack markers in real time, review the
resulting roasting curve, then track roasted coffee as you drop it to
friends. See the repo-level [AGENTS.md](../../AGENTS.md) for full project
context, design standards, and build-order rationale.

## Features

- **Green bean inventory** (`/beans`, `/beans/[id]`) — add, edit, and delete
  beans (with an optional seller link); stock decrements automatically when
  a roast starts, and can also be corrected by hand (add/remove/set exact —
  add/remove shift the total right along with it, set exact is a pure
  recount) for coffee used outside the app. The list groups by bean
  everywhere, including roasted stock (one card aggregating all of a bean's
  roasts, not one per roast); click through to `/beans/[id]` for the full
  picture — green stock, aggregate roasted stock, every past roast. A
  bookmarkable filter bar (`?q=`/`?origin=`/`?process=`, all combinable) —
  free-text search plus origin/process dropdowns populated from what's
  actually in your data — narrows all four sections at once.
- **Live roast sessions** (`/roasts`, `/roasts/[id]`) — start a roast against
  a bean and land on a setup screen (no timer running) to dial in your
  starting fan and heat; tap "Begin Roast" when you're actually ready and
  *that's* when the clock starts. Once live, log fan level, heat level,
  temperature readings, and milestone markers (dry end, yellowing end,
  first/second crack) in real time — all manual entry, tapped in as you
  watch the physical roaster. Only one roast can be set up or running at a
  time.
- **Roasting curve** — once a roast ends, its temperature readings render as
  a hand-built SVG curve with crack markers and a fan/heat step overlay.
- **Drops** — log roasted coffee given or sold to a friend, drawn from that
  roast's roasted-coffee stock. Over-drawing is rejected with a clear error;
  any drop can be undone.
- **Friends** (`/friends`, `/friends/[id]`) — every person a drop has gone
  to, with their full history across every roast and running totals (grams
  received, amount paid). Editable and deletable.
- **Export & publish** — download a completed roast as CSV, or publish it as
  a static page to this repo's GitHub Pages site (curve, stats, event log).
  See "Export & publish" below — there's a one-time repo setting and a
  manual `git push` involved, not just an in-app button.
- **Backfilling** — "Log a past roast" on `/roasts` records one already
  completed (bean, weights, a past date/duration, level, rating) without a
  live timer; "Add event" on any completed roast lets you add individual
  fan/heat/temp/crack events afterward, each with a manually-typed elapsed
  time.
- **Roast phases** — Scott Rao's three-phase breakdown (drying / Maillard /
  development), computed from milestone events and shown on every completed
  roast, live during one, in the CSV, and on published pages.
- **Live tips** — a small rule-based panel during a live roast: reminders
  grounded in general roasting heuristics, and comparisons to your own past
  roasts of that bean (e.g. "your average for this bean is 6:15"). No LLM
  call — deliberately deterministic, see AGENTS.md for why.
- **Dashboard** (`/`) — stats at a glance, or the live timer front-and-center
  if a roast is currently running.

## Setup

From the repo root, `./start.sh` handles install + DB setup + dev server in
one command (safe to re-run). Or, manually from here:

```bash
npm install
npx prisma migrate dev   # creates dev.db and applies migrations
npm run dev              # http://localhost:3000
```

## Commands

```bash
npm run dev          # dev server
npm run build         # production build
npm run lint          # eslint
npx tsc --noEmit      # typecheck
npx prisma studio     # browse the SQLite DB directly
npx prisma migrate dev --name <name>   # after editing prisma/schema.prisma
```

**After any schema change, restart the dev server** — the regenerated
Prisma Client on disk isn't picked up by an already-running process.

## Stack

Next.js 15 (App Router) + TypeScript + Tailwind CSS v4 + Prisma 6 + SQLite.
Mutations go through Server Actions in
[`src/lib/actions.ts`](src/lib/actions.ts) — no separate REST API. Shared UI
primitives live in [`src/components/ui/`](src/components/ui); the app's
palette and design tokens are defined in
[`src/app/globals.css`](src/app/globals.css) — a warm, roast-inspired
palette (not Tailwind defaults), `lucide-react` icons (never emoji), and a
monospace face for live-updating numbers. See AGENTS.md's "Design standards"
section for the full rationale.

## Data model

- **Bean** — a green bean purchase: origin, process, variety, an optional
  seller link, total `weightGrams`, and `remainingGrams` that decrements as
  roasts start. Both are editable, but through different controls: the full
  edit form on `/beans` (or the detail page) has a "Total purchased (g)"
  field for correcting `weightGrams` (can't go below current remaining);
  `remainingGrams` has its own dedicated add/remove/set-exact control
  (`StockAdjuster.tsx`) instead of living in that same form.
- **RoastSession** — one roast against a `Bean`: `startedAt`/`endedAt`,
  green weight, final roasted weight, roast level and rating. Green stock is
  decremented when a session starts and restored if it's deleted (whether
  abandoned live or removed after the fact). Ending a roast also sets
  `roastedRemainingGrams` to the roasted weight — each session is its own
  roasted-coffee stock entry, shown on its card and on `/roasts/[id]`, with
  the same add/remove/set-exact control as green stock. Only one session can
  be active at a time.
- **RoastEvent** — a timestamped entry within a session (`atSeconds` elapsed
  from `startedAt`): a fan or heat level change, a temperature reading, a
  crack marker, a free note, or the drop event auto-logged when a roast ends.
- **Sale** — roasted coffee given/sold to a `Friend` from one `RoastSession`
  (called a "drop" in the UI, unrelated to the `DROP` event above — see
  AGENTS.md if that's confusing). Decrements that session's
  `roastedRemainingGrams`; deleting a sale ("Undo") restores it.
- **Friend** — a person drops go to. Created automatically (case-insensitive
  find-or-create) the first time you type their name into a drop's "Friend"
  field; `/friends` and `/friends/[id]` show their drop history across every
  roast. Editable (name/notes) and deletable from `/friends/[id]` — deleting
  doesn't touch their past drops, it just un-links them (they show as
  anonymous on the roast they came from). No merge action for near-duplicate
  friends yet — see AGENTS.md.

## How a roast works

1. On [`/roasts`](src/app/roasts/page.tsx), start a roast against a bean —
   this creates a `RoastSession` and redirects to its live page.
2. The live page ([`src/app/roasts/[id]/page.tsx`](<src/app/roasts/[id]/page.tsx>))
   shows a running timer ([`Timer.tsx`](src/components/roasts/Timer.tsx))
   and [`EventLogPanel.tsx`](src/components/roasts/EventLogPanel.tsx) for
   logging fan/heat/temp/crack/note events against the elapsed time — all
   manual entry, since the SR800 has no data output of its own.
3. "Drop Roast" sets `endedAt` and logs a `DROP` event immediately — roasted
   weight, roast level, and rating are filled in afterward on the now-
   completed page.
4. The completed session renders
   [`RoastCurveChart.tsx`](src/components/roasts/RoastCurveChart.tsx) — a
   hand-built SVG temperature curve with crack markers and a fan/heat step
   overlay, plus a [`SalesPanel.tsx`](src/components/roasts/SalesPanel.tsx)
   for logging drops to friends, then the full event timeline.

## Export & publish

- **CSV** — the "Export CSV" link on a completed roast hits
  `/roasts/[id]/export` ([`route.ts`](<src/app/roasts/[id]/export/route.ts>)),
  which streams a CSV built by [`src/lib/csv.ts`](src/lib/csv.ts): a
  metadata block (bean, weights, level, rating, duration) then the full
  event table.
- **Publish to GitHub Pages** — "Publish" on a completed roast renders a
  static, self-contained HTML page (no build step, no JS) to
  `docs/roasts/<id>.html`, via [`src/lib/publish.ts`](src/lib/publish.ts),
  and regenerates `docs/index.html` from every published roast. "Unpublish"
  removes it and regenerates the index. Both then commit and push just the
  `docs/` folder automatically (`syncGeneratedDocs` in
  [`src/lib/git.ts`](src/lib/git.ts)) — if that fails (no remote, diverged
  history, no auth), the publish/unpublish state rolls back and the button
  shows a real error rather than claiming something is live that isn't. The
  curve on the published page comes from the exact same function as the
  live chart ([`buildRoastCurveSvg`](src/lib/curve.ts)) — they can't
  visually drift apart. All user text (bean name, notes, friend names) is
  HTML-escaped, since this page is genuinely public.

GitHub Pages itself needs a one-time repo setup — Settings → Pages → Deploy
from a branch → `main`, folder `/docs` — but note it requires a **public**
repo unless you're on a paid GitHub plan; Pages isn't available for a
private repo on the free tier at all. Beyond that, publishing is now fully
self-contained: clicking Publish/Unpublish generates the page *and* commits
+ pushes it, no manual git step left.

## Roast lifecycle

Starting a roast doesn't start the clock. `/roasts` → "Start" creates a
*pending* session (bean + green weight locked in, stock decremented) and
lands on a setup screen — fan/heat steppers with no timer, no events
written yet. Tapping "Begin Roast" is the actual transition: it sets the
session's start time and logs the chosen fan/heat as the first events, and
*that's* what starts the timer everywhere else in the app measures against.
Three states in total: pending → live → completed.

Ending a roast works the same way, in reverse: "Drop Roast" ends the session
immediately — one click, no form — setting `endedAt` and logging the `DROP`
event right then, since the whole point is that dropping the beans and
weighing/rating them are two different moments. The completed page then
shows "How'd it turn out?" — roasted weight, roast level, rating, notes —
auto-expanded until you've filled it in at least once, editable anytime
after via "Edit details."

## Roast phases & live tips

- **Phases** — `computeRoastPhases` ([`src/lib/phases.ts`](src/lib/phases.ts))
  derives Scott Rao's phase breakdown — drying (charge → dry end), yellowing
  (dry end → yellowing end), browning/Maillard (yellowing end → first
  crack), development (first crack → drop) — purely from whatever milestone
  events exist; a phase whose boundaries aren't logged comes back blank
  rather than guessed, except browning, which falls back to spanning the
  whole dry-end-to-first-crack window on older roasts logged before
  "yellowing end" existed as a milestone.
  [`PhaseBar.tsx`](src/components/roasts/PhaseBar.tsx) renders it everywhere:
  completed roasts, live (via `LiveTipsPanel`), the CSV export, and the
  published static page.
- **Tips** — [`generateLiveTips`](src/lib/tips.ts) is a small, deliberately
  rule-based set of prompts shown during a live roast
  ([`LiveTipsPanel.tsx`](src/components/roasts/LiveTipsPanel.tsx)) — no LLM
  call. Two kinds: generic ones citing real, verified guidance (e.g. Scott
  Rao's actual development-time-ratio target of 20–25%, confirmed against
  [his own post](https://www.scottrao.com/blog/2016/8/25/development-time-ratio)
  rather than left as a recalled-from-memory approximation — see AGENTS.md
  for why that distinction matters here), and personalized ones comparing
  this roast to the roaster's own history for that bean
  (`computeHistoricalBaseline`, falling back to all beans if this one has no
  history yet). The personalized half is the more defensible part — it's a
  checkable fact about real data, not a general claim.

## Not built yet

- No merge action for near-duplicate friends (e.g. "Jake" vs. "Jake S.").
- Nothing here needs serial/USB/Bluetooth hardware access — see AGENTS.md
  for why that's a deliberate choice, not a gap.
