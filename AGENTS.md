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
2. **Live roast sessions** — the core of the app. Starting a roast starts an
   on-screen timer; while it runs, the roaster (the person) logs events in
   real time as they happen: fan level changes, heat level changes,
   temperature readings (from a separate probe/thermometer — the SR800 has
   none built in), and crack markers (first crack start/end, second crack
   start/end), plus free notes. This is **manual data entry against a live
   clock**, not a hardware integration — the human is relaying what they see
   and do on the physical roaster. See the note below on why this doesn't
   need serial/USB access. Built (`/roasts/[id]`, only one session can be
   active at a time).
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
the descriptive fields — name/origin/process/`supplierUrl`/etc. — but not
either weight; `weightGrams` (total purchased) still only moves via
`createBean`, while `remainingGrams` moves via roast actions *or* the manual
`StockAdjuster` below, deliberately kept as two different mechanisms so
automatic roast-driven bookkeeping and manual human correction don't fight
each other silently), `RoastSession` (one roast against a `Bean` —
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

**Roasted-coffee stock:** ending a roast (`endRoast`) sets
`RoastSession.roastedRemainingGrams` to the entered `roastedWeightGrams` —
green weight moves out of `Bean.remainingGrams` at roast *start*, roasted
weight moves into `RoastSession.roastedRemainingGrams` at roast *end*. Each
roast session is its own roasted-stock ledger entry (no separate model) since
roasted coffee is roast-specific, not blended across sessions.

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
if you touch the curve's visuals, this is the one place to do it. All
user-entered text (bean name, notes, friend names) is HTML-escaped when
building the static page — it's going to a **public** page, so that's a real
XSS boundary, not just tidiness. `GITHUB_PAGES_BASE_URL` in `publish.ts` is
hardcoded to `bdalporto7.github.io/brewpa` — this app is single-repo,
single-user, so that's deliberate, not a TODO.

Two things this doesn't do, both by design, not oversight: it doesn't enable
GitHub Pages itself (one-time manual step: repo Settings → Pages → Deploy
from a branch → `main` / `/docs` — I can't change repo settings), and it
doesn't commit or push the generated `docs/` files (I've had no stored
GitHub credentials in this environment so far — publishing writes local
files only; committing/pushing them live is still a manual step). If a
future agent finds working `git push` access, that's still worth confirming
with the user before automating rather than silently wiring it up.

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

**Roast phases & tips:** `computeRoastPhases` (`src/lib/phases.ts`) is a pure
function deriving Scott Rao's three-phase breakdown — drying (charge → `DRY_END`),
Maillard/browning (`DRY_END` → `FIRST_CRACK_START`), development
(`FIRST_CRACK_START` → drop) — from whatever milestone events exist; any
phase whose boundary events aren't logged comes back `null` rather than
guessed. `PhaseBar.tsx` renders it (used on completed roasts, on a live
roast via `LiveTipsPanel`, in the CSV, and as one more stat on the published
static page). `generateLiveTips` (`src/lib/tips.ts`) is a small, deliberately
rule-based set of live prompts during a roast — no LLM call, by design (this
was a real decision point, confirmed with the user: reliability, no external
dependency, and no risk of confidently-wrong advice on something that can
ruin a batch, mattered more than open-ended flexibility here). Two kinds of
rules: generic ones with hedged, general-heuristic numbers ("development
time commonly cited around 15–25%" — phrased as common guidance, not
asserted fact, since this isn't a claim to overstate confidence in), and
personalized ones grounded in the roaster's own history
(`computeHistoricalBaseline` averages dry-end/first-crack/duration from past
completed roasts of the *same bean*, falling back to all beans if that bean
has no history yet) — e.g. "your average for this bean is 6:15" is a real,
checkable fact about this roaster's own data, not a generic claim, and is
the more defensible half of what the tips panel says. If this list of rules
grows, keep that split intentional — the personalized/grounded-in-real-data
tips are safe to expand freely; a new generic numeric heuristic should only
go in if it's genuinely well-established, hedged the same way, and not
something represented as more precise than it is.

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
