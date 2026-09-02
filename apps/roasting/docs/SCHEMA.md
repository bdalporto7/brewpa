# Schema reference

Field-by-field reference for every model in
[`prisma/schema.prisma`](../prisma/schema.prisma) — the source of truth is
always that file; this doc is a more scannable restatement of it, kept in
sync by hand. For how these models connect visually, see
[`ARCHITECTURE.md`](ARCHITECTURE.md#data-model). For *why* a field exists or
works the way it does, see [`AGENTS.md`](../../AGENTS.md) — this doc
documents *what's there*, not the reasoning behind it (though a few
one-line pointers are included where the "why" isn't obvious from the
field alone).

Conventions used below: **PK** primary key, **FK** foreign key, **UK**
unique. "Required"/"Optional" refers to SQL nullability. All `id` fields
are `cuid()`-generated strings. All models use SQLite via Prisma (Turso in
production, a local file in dev — see `src/lib/prisma.ts`).

---

## Bean

Green coffee inventory — one purchase.

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `id` | String | PK | `cuid()` | |
| `name` | String | ✅ | | |
| `origin` | String | ✅ | | |
| `producer` | String | | | |
| `process` | String | ✅ | | e.g. Washed, Natural, Honey |
| `variety` | String | | | |
| `supplier` | String | | | |
| `supplierUrl` | String | | | |
| `purchaseDate` | DateTime | ✅ | `now()` | |
| `purchasePrice` | Float | | | |
| `weightGrams` | Float | ✅ | | Total ever purchased |
| `remainingGrams` | Float | ✅ | | Green stock on hand right now |
| `notes` | String | | | |
| `createdAt` | DateTime | ✅ | `now()` | |
| `updatedAt` | DateTime | ✅ | auto | |
| `goldenRoastId` | String | | | FK → `RoastSession.id`, **UK**, `onDelete: SetNull`. The one roast of this bean future roasts get compared against live. Named relation `BeanGoldenRoast` — distinct from `roastSessions` below since both point `Bean` → `RoastSession`. |

**Relations:** `roastSessions: RoastSession[]` (relation `BeanRoasts`, one bean → many roasts) · `drops: Drop[]` (one bean → many group buys) · `goldenRoast: RoastSession?` (see above)

**Indexes:** `@@index([origin])` · `@@index([createdAt])`

**Delete behavior:** `deleteBean` (in `actions.ts`) refuses if any `RoastSession` references this bean (`onDelete: Restrict` on `RoastSession.beanId` enforces this at the DB level too).

---

## RoastSession

One roast run against a `Bean`. Lifecycle: **pending** (`startedAt` null) → **live** (`startedAt` set, `endedAt` null) → **completed** (`endedAt` set). Only one session can be pending or live at a time.

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `id` | String | PK | `cuid()` | |
| `beanId` | String | ✅ | | FK → `Bean.id`, `onDelete: Restrict` |
| `startedAt` | DateTime | | | Null = still pending |
| `endedAt` | DateTime | | | Null = pending or live |
| `greenWeightGrams` | Float | ✅ | | Decremented from `Bean.remainingGrams` when the session is created |
| `roastedWeightGrams` | Float | | | Total yield, filled in via `updateRoastDetails` |
| `roastedRemainingGrams` | Float | | | Roasted-coffee stock for *this specific roast* — every roast has its own pool, not aggregated at the bean level in the DB (the UI aggregates for display) |
| `roastLevel` | String | | | Free text |
| `rating` | Int | | | |
| `notes` | String | | | Doubles as a pre-roast plan and a post-roast writeup — one field, editable at any lifecycle stage |
| `createdAt` | DateTime | ✅ | `now()` | |
| `updatedAt` | DateTime | ✅ | auto | |

**Relations:** `bean: Bean` · `events: RoastEvent[]` · `sales: Sale[]` · `cuppingNotes: CuppingNote[]` · `temperatureReadings: TemperatureReading[]` · `brews: Brew[]` · `goldenForBean: Bean?` (inverse of `Bean.goldenRoast`)

**Indexes:** `@@index([beanId])` · `@@index([startedAt])`

