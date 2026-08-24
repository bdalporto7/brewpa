# AGENTS.md

Guidance for any AI agent (Claude Code, Codex, Cursor, etc.) working in this repo.

## What this repo is

`brewpa` is a **monorepo for coffee-related applications**. It's being restarted
(2026-08) after an earlier single-app attempt. The long-term shape is multiple
independent coffee apps living side by side; today there is exactly one active
app being built.

## Layout

```
brewpa/
├── apps/
│   └── roasting/        # ACTIVE — see below. Bean inventory + live roast sessions built.
├── archive/
│   └── coffee-journal/  # ARCHIVED — full Next.js brew-logging app, not under active
│                         # development. Kept for reference/reuse (schema, components,
│                         # UI patterns). Do not build on top of it without asking first.
├── docs/                 # GENERATED — static pages for published roasts, served by GitHub
│                         # Pages once enabled (Settings → Pages → main /docs). Written by
│                         # apps/roasting's publishRoast action; don't hand-edit.
├── start.sh              # `./start.sh` — installs deps, sets up the DB on first run, then
│                         # runs apps/roasting's dev server. Safe to re-run.
└── AGENTS.md             # this file
```

Each app under `apps/` is expected to be self-contained (its own `package.json`,
own `node_modules`, own deploy story). No shared workspace tooling (npm
workspaces, turborepo, etc.) is set up yet — add it only when a second active
app actually shows up and sharing code becomes a real need. Don't build that
abstraction speculatively.

`archive/coffee-journal` is frozen. It's a working Next.js 15 + React 19 +
Prisma + SQLite app for logging coffee *brews* (not roasts) — useful as a
reference for Prisma/Next patterns already proven out in this repo, but not
part of the active build. If we ever revive it, treat that as a deliberate
decision, not an incidental side effect of touching shared code.

## Active app: `apps/roasting`

A **local coffee roasting app**, built first and specifically for a **Fresh
Roast SR800** — a home roaster with a manual fan-speed dial and heat-level
dial, no digital output of its own. Scope, current priority order:

1. **Bean & inventory tracking** — green bean stock, sourcing/lot info, and
   how much of a batch got used per roast, so inventory drops when a roast
   starts. Built (`/beans` list — 4 sections, In/Out of Stock × Green/Roasted,
   one card per *bean* in every section including Roasted, which aggregates
   across that bean's roast sessions rather than listing each one; `/beans/[id]`
   for full detail — green stock, aggregate roasted stock, every past roast).
