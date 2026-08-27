# Roasting

A coffee app with two sides: **roasting**, built for a **Fresh Roast
SR800** (track green bean inventory, run a live timer while logging
fan/heat changes and crack markers in real time, review the resulting
roasting curve, then track roasted coffee as you drop it to friends or
brew it yourself), and **brewing**, a personal brew journal alongside it.
See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for a diagram-first
overview of how the pieces connect, [`docs/SCHEMA.md`](docs/SCHEMA.md) for
a field-by-field data dictionary, [`docs/API.md`](docs/API.md) for every
route and Server Action, and the repo-level
[AGENTS.md](../../AGENTS.md) for full project context, design standards,
and the reasoning behind specific decisions.

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
  starting fan and heat; write a **plan** here too if you want one (target
  temps, timing — the same notes field a completed roast's details use,
  just editable from before the roast even starts). Tap "Begin Roast" when
  you're actually ready and *that's* when the clock starts. Once live, log
  fan level, heat level, temperature readings, and milestone markers (dry
  end, yellowing end, first/second crack) in real time — all manual entry,
  tapped in as you watch the physical roaster. The timer stays visible the
  whole time: scroll down to log an event or check the plan and a bold
  accent-colored bar with large digits pins to the top instead of scrolling
  away — built to catch your eye from across the room while you're watching
  the physical roaster, not just to technically still be on the page. Only
  one roast can be set up or running at a time.
- **Roasting curve** — once a roast ends, its temperature readings render as
  a hand-built SVG curve with
  crack markers and a fan/heat step overlay. Hovering (or touching, on
  mobile) snaps a crosshair to the nearest logged reading and shows a
  tooltip with elapsed time, temp, and the fan/heat level active at that
  moment — the same real, logged data points the curve itself draws, never
  an interpolated value. A "Rate of rise" toggle overlays a second line —
  °F/min between consecutive readings, on its own right-side axis — off by
  default, on when you want to watch how fast the roast is climbing rather
  than just where the temp sits.
- **Roast drops** — log roasted coffee given or sold to a friend, drawn
  from that roast's roasted-coffee stock, right on the roast page. For
  unplanned "I roasted extra, want some?" gifting. Over-drawing is
  rejected with a clear error; any drop can be undone.