**Delete behavior:** restores `greenWeightGrams` back to the bean; cascades `RoastEvent`/`Sale`/`CuppingNote`/`TemperatureReading`/`Brew` (each has its own delete-time side effect — see their sections).

---

## RoastEvent

One discrete, human-logged moment during a session — fan/heat changes, temperature readings you type in by hand, crack markers, notes, and the auto-logged drop marker. (Continuous probe data lives in `TemperatureReading` instead — see below.)

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `id` | String | PK | `cuid()` | |
| `roastSessionId` | String | ✅ | | FK → `RoastSession.id`, `onDelete: Cascade` |
| `atSeconds` | Int | ✅ | | Elapsed seconds from `startedAt` |
| `type` | String | ✅ | | One of `FAN`, `HEAT`, `TEMP`, `DRY_END`, `YELLOWING_END`, `FIRST_CRACK_START`, `FIRST_CRACK_END`, `SECOND_CRACK_START`, `SECOND_CRACK_END`, `NOTE`, `DROP` — see `EVENT_TYPES` in `src/lib/constants.ts` |
| `fanLevel` | Int | | | Set for `FAN` events |
| `heatLevel` | Int | | | Set for `HEAT` events |
| `tempFahrenheit` | Float | | | Set for `TEMP` events |
| `note` | String | | | Set for `NOTE` events |
| `createdAt` | DateTime | ✅ | `now()` | |

**Indexes:** `@@index([roastSessionId, atSeconds])`

---

## TemperatureReading

One reading from a connected live temperature probe — arrives every few seconds, deliberately not a `RoastEvent` (see `AGENTS.md`'s "Temperature probe" section).

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `id` | String | PK | `cuid()` | |
| `roastSessionId` | String | ✅ | | FK → `RoastSession.id`, `onDelete: Cascade` |
| `atSeconds` | Int | | | Null for readings recorded before `startedAt` is set (roast still in setup) — this is how "probe connected" gets detected without a manual toggle |
| `tempFahrenheit` | Float | ✅ | | |
| `probeType` | String | ✅ | `"bean"` | Not constrained to an enum — room for a second probe (e.g. environment/exhaust temp) later without a migration |
| `recordedAt` | DateTime | ✅ | `now()` | Wall-clock time the reading was received |

**Indexes:** `@@index([roastSessionId, atSeconds])`

**Written by:** `POST /api/probe/temperature` (see [`API.md`](API.md)) — never by a Server Action, since the writer is a machine client, not a signed-in browser session.

---

## Sale

Roasted coffee given or sold to a `Friend`, drawn from one `RoastSession`'s stock. Shown in the UI as a "drop" — an unrelated use of that word from the `Drop`/`DropClaim` models below (see `AGENTS.md` if that's confusing).

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `id` | String | PK | `cuid()` | |
| `roastSessionId` | String | ✅ | | FK → `RoastSession.id`, `onDelete: Cascade` |
| `friendId` | String | | | FK → `Friend.id`, `onDelete: SetNull` |
| `weightGrams` | Float | ✅ | | |
| `price` | Float | | | |
| `soldAt` | DateTime | ✅ | `now()` | |
| `notes` | String | | | |
| `createdAt` | DateTime | ✅ | `now()` | |

**Relations:** `fulfillsClaim: DropClaim?` (inverse of `DropClaim.sale` — a `Sale` created by fulfilling a claim points back)

**Indexes:** `@@index([roastSessionId])` · `@@index([friendId])`

**Delete behavior (`deleteSale`):** restores `weightGrams` to the session's `roastedRemainingGrams`. If this `Sale` was created by `fulfillDropClaim`, deleting it also nulls the `DropClaim.saleId` automatically via `onDelete: SetNull` — un-fulfilling the claim as a side effect.

---

## CuppingNote