2. **Live roast sessions** — the core of the app. Starting a roast doesn't
   start the timer — it creates a *pending* session (bean and green weight
   picked, stock already decremented) and opens a setup screen where the
   roaster dials in starting fan/heat with no clock running; the timer only
   starts once they tap "Begin Roast." While live, the roaster (the person)
   logs events in real time as they happen: fan level changes, heat level
   changes, temperature readings (from a separate probe/thermometer — the
   SR800 has none built in), and milestone markers (see "Roast phases &
   tips" below for the full Scott Rao set), plus free notes. This is
   **manual data entry against a live clock**, not a hardware integration —
   the human is relaying what they see and do on the physical roaster. See
   the note below on why this doesn't need serial/USB access. Built
   (`/roasts/[id]`, three states — pending / live / completed, see "Roast
   lifecycle" below; only one pending-or-live session at a time).
3. **Roasting curve** — once a session ends, its events render as a graphed
   curve: temperature over time, with fan/heat level as a step overlay and
   crack events as vertical markers. This is the payoff view — it's what
   makes the live logging in step 2 worth doing. Built as a hand-rolled SVG
   component (`RoastCurveChart.tsx`), not a chart library — keep it that way
   unless a real need for interactivity (zoom, tooltips) comes up.
4. **Drops & friends** — roasted coffee gets given/sold to friends
   ("drops"), tracked per-roast and per-person so both "who got coffee from
   this roast" and "what has this person gotten across every roast" are
   answerable. Built (`Sale` + `Friend` models, `/friends`, `/friends/[id]`,
   the Drops panel on `/roasts/[id]`) — see the sections below for detail.
5. **Export & publish** — a completed roast can be downloaded as CSV
   (`/roasts/[id]/export`) or published as a static page to this repo's
   GitHub Pages site. Built — see "Export & publish" below.
6. **Backfilling roasts** — two ways to get a roast into the app that wasn't
   (fully) logged live: `LogPastRoastForm` on `/roasts` creates a session
   already completed (bean, weights, a past start time + duration, level,
   rating) in one form; `AddEventForm` on any completed roast's page lets
   you add individual events afterward with a manually-typed elapsed time
   instead of a live timer. A one-time bulk import of 34 real historical
   SR800 roasts (from a personal spreadsheet) used this same data model but
   was done with a throwaway script, not through these forms — see "Bulk
   historical import" below for what that revealed.
7. **Roast phases & live tips** — Scott Rao's three-phase roast breakdown
   (drying / Maillard-browning / development) computed from existing
   milestone events, shown on every completed roast and live during one; a
   small rule-based tips panel surfaces during a live roast. Built — see
   "Roast phases & tips" below.
8. **Cupping notes** — a separate evaluation of a roasted coffee, done
   (often days) after the roast itself, based on the SCA/Q-grading form. A
   completed roast has its own "Cupping" tab (`/roasts/[id]?tab=cupping`)
   for logging one or more cupping sessions. Built — see "Cupping notes"
   below.

**Why this isn't a hardware-integration problem:** the SR800 has no data
output — everything logged comes from the person watching the roaster and
tapping the screen. So there is no serial/USB/Bluetooth question to resolve
here; a plain local web app with a client-side timer (elapsed time computed
from a stored `startedAt`) is the whole solution. Revisit this only if a
different roaster with actual telemetry enters the picture.

**Runtime target:** local-first, localhost-only web app. Desktop packaging
(e.g. Tauri) is a possible later wrapper, not a current need — nothing here
should assume it.

**Stack:** Next.js 15 (App Router) + TypeScript + Tailwind CSS v4 + Prisma 6 +
SQLite, using Server Actions for mutations (no separate REST API layer — see
`src/lib/actions.ts`). Matches what `archive/coffee-journal` already proved
out in this repo. Prisma models: `Bean` (green bean inventory —
`remainingGrams` tracked separately from `weightGrams`; `updateBean` edits
the descriptive fields plus `weightGrams` itself — a correction to "how big
was the purchase," validated to never drop below current `remainingGrams`.
This matters in practice: the bulk historical import approximated
`weightGrams` as the sum of that bean's roast doses, which is frequently
wrong once the real bag size is known — e.g. a 2lb/907g bag where only
`remainingGrams` had been corrected via `StockAdjuster`'s "set exact,"
leaving `weightGrams` stuck at whatever the import guessed, showing a
nonsensical "454g left of 454g." Fixing that needs both numbers touched
independently — `remainingGrams` via `StockAdjuster`, `weightGrams` via the
"Total purchased" field in the full edit form — which is exactly why they're
separate mechanisms rather than one combined control. `remainingGrams`
itself moves via roast actions *or* `StockAdjuster` below), `RoastSession`
(one roast against a `Bean` —
`startedAt`/`endedAt`, green weight, final roasted weight, roast level, and
rating; green stock is decremented when a session starts and restored if
it's deleted or abandoned), and `RoastEvent` (a timestamped log entry within
a session — `atSeconds` elapsed, a `type` — including `DRY_END`, the
drying/Maillard boundary, see "Roast phases & tips" below — and whichever of
`fanLevel` / `heatLevel` / `tempFahrenheit` / `note` applies to that type).

**Manual stock correction (`StockAdjuster.tsx`):** both `Bean.remainingGrams`
and `RoastSession.roastedRemainingGrams` can be corrected by hand — on
`BeanCard`/the bean detail page for green, in `SalesPanel` for roasted.
Add/remove (a delta) is the primary interaction, since that's how a roaster
actually thinks about it ("used 12g", "another bag came in") — "set exact
amount" is a secondary fallback for full recounts. The two modes are
deliberately **not** the same operation with different framing:
- **Add/remove** (`adjustBeanStock`/`adjustRoastedStock`) moves the total
  (`weightGrams`/`roastedWeightGrams`) by the same delta as remaining, so the
  gap between them — how much has actually gone through a roast, or been
  dropped — stays fixed. This is coffee genuinely entering or leaving your
  possession: another bag arrived, some spoiled, you brewed 12g at home. It
  is *not* what a roast starting/ending does — that's a different code path
  (`startRoast`/`endRoast`) that only ever touches remaining, since roasting
  doesn't remove coffee from existence, it converts it.
- **Set exact** (`setBeanStock`/`setRoastedStock`) only touches remaining —
  a recount says "I currently have exactly X," which says nothing about how
  big the original purchase/roast was.

Both paths reject a negative result with a clear error rather than clamping
silently. This is also how the "used 20g for a brew, no money changed hands"
gap (noted below under Sales) gets covered in practice — just remove that
amount directly rather than logging a `Sale` with no buyer.

**Roasted-coffee stock:** dropping a roast (`dropRoast`) just sets `endedAt`
and logs the `DROP` event — no weight is known yet at that instant, since the
whole point is that dropping happens immediately, before the roaster has
weighed anything. `roastedWeightGrams`/`roastedRemainingGrams` get filled in
afterward via `updateRoastDetails` (also handles `roastLevel`/`rating`/
`notes`), which can be called again later to correct the weight — in that
case it preserves however much has already been sold/given away rather than
resetting it (same "total moves, gap to remaining stays fixed" logic as
`adjustBeanStock`, reused here for a different total). Green weight moves out
of `Bean.remainingGrams` at roast *start* regardless. Each roast session is
its own roasted-stock ledger entry (no separate model) since roasted coffee
is roast-specific, not blended across sessions.

**Sales ("drops"):** a `Sale` is roasted coffee given/sold to a `Friend` from
one `RoastSession` — `weightGrams`, optional `friendId`/`price`/`notes`,
`soldAt`. `recordSale` decrements that session's `roastedRemainingGrams` in a
transaction (rejecting if it would go negative); `deleteSale` ("Undo" in the
UI) restores it. Deleting a `RoastSession` cascades its `Sale`s — the whole
roasted-stock ledger for that roast goes with it, which is correct since the
stock itself no longer exists. **Naming note:** the user calls a sale event a
"drop" (as in a small-batch release to friends) — that's the UI copy
("Log a drop", the "Drops" section). Don't confuse this with the unrelated
`DROP` `RoastEvent` type, which marks the moment a roast ends (dropping the
beans from the roaster). Same English word, two different things in this
codebase — keep them in their own layers (`Sale` vs. `RoastEvent`) and don't
merge them.

**Friend:** a person drops go to, so a roast → drop → person chain is
traceable both directions — `/friends` lists everyone with aggregate
grams/spend, `/friends/[id]` lists every drop they've gotten linked back to
its roast, and each roast's Drops panel links its recipients back to
`/friends/[id]`. `recordSale` find-or-creates a `Friend` by name (typed into
a free-text field with a datalist of existing names for autocomplete — no
separate "add friend" step). The match is **case-insensitive** ("jake" reuses
"Jake") — that's deliberate, done in JS by fetching all friends and comparing
lowercased names rather than a DB-level query, since SQLite's default text
comparison is case-sensitive and Prisma's `mode: "insensitive"` isn't
available on the SQLite provider. Fine at personal-hobby scale (dozens of
friends, not thousands); revisit if that stops being true.

`/friends/[id]` has edit (name + notes, via `updateFriend`) and delete (via
`deleteFriend`) — the same inline-toggle pattern as `BeanCard`
(`FriendHeader.tsx` / `FriendEditForm.tsx`). Deleting a friend does **not**
cascade their `Sale`s (that's the whole point of `onDelete: SetNull` on
`Sale.friendId`) — past drops stay on their roast, just anonymized, which is
what the confirm dialog tells the user before they do it. Renaming fixes a
typo going forward (the next drop for that name will match again), but there
is **no merge**: if a typo already created a near-duplicate `Friend` (e.g. a
missing middle initial slipping past the case-insensitive match), their
history is split across two `Friend` rows and editing a name doesn't move
`Sale`s between them. Add a real merge action (reassign one friend's `Sale`s
to another, then delete the empty one) if that comes up.

**Export & publish:** two ways to get a completed roast out of the app.
`/roasts/[id]/export` (a route handler, `src/app/roasts/[id]/export/route.ts`)
streams a CSV — a metadata block (bean, weights, level, rating, duration)
followed by the full event table (`src/lib/csv.ts`). `publishRoast`/
`unpublishRoast` (in `actions.ts`) render a self-contained static HTML page
(no build step, inline `<style>`, no JS) to `docs/roasts/<id>.html` via
`src/lib/publish.ts`, toggle `RoastSession.publishedAt`, and regenerate
`docs/index.html` from every currently-published session. The roasting-curve
SVG is generated by `buildRoastCurveSvg` (`src/lib/curve.ts`) — a single pure
function shared by the live React chart (`RoastCurveChart.tsx`, via
`dangerouslySetInnerHTML`) and the static page, so they can't drift apart;
if you touch the curve's visuals, this is the one place to do it.
`curve.ts` also exports `getCurveReadings`/`getChartLayout` (the same pixel
math `buildRoastCurveSvg` draws from) so `RoastCurveChart.tsx` — now a
client component — can compute an interactive overlay (hover crosshair +
tooltip showing time/temp/fan/heat, snapped to the nearest real reading,
never interpolated) without duplicating that math and risking it drifting
from what's actually drawn. The static published page has no JS by design
(see "Not built yet" style notes elsewhere) and deliberately doesn't get
this — hover is a live-app-only affordance.

**Rate of rise (RoR)** is a toggleable second line on the same chart — °F of
temp change per minute between consecutive real readings, computed in
`getCurveReadings` (`rorPerMin` on `CurveReading`, `null` for the first
reading since there's no prior point to measure from) and plotted on its own
right-side axis via `getChartLayout`'s `yRor`/`minRor`/`maxRor`. It's off by
default; `RoastCurveChart.tsx` holds the toggle as local state and passes
`{ showRor }` straight into `buildRoastCurveSvg`, which is cheap to do since
that function is pure and already re-runs in a `useMemo` keyed on its
arguments — no separate SVG-generation path for the toggled state, no DOM
class-toggling hack. `CHART_MARGIN_RIGHT` stays wide enough for the RoR
axis's tick labels *whether or not RoR is currently shown*, specifically so
toggling it never reflows the temp curve next to it. The axis range comes
from the 5th/95th percentile of `rorPerMin`, not the true min/max: two
readings logged close together (most often the first two, before intervals
settle into a rhythm) can produce a RoR wildly outside the rest of the roast
— real early data, e.g. 253°F to 296°F in 15 seconds is a genuine 172°F/min
spike — and a true-max axis would stretch to fit that one point, squashing
every other point into a sliver at the bottom. Percentile trimming lets that
outlier still plot (it clips at the frame if it's still outside the trimmed
range) without letting it dictate the scale everyone else has to share.
`--ror` (`globals.css`, mirrored in `publish.ts`'s inline copy per the usual
"static page keeps its own copy of these tokens" rule) is the one
deliberately cool tone in an otherwise warm palette — distinct from
`--accent` (the temp line) rather than a shade of it, since the two series
need to read as clearly separate at a glance. The hover tooltip gets a third
row (RoR value, `"—"` if the hovered point is the first reading) only when
the toggle is on, so it doesn't show a stat for a line that isn't drawn.

`EventTimeline.tsx` renders as a real `<table>` — columns Time / Temp (°F) /
Fan / Heat / Event, chronological, right-aligned tabular-numeral numeric
columns, blank (not `—`) empty cells. Went through a few readability passes
before landing here (chip pills grouped by timestamp, then a plain table of
every event) and the real fix turned out to be **filtering, not
formatting**: most of a real roast's events are solo temp readings (one
every 10-15s) with nothing else happening at that instant, so no amount of
row-tightening made a 50-row table of mostly-repetitive numbers read as
short. First cut of that filter dropped *every* temp-only row by default,
which went too far the other way — the whole point of a roast log is
watching temp climb, and hiding all of it entirely lost that. Landed on
down-sampling instead of an all-or-nothing filter: fan/heat changes,
milestones, notes, and drop always show (never sampled — they're already
sparse and are exactly what shouldn't get thinned out); temp-only rows get
evenly sampled down to `DEFAULT_TEMP_ROWS` (10) when there are more than
that, always keeping the first and last reading so the visible range is
never a guess (`sampleEvenly` in `EventTimeline.tsx`) — the same trade-off
a metrics/log viewer makes when it can't render every point: dense enough to
see the trend, short enough to scan. A "+N more temperature readings"
toggle at the bottom (`useState`, `EventTimeline` is now a client component)
expands to the untouched full log for edits/corrections. Milestone rows
get a small colored dot + colored label text using the exact same
`--mark-*` tokens `curve.ts` uses for that milestone's line on the chart —
one palette, so the table and the chart read as the same system rather than
coincidentally similar. Fan values render in `var(--accent)` for the same
reason (matches the fan line/legend on the curve); Heat and Temp stay
plain since there's no equivalent secondary accent reserved for them
elsewhere. Delete stays on every populated cell but sits at 40% opacity
until you hover that row (never fully hidden, so it's still reachable on
touch, where hover doesn't fire) — same `DeleteButton` `variant="icon"`,
just de-emphasized. This is live-app-only — `publish.ts` builds its own
one-row-per-event `<ol>` for the static page directly (not via this
component), left as-is since that page is a simpler, skimmable summary
rather than a working log; revisit
if that page's timeline ever needs the same treatment. All
user-entered text (bean name, notes, friend names) is HTML-escaped when
building the static page — it's going to a **public** page, so that's a real
XSS boundary, not just tidiness. `GITHUB_PAGES_BASE_URL` in `publish.ts` is
hardcoded to `bdalporto7.github.io/brewpa` — this app is single-repo,
single-user, so that's deliberate, not a TODO.

One thing this still doesn't do: enable GitHub Pages itself (one-time manual
step — see below, since it turned out to need more than a settings toggle).

**Publish/unpublish now commit and push `docs/` automatically**
(`syncGeneratedDocs` in `src/lib/git.ts`, called from `publishRoast`/
`unpublishRoast`/the published-roast branch of `deleteRoastSession`). This
wasn't the original design — publishing used to write local files only and
leave committing/pushing as a manual step, because there was no confirmed
`git push` access when that was built. That gap caused a real incident: a
roast got published, the local `docs/` write never made it into git, and an
iCloud sync event on this repo's Documents-folder location (see "Bulk
historical import" era notes and the general iCloud-duplicate-file gotcha)
silently reverted both the generated HTML and the session's `publishedAt`
flag, leaving a dead link the user had already shared. `syncGeneratedDocs`
closes that gap: `git add -- docs`, check `git status --porcelain -- docs`
(skip commit/push if nothing changed, e.g. republishing identical content),
`git commit`, `git push`, run via `execFile` with argument arrays (never a
shell string) since the commit message is built from user-entered bean
names. Two things worth knowing about how failure is handled:
- **`publishRoast`/`unpublishRoast` fail loudly.** If the git steps throw
  (no remote, diverged history, auth), the `publishedAt` write is rolled
  back before the error propagates, so the UI never claims something is
  live that isn't — the whole point of building this. `PublishControl.tsx`
  (replacing the old plain `<form action={...}>` publish/unpublish buttons)
  is a client component with real error display via `useTransition`, the
  same pattern as `DropRoastButton`/`DeleteButton`, since a git failure is
  now a genuinely expected failure mode, not a hypothetical.
- **`deleteRoastSession`'s cleanup is best-effort.** The roast row is
  already gone from the DB by the time it removes a published page, so
  there's nothing meaningful to roll back to — a sync failure there just
  logs and leaves the stale page live until the next successful publish/
  unpublish resyncs `docs/`, rather than blocking the (already-committed)
  deletion on a network call.

**Gotcha this surfaced, worth remembering for any future client component
near publishing:** `src/lib/publish.ts` imports `node:fs/promises` at module
top level. That's fine when only Server Components/Actions import from it,
but `PublishControl` originally imported `roastPageUrl` from `publish.ts`
directly, and Turbopack tried to bundle the whole module — including `fs`
— for the browser and hard-panicked (not a normal caught error; it took the
whole dev server down and needed a restart). Fixed by splitting the two
pure URL-building exports (`GITHUB_PAGES_BASE_URL`, `roastPageUrl`) into
`src/lib/publish-url.ts`, a tiny module with no Node built-ins, which
`publish.ts` now re-exports for server-side callers and `PublishControl`
imports directly. Any new client component that needs something from
`publish.ts` should pull it from `publish-url.ts` instead, or extract it
there — don't import from `publish.ts` itself in client code.

**Enabling GitHub Pages needed more than a settings toggle.** This repo was
private, and GitHub Pages on a private repo requires a paid plan — the API
call to enable it returned "Your current plan does not support GitHub Pages
for this repository." The user chose to make the repo public (confirmed
explicitly first, after checking no `.env`/credentials/DB files were
tracked) rather than pay or find another host; Pages was then enabled via
`gh api repos/bdalporto7/brewpa/pages -X POST -f "source[branch]=main" -f
"source[path]=/docs"`. Worth knowing if this ever needs redoing (e.g. a
fresh repo): private-repo Pages just isn't available on the free tier, full
stop — don't spend time debugging settings before checking plan/visibility
first.

**Bulk historical import:** 34 real roasts came from the user's own
spreadsheet (the "mikelipino Fluid Bed Roast Log" template, a known public
SR800 template — one sheet per roast, ~5s-interval log table). That was a
one-time migration, done with a throwaway Python-extraction +
Node/Prisma-write script, not a reusable in-app feature — the scripts aren't
in this repo. Worth knowing if more of the user's historical data shows up
later: the source data was genuinely messy in ways worth re-checking for —
Excel stored roast-milestone times inconsistently (sometimes a `timedelta`,
sometimes a misparsed `time` object where "5:23" meant 5 minutes 23 seconds
rather than 5:23:00, sometimes a bare number that was ambiguously either raw
seconds or whole minutes depending on magnitude), and there was at least one
plain data-entry error in the source (a temperature value typed into the
wrong column, which read as an impossible heat-dial setting of 447 — dropped
rather than guessed). Bean identity also isn't reliable from free text alone:
the same coffee got called "Washed Halo Beriti", "Halo Beriti Washed", and
"Ethiopia Halo Beriti" across different sheets, which needed explicit
normalization before the "merge same-named beans" behavior did anything
useful — exact-string matching alone would have fragmented it into three
near-duplicate `Bean` rows.

**Roast lifecycle:** a `RoastSession` is pending (`startedAt` null,
`endedAt` null) → live (`startedAt` set, `endedAt` null) → completed
(`endedAt` set), not just live/completed. `startRoast` creates the pending
session (bean + green weight picked, stock decremented immediately — same
as before) and redirects to `/roasts/[id]`, which renders `RoastSetupPanel`
for that state: fan/heat steppers with plain local `useState`, no
`RoastEvent`s written per tap (unlike the live `EventLogPanel`, which fires
a server action on every change) — nothing is timestamped yet because
there's no `startedAt` to measure elapsed time from. `beginRoast` is the
transition: sets `startedAt = now()` and writes the chosen fan/heat as
`atSeconds: 0` events in one transaction, which is what actually starts the
clock the rest of the app measures against. This exists because the timer
starting the instant "Start" was clicked (the original behavior) was wrong
for how this app is actually used — you need a moment to dial in the
roaster's dials before the roast itself begins, and that setup time isn't
part of the roast. Ending a roast got the same treatment in reverse:
`dropRoast` sets `endedAt` and logs the `DROP` event with one click and
nothing else, so the transition to completed happens the instant the beans
actually come out of the roaster, not whenever the roaster finishes typing
in a weight. `RoastDetailsForm` (roasted weight, roast level, rating, notes)
renders on the now-completed page as a separate step, auto-expanded when
nothing's been filled in yet — `updateRoastDetails` is a second,
independently-callable action, re-editable afterward via the same form. This
mirrors the pending→live split (`startRoast`/`beginRoast`): don't make
someone fill out a form before the thing they're actually doing can start or
stop; let the form come after, on its own time. `startedAt` being nullable now (was `@default(now())`,
migration `nullable_started_at`) touches everywhere a `RoastSession` is
read: anything scoped to completed roasts (CSV, publish, `computeHistoricalBaseline`,
the dashboard's month/recent-roasts queries) is safe with a `!` assertion
since `endedAt` implies `startedAt`; anything that can see a pending session
(`RoastSessionCard`, both `activeSession` banners on `/` and `/roasts`) has
to actually branch on it being null, not just assert past it.

**Roast phases & tips:** `computeRoastPhases` (`src/lib/phases.ts`) is a pure
function deriving Scott Rao's phase breakdown — drying (charge → `DRY_END`)
→ yellowing (`DRY_END` → `YELLOWING_END`) → browning/Maillard
(`YELLOWING_END` → `FIRST_CRACK_START`) → development (`FIRST_CRACK_START`
→ drop) — from whatever milestone events exist; any phase whose boundary
events aren't logged comes back `null` rather than guessed, **except**
`browningSeconds`, which falls back to spanning the whole
`DRY_END`→`FIRST_CRACK_START` window when `YELLOWING_END` wasn't logged —
that milestone was added after `DRY_END`/`FIRST_CRACK_START` already
existed, so every one of the 34 historical-import roasts only has the
coarser two-milestone data, and would otherwise lose its whole middle phase
from the bar. There's no separate "browning end" marker — by definition
browning ends exactly when first crack starts, so logging `FIRST_CRACK_START`
already marks it; adding a redundant button for the same instant would just
invite two slightly-different timestamps for one event. `PhaseBar.tsx`
renders it (used on completed roasts, on a live roast via `LiveTipsPanel`,
in the CSV, and as one more stat on the published static page).
`generateLiveTips` (`src/lib/tips.ts`) is a small, deliberately
rule-based set of live prompts during a roast — no LLM call, by design (this
was a real decision point, confirmed with the user: reliability, no external
dependency, and no risk of confidently-wrong advice on something that can
ruin a batch, mattered more than open-ended flexibility here). Two kinds of
rules: generic ones with hedged, general-heuristic numbers, and personalized
ones grounded in the roaster's own history. **The generic ones are held to a
real bar**: the user explicitly asked that any claim attributed to Scott Rao
be checked against a real source, not recalled from training data and
asserted — this came up because the DTR figure was initially written as
"commonly cited around 15–25%" from memory, which was close but wrong; a web
search turned up Rao's own post confirming **20–25%** as his actual target
(lower on high-powered roasters), at
[scottrao.com/blog/2016/8/25/development-time-ratio](https://www.scottrao.com/blog/2016/8/25/development-time-ratio),
and that's what's in the code now. The drying → yellowing → Maillard/browning
phase structure itself checked out too (chlorophyll breakdown turning beans
yellow, then Maillard reactions turning them tan → brown), and the SR800's
1–9 fan/heat range is a real hardware spec, not an assumption — both
confirmed via search rather than left on recall. If another generic
(non-personalized) claim gets added to this file, verify it the same way
first — recalled-and-hedged is not good enough once it's presented as
someone's actual guidance. Personalized rules are grounded in the roaster's
own history
(`computeHistoricalBaseline` averages dry-end/first-crack/duration from past
completed roasts of the *same bean*, falling back to all beans if that bean
has no history yet) — e.g. "your average for this bean is 6:15" is a real,
checkable fact about this roaster's own data, not a generic claim, and is
the more defensible half of what the tips panel says. If this list of rules
grows, keep that split intentional — the personalized/grounded-in-real-data
tips are safe to expand freely; a new generic numeric heuristic should only
go in if it's genuinely well-established, hedged the same way, and not
something represented as more precise than it is. As of this writing there's
a third kind alongside generic and personalized: a live comparison against
one specific reference roast (see "Golden roast" below) — grounded in real
data like the personalized rules, but about a single chosen roast rather
than an average.

**Live-view ergonomics:** two small additions address "the timer/plan
scrolls out of view while you're logging events." `LiveTimerBar.tsx` wraps
the hero `Timer` with an `IntersectionObserver` on it; once it scrolls out
of the viewport, a fixed bar takes over showing bean name + ticking elapsed
time. Deliberately two separate elements rather than one that shrinks on
scroll — keeps the hero timer's full size while it's in view (it's meant to
dominate the screen, per the design-standards section below) without
needing a scroll-linked resize animation. The pinned bar was initially a
slim, muted status strip and the user asked for it louder — glancing over
from across the room while watching the physical roaster is the actual use
case, not confirming-on-close-inspection that it's still there — so it's now
a solid `bg-accent` band with large bold digits, closer to an alert banner
than nav chrome. `RoastPlanCard.tsx`
puts `RoastSession.notes` — the same field `RoastDetailsForm` edits after a
roast ends — in front of the roaster *before* and *during* a roast too, via
a new standalone action (`updateRoastNotes`, no completed-roast gate, unlike
`updateRoastDetails`). Auto-opens for editing when there's no plan yet, and
stays visible (not collapsed behind an "Edit" click) once one exists, since
the whole point is having it to glance back at mid-roast.

**Golden roast:** a bean can have one explicitly-marked roast
(`Bean.goldenRoastId`, a nullable self-referencing-through-RoastSession FK,
`onDelete: SetNull`, migration `add_golden_roast`) that future roasts of
that bean get compared against live — set via a star toggle
(`GoldenRoastToggle.tsx` / `setGoldenRoast` action) on any completed roast's
page. Deliberately explicit rather than always-just-the-most-recent-roast:
"the roast that went well" and "the roast that happened most recently"
aren't the same roast, and conflating them would make the comparison
actively misleading after a bad batch. `setGoldenRoast` validates the
session belongs to the bean being updated and is completed before allowing
it — a golden roast that's still live or belongs to a different bean isn't
a coherent state. The live comparison itself (`ReferenceRoast` type,
`generateLiveTips` in `tips.ts`) reuses `nearestCurveReading` — the exact
lookup the hover tooltip uses (promoted out of `RoastCurveChart.tsx` into
`curve.ts` for this reason) — to find the reference roast's closest logged
point to the current elapsed time, and surfaces it as one more live tip:
`"Golden roast was at 310°F around 0:41 — you're at 305°F (-5°)."` Falls
back to the bean's most recent completed roast (labeled "Last roast"
instead) when no golden roast is set — but **never** falls back across
beans the way the averages-based `baseline` does, since a different bean's
temp curve isn't a meaningful target regardless of how little history this
bean has. No curve-overlay version of this exists yet (`RoastCurveChart`
doesn't currently render during a live roast at all, only once completed) —
the live tip line was the right-sized first cut; revisit if a visual
overlay turns out to matter more than the text comparison.

**Cupping notes:** `CuppingNote` (migration `add_cupping_notes`) is a
one-to-many off `RoastSession` — a roast can be cupped more than once (e.g.
day-2 vs day-7 rest are genuinely different tastings), each session its own
row with its own `cuppedAt`. Every score field is nullable by design: the
user explicitly asked for "fields can all be optional... user can just add
basic notes and score if they want," so `src/lib/cupping.ts`'s
`computeCuppingTotal` only returns a real total when *all ten* Q-grading
categories are filled (same "null rather than guessed" rule
`computeRoastPhases` already uses) — a partial entry is a fully valid,
expected state, not an incomplete one waiting to be finished.
Fragrance/Aroma, Flavor, Aftertaste, Acidity, Body, Balance, and Overall
keep the real SCA form's 6-10 (0.25-increment) scale; Uniformity/Clean
Cup/Sweetness are simplified from the professional protocol's 5-identical-
cups-per-category setup (2 points each cup) down to one 0-10 score each,
since a home roaster tasting their own single pot of coffee isn't running a
cupping lab. Verified the category list and scoring structure against real
sources before building this (`royalny.com`'s cupping-form guide) rather
than reconstructing it from memory — the same bar as the DTR figure
correction above.
`CuppingNoteForm.tsx` only ever shows Notes + Overall by default; the other
nine fields sit behind a native `<details>` disclosure (open automatically
only when editing a note that already has one of them filled) — no client
JS needed for the collapse/expand itself, `ActionForm` is the only reason
this component needs `"use client"` at all. `/roasts/[id]` gained real tab
navigation for this (`?tab=cupping`, a plain searchParam so it's linkable
and needs no client state) — "Roast" (the existing curve/phases/events
view) and "Cupping" are peers, both server-rendered from the same page
based on which tab is active; only shown once a roast is completed, since
cupping an unfinished roast isn't a coherent action.
**Gotcha hit while building this:** a `type="date"` input's value
(`"2026-08-24"`, no time component) parses as **UTC midnight** per the
ECMAScript spec — formatting it back out in a timezone behind UTC displays
as the *previous* day, silently off-by-one from what the user actually
picked. Fixed in `addCuppingNote` by appending a bare `T00:00` (no `Z`/
offset) before constructing the `Date`, which forces local-midnight parsing
instead — caught by actually entering today's date and checking what
rendered, not by reading the code.

**Gotcha:** after `prisma migrate dev` (or any schema change), restart the
Next dev server. The regenerated Prisma Client on disk doesn't get picked up
by an already-running process — you'll see `PrismaClientValidationError:
Unknown field` or similar until you restart.

## Design standards

The single biggest risk for a Claude-built app is that it looks like every
other Claude-built app: default Tailwind grays, a lonely accent color,
identical rounded-lg bordered cards for everything, emoji standing in for
icons, no real point of view. Treat visual design as a real requirement, not
a wrapper around the data model. Concretely:

- **Own palette, not defaults.** The app has a defined warm/roast-inspired
  palette in `globals.css` (`@theme inline` tokens) — parchment/cream
  background, espresso-brown ink, a single rust/amber accent used
  *functionally* (primary actions, active/live state) rather than
  decoratively. Don't reach for Tailwind's default `gray-*`/`blue-*` palette
  directly in new components — use the tokens.
- **No emoji as icons.** Use `lucide-react` (already a dependency) for every
  icon. Emoji are fine in copy the user writes (notes, bean names), never as
  UI chrome standing in for an icon.
- **Shared primitives, not copy-pasted markup.** Inputs, selects, labels, and
  buttons live once in `src/components/ui/` and get reused. If you're about
  to paste the same `className` string into a third file, stop and make it a
  component instead — repeated ad hoc markup is exactly what makes an app
  read as generated rather than designed.
- **Numerals get a monospace face.** Timer, temperature, weights, and other
  live-updating numbers use the mono font token so digits don't jitter in
  width as they change.
- **Hierarchy is deliberate.** Every screen should have one obvious primary
  action and a clear "most important thing right now" (e.g. the live timer
  during an active roast dominates the screen — it is not one stat tile
  among five). Don't default to a uniform grid of equally-weighted cards
  because that's the easy layout.
- **Design empty/loading/error states on purpose**, not as an afterthought —
  they're not just "no data yet" text dumps.
- **Before calling a UI change done**, look at it rendered (this repo has
  browser tooling for that — use it) and ask: does this look like a specific
  product for a specific roaster, or could it be the placeholder output of
  any CRUD generator? If it's the latter, it's not done.

## Conventions

- TypeScript everywhere, no exceptions, no `any` without a comment explaining why.
- Prefer SQLite for local dev DBs (zero-setup, matches the pattern already
  proven in `archive/coffee-journal`); only reach for Postgres when there's an
  actual deployment target that needs it.
- No speculative abstractions across apps until there are genuinely 2+ active
  apps that need to share something concrete.
- Keep each app's README up to date with its own setup/run instructions —
  don't rely on this file for per-app specifics once an app exists.

## Multi-device / sharing with a friend

The app was local-only by design (see the "Runtime target" note above) until
the user wanted a friend to be able to use it too, which needs the database
and the app itself reachable from more than one machine. Live at
`https://roasting-three.vercel.app`. What actually got built, in order:

1. **Auth (done, twice — see below).** Deploying anything public means the
   app is no longer gated by "you have to be on my laptop" — something has
   to replace that. First cut was a single shared password
   (`src/lib/auth.ts`, HMAC-signed session cookie via the Web Crypto API).
   The user then asked for real per-user identity instead — each person
   signs in with their *own* GitHub or Google account (they don't share
   one) rather than both typing the same secret — plus wanted the door open
   to other coffee businesses joining someday, which raised a bigger
   question: full multi-tenancy (an `Organization` model, every table
   scoped to one, an admin invite/approve flow) is a genuinely large
   project, not a tweak. Landed on a middle ground, explicitly chosen over
   building the whole thing speculatively: **real OAuth now, multi-org
   later, only if a second organization actually shows up.** `src/auth.ts`
   (Auth.js v5 / `next-auth@beta`) wires up GitHub and Google as providers;
   `callbacks.signIn` rejects any authenticated identity whose email isn't
   in the `ALLOWED_EMAILS` allowlist — so a GitHub/Google login can fully
   succeed as authentication and still be denied a session, which is the
   "OAuth proves who, the allowlist decides if" split the user asked for
   explicitly. `callbacks.authorized` (checked by `src/proxy.ts` on every
   request) is what actually gates page access — no valid session, no data,
   full stop. Still no `Organization`/`User` table: the allowlist is just
   an env var (`ALLOWED_EMAILS`, comma-separated), which is exactly the
   right amount of infrastructure for "a fixed, small set of known people"
   and exactly the wrong amount for "let people request access" — revisit
   when that distinction actually matters.

   **`middleware.ts` → `proxy.ts`:** this app runs Next.js **16.3.2** (see
   the top-of-file banner — genuinely not the Next.js most training data
   describes), where `middleware.ts` was renamed to `proxy.ts` and Proxy
   now defaults to the **Node.js runtime**, not Edge. `middleware.ts` still
   works (deprecated, not removed) but the new file was built as `proxy.ts`
   directly rather than starting from the deprecated convention. This also
   means the earlier password-auth version's reason for using Web Crypto
   over Node's `crypto` module (Edge-runtime portability) no longer applies
   under this Next version — moot now since that file's gone, but worth
   knowing if a similar signing need comes up again here.

   Known minor gap, unchanged from before: the nav bar (with a working
   "Log out") still renders on `/login` before you've signed in —
   cosmetically odd, not a security hole (`proxy.ts` still gates every real
   page regardless of what the nav shows), just not fixed yet; would need
   pulling `Nav` out of the root layout into a route-group layout that
   `/login` sits outside of.

   **What the user still needs to do:** register an OAuth app with GitHub
   (github.com/settings/developers → New OAuth App) and one with Google
   (Google Cloud Console → APIs & Services → Credentials → OAuth client ID,
   type "Web application"), each with callback/redirect URI
   `http://localhost:3000/api/auth/callback/github` (or `/google`) for
   local dev — add the equivalent with the real Vercel domain once deployed
   (both providers support multiple registered redirect URIs on one app, no
   need to create a second app for production). Resulting client
   ID/secret pairs go in `.env` as `AUTH_GITHUB_ID`/`AUTH_GITHUB_SECRET`/
   `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` (`.env.example` documents all of
   this), plus `ALLOWED_EMAILS` with the exact addresses both people will
   actually sign in with.
2. **Database (done).** Moved from a local SQLite file to Turso (hosted
   libSQL — SQLite-compatible, so this ended up closer to swapping the
   connection than rewriting queries) via `@prisma/adapter-libsql` pinned to
   the exact installed Prisma version (`6.19.3` — these adapter packages
   version in lockstep with `prisma` itself, confirmed by checking available
   versions on npm rather than assuming). `src/lib/prisma.ts` uses the
   adapter only when `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN` are both set,
   falling back to the plain local file otherwise — cloning this repo
   without Turso configured still works against a local `dev.db`.

   **Real gotcha, worth remembering if this database is ever recreated:**
   `turso db create --from-file <path>` and `--from-dump <path>` both
   report success ("Uploaded data in 0 seconds") while silently creating a
   **completely empty** database — no tables, no error, `Size: 0 B` in
   `turso db show`. This wasn't a fluke of one bad file; it failed
   identically for both the raw `.db` file and a proper `sqlite3 .dump`
   output, ruled out by actually checking `turso db show`'s reported size
   and querying `sqlite_master` directly rather than trusting the CLI's own
   "success" message. What *does* work: a plain `turso db create <name>`
   (no import flag) followed by feeding the dump SQL through
   `@libsql/client`'s `executeMultiple()` in a small one-off script — direct
   writes via `turso db shell` also work fine, confirming the database
   itself was never the problem, only those two create-time import flags.
   Also worth remembering: destroying and recreating a database changes its
   instance ID, which invalidates any auth token issued for the old one —
   `turso db tokens create <name>` again after any recreate, not before.

   **Ongoing schema changes** (as opposed to that one-time creation) are a
   separate, simpler, already-proven path: `npx prisma migrate dev --name
   <name>` as always (this only ever touches the local `dev.db` — libSQL's
   HTTP-based protocol means Prisma Migrate can't reach Turso directly),
   then apply the exact same generated `migration.sql` to the live database
   with `turso db shell roasting < prisma/migrations/<name>/migration.sql`.
   Used successfully for `add_cupping_notes`; verify with `turso db shell
   roasting ".schema <Table>"` after, since `turso db shell`'s own success
   output has already proven unreliable once above.
3. **Hosting (done).** Deployed to Vercel — live at
   `https://roasting-three.vercel.app`. `vercel link` run from
   `apps/roasting/` (not the repo root) initially set the project's Root
   Directory to `.`, which would have broken git-triggered builds on this
   monorepo (a push-triggered build starts from the repo root, `brewpa/`,
   not wherever `vercel link` happened to run from) — caught by actually
   inspecting `vercel project inspect roasting` rather than assuming the
   link picked up the right directory, fixed with
   `vercel project update roasting --root-directory apps/roasting`. Git
   integration ties into the existing "push to main" workflow as intended
   (`vercel git connect` found it already auto-connected from the linked
   GitHub account) — a normal `git push` now deploys, no separate deploy
   step. All required env vars are set via `vercel env add` for both
   Production and Preview (never committed — `.vercelignore` was added
   after noticing a CLI deploy, unlike a git-triggered one, does *not*
   automatically respect `.gitignore` and will happily upload a local
   `.env` otherwise; the actual runtime secrets came from `vercel env add`
   either way, so this was a hygiene fix, not a live leak). OAuth apps
   (GitHub, Google) need the production callback URLs
   (`https://roasting-three.vercel.app/api/auth/callback/github` and
   `/google`) added *alongside* the existing localhost ones, not instead of
   — GitHub OAuth Apps gained multi-callback-URL support (up to 10) only a
   couple weeks before this was built, confirmed by checking rather than
   assuming the old one-URL-per-app limitation still applied; Google
   clients have always supported multiple redirect URIs.

   **Gotcha hit later, by the cupping-notes deploy:** `package.json` had no
   `postinstall` script, so nothing forced Prisma Client to regenerate on
   Vercel — a build that restores a cached `node_modules` (logged as
   "Restored build cache from previous deployment") can restore a stale
   generated client alongside it, one that predates whatever's newest in
   `schema.prisma`. That build failed `tsc` with `cuppingNotes`/`bean`/
   `events` all reported as not existing on the session type — the generated
   types were simply out of date, not a real code error, confirmed by
   running `npx prisma generate` locally and watching `tsc` pass clean
   immediately after. Fixed for good with `"postinstall": "prisma
   generate"` in `package.json`, so `npm install` always regenerates a
   client matching the current schema — verified by deleting
   `node_modules/.prisma` locally and confirming a plain `npm install`
   brought it back, not by reasoning about what *should* happen. Any schema
   change from here on should be safe from this class of failure without
   needing to remember it.
4. **Backups (done).** `backup-db.sh` (repo root) runs
   `turso db shell roasting ".dump"` and writes a timestamped SQL file to
   `backups/` (gitignored — never touches the public repo, and rules out
   GitHub Actions artifacts too, since those are publicly downloadable on a
   public repo, which would defeat the point), pruning down to the most
   recent 20 backups each run so it doesn't grow forever. Worth knowing
   before reaching for this: Turso already gives 24-hour point-in-time
   recovery on the free tier automatically, backed up at every commit — no
   setup, covers "I just fat-fingered a delete a few hours ago" on its own.
   `backup-db.sh` is for the gap PITR doesn't cover: something happening to
   the Turso account/platform itself, where an independent local copy
   actually matters, and that risk doesn't need high frequency to be
   covered.
   `launchd` (a scheduled background job) was tried first for automating
   this and abandoned: it hit a real macOS Transparency, Consent, and
   Control (TCC) wall — background processes need explicit Full Disk Access
   to touch `~/Documents` (where this repo happens to live), which an
   interactive Bash tool session already has but a freshly-spawned `launchd`
   job does not, and granting that is a system security setting only the
   user can do (a GUI toggle, no programmatic path — by design). Given the
   user didn't want to grant that, `start.sh` calls `backup-db.sh` instead,
   conditioned on `TURSO_DATABASE_URL` actually being set in `.env` — since
   `start.sh` is already the one command run every session, this gets a
   fresh backup on ordinary use without any background daemon or extra
   permission at all. Non-blocking (`|| echo ... >&2`, not `set -e`
   propagating): a failed backup shouldn't stop the app from starting.

## Commands

`./start.sh` from the repo root is the one-command way to get the dev server
running (install + migrate + dev, each step skipped if already done). The
rest below assume you're running them yourself from `apps/roasting/`:

```bash
npm run dev          # dev server at localhost:3000
npm run build        # production build
npm run lint         # eslint
npx tsc --noEmit     # typecheck
npx prisma studio    # browse the SQLite DB
npx prisma migrate dev --name <name>   # after editing prisma/schema.prisma
```

No test suite yet — add one when the app has enough logic to warrant it.