- **Drops (green-coffee group buys)** (`/friends`, `/drops/[id]`) — a
  different, planned kind of drop: reserve a chunk of a bean's green stock
  ("we bought 5lbs, opening it up in ~200g portions") and let friends claim
  portions first-come-first-serve, ahead of actually roasting it. The
  "Drops" nav tab is the hub — start a new drop, see active/past drops with
  a claimed/remaining progress bar, and (below that) every friend who's
  ever gotten a drop of either kind, with their full history and running
  totals. A drop's own page (`/drops/[id]`) is where claims get logged,
  marked paid, or removed (freeing that grams back up). Over-claiming past
  what's left on a drop is rejected the same way over-drawing roasted
  stock is. Fulfilling a claim isn't a checkbox — it draws real roasted
  weight from a completed roast of that bean (creating an actual roast
  drop behind the scenes), so a claim and the roasted-coffee stock it
  eventually comes from stay in sync instead of tracked twice; "Undo"
  reverses that the same way undoing a roast drop does.
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
  grounded in general roasting heuristics, comparisons to your own past
  roasts of that bean (e.g. "your average for this bean is 6:15"), and — if
  you've marked one — a live comparison against that bean's **golden
  roast**: "Golden roast was at 310°F around 0:41 — you're at 305°F (-5°)."
  Mark any completed roast as the golden one for its bean with the ★ toggle
  on that roast's page; future roasts of that bean compare against it
  automatically (falling back to the bean's most recent roast if none is
  set — never to a different bean's data). No LLM call — deliberately
  deterministic, see AGENTS.md for why.
- **Temperature probe (backbone only, no hardware yet)** — a bean-temp
  probe can post readings to `/api/probe/temperature` (bearer-token authed,
  see AGENTS.md) and they'll show up automatically: `LiveProbePanel` polls
  and shows "Connected" the moment readings start arriving, no manual
  toggle, and a completed roast's curve chart draws from those readings
  instead of hand-logged temp events once there are at least two of them.
  What's *not* here yet is the other half — a script that actually reads
  physical hardware and forwards it to that endpoint — since the probe
  itself doesn't exist yet; see AGENTS.md's "Temperature probe" section for
  the full design (why a local bridge script, not the Web Serial API).
- **Cupping notes** — a completed roast gets its own "Cupping" tab
  (separate from the roast/curve view) for logging one or more formal
  tastings, based on the real SCA/Q-grading cupping form. Every field is
  optional — jot down just notes and an Overall score, or fill in the full
  ten-category breakdown (Fragrance/Aroma, Flavor, Aftertaste, Acidity,
  Body, Balance, Uniformity, Clean Cup, Sweetness, Overall, plus a Defects
  deduction) behind a collapsible "Full Q-grading breakdown." The headline
  total score only appears once every category is actually filled in —
  a partial entry never gets a misleading number. A roast can be cupped
  more than once (e.g. day-2 vs. day-7 rest), each session its own row.
- **Brewing** (`/brews`, `/recipes`) — a personal brew journal alongside the
  roasting side, switchable from a Roasting/Brewing toggle in the nav.
  Log a brew against either a roast this app tracked (drawing down that
  session's `roastedRemainingGrams`, same as a roast drop) or a free-text
  bean name for coffee it never roasted — store-bought, or someone using
  only the brewing half. Recipes (`/recipes`) are reusable brewing targets
  (method, dose, water, grind, temp, time) not tied to any one bean;
  picking one when logging a brew prefills those fields, which you can
  still adjust — a brew always records what you actually did, not just a
  reference to the recipe. Unlike everything else in this app, brews are
  **per-person**: each signed-in user only ever sees their own brew
  history (recipes are shared), even though the roasted-coffee stock they
  draw from is one common pool. Star a recipe to pin it to the top of
  `/recipes`, ahead of everything else alphabetically.
- **Dashboard** (`/`) — stats at a glance, or the live timer front-and-center
  if a roast is currently running. A "Running low" banner surfaces any
  bean or completed roast at 15% or less of its stock (the same threshold
  the stock bars themselves use to turn amber) — no new query, just the
  data the dashboard already fetches.
- **Auth** — real per-user login via GitHub or Google (Auth.js /
  `next-auth`, `src/auth.ts`), gated to an allowlist of emails (the
  `AllowedUser` table) rather than open sign-up — OAuth proves who someone
  is, the allowlist decides whether that's enough to get in. Admins manage
  who's allowed in — and who else is an admin — from `/admin` (only linked
  in the nav for admins; `src/lib/admin.ts` / `src/lib/admin-actions.ts`).
  Not per-organization data yet (see AGENTS.md's "Multi-device / sharing
  with a friend" section for the full reasoning and what a real
  multi-tenant version would need) — just real identity instead of a
  shared secret.

## Setup

Copy `.env.example` to `.env` and fill in `AUTH_SECRET` (`openssl rand
-base64 32`) and OAuth app credentials for GitHub and/or Google
(`AUTH_GITHUB_ID`/`AUTH_GITHUB_SECRET`/`AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`
— see AGENTS.md for how to register those apps and the exact callback URL
each one needs). There's no allowlist env var — seed the first admin's
email directly into the `AllowedUser` table after running migrations
(`npx prisma studio` is the easiest way, or `INSERT INTO "AllowedUser"
("id", "email", "isAdmin") VALUES ('seed', 'you@example.com', true);` via
`sqlite3 prisma/dev.db`), then admit everyone else from `/admin` once
signed in. Leave `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN` blank
to use a local SQLite file (`dev.db`), or fill them in to point at the
hosted Turso database instead (`src/lib/prisma.ts` prefers Turso when both
are set) — see AGENTS.md's "Multi-device / sharing with a friend" section
for how that database was set up and a real gotcha worth knowing if it's
ever recreated. From the repo root, `./start.sh` then handles install + DB
setup + dev server in one command (safe to re-run). Or, manually from here:

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

## Deployment & backups

Live at `https://roasting-three.vercel.app`, deployed via Vercel's GitHub
integration — a normal `git push` to `main` deploys automatically, no
separate step. Env vars (Turso credentials, OAuth credentials) are set
directly in Vercel (`vercel env add` /
`vercel env ls`), not committed anywhere. See AGENTS.md's "Multi-device /
sharing with a friend" section for the full setup, including a couple of
non-obvious gotchas worth reading before touching any of this again (a
monorepo Root Directory pitfall, and a Turso CLI import bug).

`./backup-db.sh` (repo root) dumps the live Turso database to a timestamped
file in `backups/` (gitignored, local-only) — run it anytime. `./start.sh`
also runs it automatically before starting the dev server, whenever Turso
is configured, so ordinary use already leaves a fresh local snapshot with
no scheduler or extra permissions involved. (Turso itself also keeps
24-hour point-in-time recovery on the free tier — this is for the gap that
doesn't cover, not the first line of defense.)

## Stack

Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 + Prisma 6 +
Turso (SQLite-compatible).
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
  (`StockAdjuster.tsx`) instead of living in that same form. `goldenRoastId`
  optionally points to one of the bean's own completed `RoastSession`s — the
  target future roasts of this bean get compared against live; set via the
  ★ toggle on a completed roast's page.
- **RoastSession** — one roast against a `Bean`: `startedAt`/`endedAt`,
  green weight, final roasted weight, roast level and rating. `notes` is
  editable at any stage — a plan before/during the roast, a writeup after —
  through separate actions (`updateRoastNotes`, no restrictions on state;
  `updateRoastDetails`, completed roasts only, bundled with weight/level/
  rating) that share the one field. Green stock is
  decremented when a session starts and restored if it's deleted (whether
  abandoned live or removed after the fact). Ending a roast also sets
  `roastedRemainingGrams` to the roasted weight — each session is its own
  roasted-coffee stock entry, shown on its card and on `/roasts/[id]`, with
  the same add/remove/set-exact control as green stock. Only one session can
  be active at a time.
- **RoastEvent** — a timestamped entry within a session (`atSeconds` elapsed
  from `startedAt`): a fan or heat level change, a temperature reading, a
  crack marker, a free note, or the drop event auto-logged when a roast ends.
- **TemperatureReading** — one reading from a connected temperature probe
  (`atSeconds`, nullable for readings recorded before the roast timer
  starts; `tempFahrenheit`; `probeType`, currently always `"bean"`).
  Deliberately separate from `RoastEvent`: a probe posts every few seconds,
  and folding that into the event table/timeline would flood it. "Probe
  connected" is derived from whether recent readings exist, not a stored
  flag — see AGENTS.md's "Temperature probe" section.
- **Sale** — roasted coffee given/sold to a `Friend` from one `RoastSession`
  (called a "drop" in the UI, unrelated to the `DROP` event above — see
  AGENTS.md if that's confusing). Decrements that session's
  `roastedRemainingGrams`; deleting a sale ("Undo") restores it.
- **Friend** — a person drops (of either kind) go to. Created automatically
  (case-insensitive find-or-create) the first time you type their name into
  a roast drop's or a claim's "Friend" field; `/friends/[id]` shows their
  full history across both. Editable (name/notes) and deletable — deleting
  doesn't touch their past sales/claims, it just un-links them (shown as
  anonymous where they came from). Also mergeable — pick another friend on
  their page to fold a near-duplicate (e.g. "Jake" typed once as "Jake S.")
  into it: every sale/claim moves over, then the duplicate is deleted.
- **CuppingNote** — one formal tasting of a roasted coffee, on the
  `/roasts/[id]` "Cupping" tab. A roast can have several (`cuppedAt` per
  session). Every score field is nullable; `computeCuppingTotal`
  (`src/lib/cupping.ts`) only returns a total once all ten Q-grading
  categories are filled in.
- **Drop** — a green-coffee group buy against one `Bean`: `totalGrams`
  reserved out of that bean's stock the moment the drop is created (same
  pattern as starting a roast), an optional suggested `portionGrams` and
  `pricePerGram`, `closedAt` once no more claims should be accepted.
  Deleting a drop restores its reservation and cascades its claims.