One formal tasting of a completed roast — SCA/Q-grading-style. A roast can have several over time.

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `id` | String | PK | `cuid()` | |
| `roastSessionId` | String | ✅ | | FK → `RoastSession.id`, `onDelete: Cascade` |
| `cuppedAt` | DateTime | ✅ | `now()` | |
| `fragranceAroma` | Float | | | 6–10, 0.25 increments in the UI |
| `flavor` | Float | | | 6–10 |
| `aftertaste` | Float | | | 6–10 |
| `acidity` | Float | | | 6–10 |
| `body` | Float | | | 6–10 |
| `balance` | Float | | | 6–10 |
| `uniformity` | Float | | | 6–10 |
| `cleanCup` | Float | | | 0–10 (simplified from the professional 5-cups-per-category protocol) |
| `sweetness` | Float | | | 0–10 |
| `overall` | Float | | | 0–10 |
| `defects` | Float | | | Deduction |
| `notes` | String | | | |
| `createdAt` | DateTime | ✅ | `now()` | |
| `updatedAt` | DateTime | ✅ | auto | |

**Indexes:** `@@index([roastSessionId])`

**Note:** every score field is independently optional. `computeCuppingTotal` (`src/lib/cupping.ts`) only returns a total once all ten Q-grading categories are filled in — a partial entry never shows a misleading number.

---

## Friend

A person drops (`Sale` or `DropClaim`) go to. Created automatically (case-insensitive find-or-create) the first time their name is typed into a drop/claim form.

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `id` | String | PK | `cuid()` | |
| `name` | String | ✅ | | |
| `notes` | String | | | |
| `createdAt` | DateTime | ✅ | `now()` | |
| `updatedAt` | DateTime | ✅ | auto | |

**Relations:** `sales: Sale[]` · `dropClaims: DropClaim[]`

**Indexes:** `@@index([name])`

**Delete behavior:** un-links (doesn't delete) their `Sale`/`DropClaim` history — those rows survive with `friendId: null`, shown as anonymous. No merge action for near-duplicate friends yet (e.g. "Jake" vs. "Jake S.").

---

## Drop

A green-coffee group buy against one `Bean` — reserve a chunk of stock, let friends claim portions first-come-first-serve. Distinct from `Sale`: a `Drop` happens at/before roasting, a `Sale` after a specific roast completes.

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `id` | String | PK | `cuid()` | |
| `beanId` | String | ✅ | | FK → `Bean.id`, `onDelete: Restrict` |
| `totalGrams` | Float | ✅ | | Reserved out of `Bean.remainingGrams` the moment the drop is created |
| `portionGrams` | Float | | | Suggested claim size, shown as a form placeholder — not enforced |
| `pricePerGram` | Float | | | |
| `notes` | String | | | |
| `closedAt` | DateTime | | | Null = still accepting claims |
| `createdAt` | DateTime | ✅ | `now()` | |
| `updatedAt` | DateTime | ✅ | auto | |

**Relations:** `claims: DropClaim[]`

**Indexes:** `@@index([beanId])`

**Delete behavior:** restores `totalGrams` to the bean, cascades its `DropClaim`s.

---

## DropClaim

One friend's claimed portion of a `Drop`, first-come-first-serve (rejected once `totalGrams` is fully claimed).

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `id` | String | PK | `cuid()` | |
| `dropId` | String | ✅ | | FK → `Drop.id`, `onDelete: Cascade` |
| `friendId` | String | | | FK → `Friend.id`, `onDelete: SetNull` |
| `gramsClaimed` | Float | ✅ | | |
| `price` | Float | | | |
| `paid` | Boolean | ✅ | `false` | Plain manual checkbox — independent of fulfillment |
| `saleId` | String | | | FK → `Sale.id`, **UK**, `onDelete: SetNull`. Non-null ⇔ "fulfilled" — not a separate stored flag. |
| `notes` | String | | | |
| `claimedAt` | DateTime | ✅ | `now()` | |

**Indexes:** `@@index([dropId])` · `@@index([friendId])`

**Fulfillment mechanism:** `fulfillDropClaim` creates a real `Sale` against a chosen completed `RoastSession` of the same bean (decrementing its `roastedRemainingGrams`) and points `saleId` at it. `unfulfillDropClaim` deletes that `Sale`, which restores the roasted stock and nulls `saleId` automatically via the FK.

---

## AllowedUser

Who's allowed to sign in via OAuth, and who can manage this table (`isAdmin`) from `/admin`. Replaces the old `ALLOWED_EMAILS` env var.

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `id` | String | PK | `cuid()` | |
| `email` | String | ✅ | | **UK**, lowercased before storage/comparison |
| `isAdmin` | Boolean | ✅ | `false` | Gates `/admin` and its Server Actions |
| `createdAt` | DateTime | ✅ | `now()` | |

**Relations:** `brews: Brew[]` (a `Brew`'s owner)

**Checked by:** `auth.ts`'s `signIn` callback (email lookup, gates OAuth login itself) and `src/lib/admin.ts`'s `requireAdmin`/`getCurrentAllowedUser` (used throughout `admin-actions.ts` and `brew-actions.ts`).

**Invariant:** the app refuses to demote or delete the last remaining `isAdmin: true` row (`assertNotLastAdmin` in `admin-actions.ts`), so the allowlist can never lock itself out.

---

## Recipe

A reusable brewing target — not tied to any bean, so the same method can be dialed in once and reused.

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `id` | String | PK | `cuid()` | |
| `name` | String | ✅ | | |
| `method` | String | ✅ | | Free text with suggestions from `BREW_METHODS` (`src/lib/constants.ts`), not a locked enum |
| `doseGrams` | Float | ✅ | | |
| `waterGrams` | Float | ✅ | | Ratio (`waterGrams / doseGrams`) is derived at display time wherever shown, never stored |
| `grindSetting` | String | | | Free text (grinder-specific, e.g. "22 clicks") |
| `waterTempF` | Float | | | |
| `brewTimeSeconds` | Int | | | Entered/displayed as m:ss (`parseMMSS`/`formatMMSS`) |
| `notes` | String | | | Steps, pour schedule, anything more specific than the flat fields above |
| `createdAt` | DateTime | ✅ | `now()` | |
| `updatedAt` | DateTime | ✅ | auto | |

**Relations:** `brews: Brew[]` (brews that used this recipe as a soft "inspired by" reference)

**Indexes:** `@@index([method])`

**Delete behavior:** `onDelete: SetNull` on `Brew.recipeId` — deleting a recipe never touches brews that referenced it, just detaches them.

---

## Brew

One logged brew — the one model in this schema that's **private per-user** rather than shared household data (see `AGENTS.md`'s "Brewing" section for why).

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `id` | String | PK | `cuid()` | |
| `roastSessionId` | String | | | FK → `RoastSession.id`, `onDelete: SetNull`. Set when drawn from this app's own tracked roasted stock. |
| `beanName` | String | | | Free-text fallback bean identifier, used when `roastSessionId` is null (coffee this app never roasted) |
| `recipeId` | String | | | FK → `Recipe.id`, `onDelete: SetNull` — soft "inspired by" link, not a source of truth for the fields below |
| `userId` | String | ✅ | | FK → `AllowedUser.id`, `onDelete: Cascade` — the owner; every brew belongs to exactly one signed-in user |
| `method` | String | ✅ | | |
| `doseGrams` | Float | ✅ | | |
| `waterGrams` | Float | ✅ | | |
| `grindSetting` | String | | | |
| `waterTempF` | Float | | | |
| `brewTimeSeconds` | Int | | | |
| `rating` | Int | | | 1–10 (not the app's usual 1–5 star scale — see `brewFields` validation in `brew-actions.ts`) |
| `notes` | String | | | Tasting notes |
| `brewedAt` | DateTime | ✅ | `now()` | |
| `createdAt` | DateTime | ✅ | `now()` | |
| `updatedAt` | DateTime | ✅ | auto | |

**Constraint (app-level, not DB):** exactly one of `roastSessionId` / `beanName` must be set — enforced in `logBrew`, not a DB check constraint.

**Indexes:** `@@index([roastSessionId])` · `@@index([recipeId])` · `@@index([userId])`

**Stock mechanism:** when `roastSessionId` is set, `logBrew`/`updateBrew`/`deleteBrew` decrement/restore that session's `roastedRemainingGrams` by `doseGrams` inside a transaction — the same pattern `Sale` uses, just scoped to one user's journal entry instead of a shared record.

**Ownership enforcement:** every mutation on an existing `Brew` calls `assertOwnsBrew` server-side, not just gating the UI — see [`API.md`](API.md) for why that matters given Server Actions are directly callable.