- **DropClaim** — one friend's claimed portion of a `Drop`, first-come-
  first-serve (rejected once a drop's `totalGrams` is fully claimed).
  `paid` is a plain manual checkbox. Fulfillment is real, not a checkbox:
  `saleId` links to an actual `Sale` created from a specific `RoastSession`,
  decrementing `roastedRemainingGrams` the same way the roast-drops `Sale`
  flow does. A claim is "fulfilled" exactly when `saleId != null`; undoing
  it deletes the `Sale` and restores the roasted stock.
- **AllowedUser** — one row per email allowed to sign in (`callbacks.signIn`
  in `src/auth.ts` checks this table); `isAdmin` controls access to
  `/admin`, where the table is managed. Replaces the old `ALLOWED_EMAILS`
  env var. Also owns `Brew`s (see below).
- **Recipe** — a reusable brewing target (method, dose, water, grind,
  water temp, brew time), not tied to any bean. Ratio isn't stored —
  cheap to derive from `doseGrams`/`waterGrams` wherever it's shown.
  `isFavorite` pins it above the rest of `/recipes`.
- **Brew** — one logged brew, owned by an `AllowedUser` (private to them,
  unlike everything else in this data model). `roastSessionId` is set when
  it's drawn from this app's own roasted stock (decrementing
  `roastedRemainingGrams` the same way a `Sale` does, restored on delete);
  otherwise `beanName` is a free-text fallback for coffee this app never
  roasted. `recipeId` is only a soft "inspired by" link — method/dose/
  water/etc. are captured directly on the `Brew` so a log reflects what
  actually happened, even if it deviated from the recipe or the recipe
  later changes.

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
   hand-built SVG temperature curve with crack markers, a fan/heat step
   overlay, a hover tooltip, and a toggleable rate-of-rise line — plus a
   [`SalesPanel.tsx`](src/components/roasts/SalesPanel.tsx) for logging
   drops to friends, then the full event timeline
   ([`EventTimeline.tsx`](src/components/roasts/EventTimeline.tsx)) as a
   table — Time / Temp (°F) / Fan / Heat / Event columns, chronological,
   right-aligned numeric columns. Fan/heat changes, milestones, notes, and
   the drop always show; temp readings — most of a real roast's events —
   are evenly down-sampled to about 10 by default (always including the
   first and last) so the temperature trend stays visible without listing
   every single reading, with a "+N more temperature readings" toggle for
   the untouched full log. Milestone rows get a colored dot and
   label matching that milestone's line color on the curve chart, and Fan
   values pick up the same accent color as the curve's fan line, so the
   table and chart read as one connected system. Per-event delete stays
   available on every populated cell but fades to 40% opacity until you
   hover that row.

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

- Nothing here needs serial/USB/Bluetooth hardware access — see AGENTS.md
  for why that's a deliberate choice, not a gap.
- **Chat-platform integration for Drops** (Discord was the example) — click
  "Start a drop" and have a bot post it to a channel, let people
  react/reply to claim a portion, and have those responses turn into real
  `DropClaim`s automatically instead of typing each one in by hand. The
  outbound half (a webhook posting when a drop starts) is straightforward;
  the inbound half is the real work — matching a Discord user to a `Friend`
  record (a new identity-linking problem, probably a stored Discord user ID
  on `Friend`) before a reaction/reply can safely become a claim. Not
  scoped further than this — see AGENTS.md's "Drops" section.
