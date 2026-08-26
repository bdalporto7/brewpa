# API reference

This app has almost no REST API — nearly every mutation is a Next.js
**Server Action** (a `"use server"` function called directly from a form or
a client component, no fetch/JSON/route involved). There are exactly four
real HTTP **Route Handlers**, each for a reason a Server Action can't cover
(a machine client with no browser session, a file download, or a
third-party OAuth callback). This doc covers both: the four routes in full
HTTP-endpoint detail, and every Server Action as a reference table grouped
by domain.

For the *why* behind specific decisions mentioned here (why bearer-token
auth for the probe, why ownership is re-checked server-side, why ratio
isn't stored, etc.), see [`AGENTS.md`](../../AGENTS.md); this doc documents
*what exists and its signature*, not the reasoning.

---

## Route Handlers

### `POST /api/probe/temperature`

Ingests one temperature reading from a live probe. **Not session-authed** —
excluded from `proxy.ts`'s gate (same as `/api/auth/*`, for the opposite
reason: this one has no browser session to check). Always writes against
whichever `RoastSession` is currently active (`endedAt: null`); the caller
never specifies a session id.

- **Auth:** `Authorization: Bearer <PROBE_INGEST_TOKEN>` header, compared with `crypto.timingSafeEqual`. Missing/wrong token → `401`.
- **Body (JSON):**
  | Field | Type | Required |
  |---|---|---|
  | `tempFahrenheit` | number | ✅ |
  | `probeType` | string | optional, defaults to `"bean"` |
- **Responses:**
  | Status | Body | When |
  |---|---|---|
  | 200 | `{ ok: true, id, roastSessionId, atSeconds }` | Reading stored |
  | 400 | `{ error: "tempFahrenheit (number) is required." }` | Missing/invalid body |
  | 401 | `{ error: "Unauthorized" }` | Bad/missing bearer token |
  | 404 | `{ error: "No active roast session." }` | No pending or live `RoastSession` exists |
- **Side effect:** creates one `TemperatureReading`. `atSeconds` is `null` if the active session hasn't started yet (`startedAt` unset) — this is also how the UI detects "probe connected" before a roast timer is running.

### `GET /api/roasts/[id]/temperature`

Polled by `LiveProbePanel` while a roast is pending or live, to show the live probe reading and "connected" state.

- **Auth:** browser session (`auth()`). Re-checked here even though `proxy.ts` already gates this path — Route Handlers are directly callable, same reasoning as `requireAdmin()` server-side re-checks. Missing session → `401`.
- **Params:** `id` — a `RoastSession.id`.
- **Response:** `200 { readings: TemperatureReading[] }`, ordered by `recordedAt` ascending. No pagination — a single roast's reading count is bounded (minutes of a few-second cadence).

### `GET /roasts/[id]/export`

Downloads a completed roast as CSV. Note the path — this one isn't under `/api/`, it's colocated with the roast page itself.

- **Auth:** session-gated by `proxy.ts` like any other page (no additional in-handler check).
- **Params:** `id` — a `RoastSession.id`.
- **Responses:**
  | Status | Body | When |
  |---|---|---|
  | 200 | `text/csv`, `Content-Disposition: attachment` | Roast exists and is completed |
  | 404 | `{ error: "Roast not found." }` | No such session |
  | 400 | `{ error: "This roast hasn't been completed yet." }` | `startedAt`/`endedAt` not both set |
- **Filename:** `<bean name>-<yyyy-MM-dd>.csv`, lowercased and sanitized to `[a-z0-9.-]`.
- **Body construction:** `buildRoastCsv` (`src/lib/csv.ts`) from the session's `events`, ordered by `atSeconds`.

### `GET|POST /api/auth/[...nextauth]`

Auth.js's own catch-all handler (`export const { GET, POST } = handlers` from `src/auth.ts`) — GitHub/Google OAuth redirect + callback flow, session cookie issuance. Not hand-written; see `src/auth.ts` for provider config and the `signIn` callback that checks `AllowedUser`. `proxy.ts` explicitly excludes `api/auth` from its session gate, or the OAuth callback itself would get blocked before it could complete.

---

## Server Actions

All of the following are exported `"use server"` functions, called directly
from forms (`<form action={fn}>` or the `ActionForm` wrapper component) or
from client components via `useTransition`. None of them are reachable over
plain HTTP with a URL — Next.js compiles each into a POST to the page it's
used on, invisible to normal navigation. **Any of them can still be called
directly by anyone who can reach the app**, though — they're not protected
by "the UI doesn't show the button." Actions with a real authorization
requirement (`brew-actions.ts`, `admin-actions.ts`) re-check it inside the
function itself, not just by hiding the control.

Every action that mutates data calls `revalidatePath` for whatever pages
show that data — omitted below except where it's non-obvious. Actions
taking `formData` read specific named fields from it (matching the form
that calls them); field names aren't enumerated below except where a
constraint on them matters.

### `src/lib/actions.ts` — Bean

| Action | Signature | Effect |
|---|---|---|
| `createBean` | `(formData)` | Creates a `Bean`. Requires name, origin, process, positive `weightGrams`. `remainingGrams` starts equal to `weightGrams`. |
| `updateBean` | `(id, formData)` | Edits a bean's fields, including `weightGrams` (the *total* purchased) — can't be set below current `remainingGrams`. |
| `adjustBeanStock` | `(beanId, "add" \| "remove", amount)` | Corrects stock for coffee that entered/left possession outside the app. Shifts `weightGrams` *and* `remainingGrams` together, preserving the gap (how much has been roasted). Rejects if it would go negative. |
| `setBeanStock` | `(beanId, amount)` | A pure recount — sets `remainingGrams` only, `weightGrams` untouched. |
| `setGoldenRoast` | `(beanId, roastSessionId \| null)` | Marks (or clears) the bean's comparison-target roast. Roast must belong to this bean and be completed. |
| `deleteBean` | `(id)` | Refuses if any `RoastSession` references this bean. |

### `src/lib/actions.ts` — RoastSession lifecycle

| Action | Signature | Effect |
|---|---|---|
| `startRoast` | `(formData)` | Creates a **pending** session (no `startedAt`). Requires a bean with enough `remainingGrams`; decrements it. Rejects if another session is already active. Redirects to `/roasts/[id]`. |
| `beginRoast` | `(roastSessionId, fanLevel, heatLevel)` | Sets `startedAt` (making the session **live**) and logs initial `FAN`/`HEAT` events at `atSeconds: 0`. |
| `updateRoastNotes` | `(roastSessionId, formData)` | Sets `notes` at any lifecycle stage (plan before/during, writeup after) — no completed-only gate. |
| `startPastRoast` | `(formData)` | Backfills an already-completed roast in one step (bean, weights, a past start date/time, `m:ss` duration, level, rating) — no live timer involved. Also logs a synthetic `DROP` `RoastEvent` at the given duration. Redirects to `/roasts/[id]`. |
| `dropRoast` | `(roastSessionId)` | Ends a live roast *right now* — no form. Logs a `DROP` event at the actual elapsed time, sets `endedAt`. Deliberately separate from `updateRoastDetails` so filling in details later never affects the recorded duration. |
| `updateRoastDetails` | `(roastSessionId, formData)` | Fills in/edits a completed roast's `roastedWeightGrams`/`roastLevel`/`rating`/`notes`. Re-editable: correcting the total weight preserves whatever's already been dropped/sold rather than resetting `roastedRemainingGrams`. |
| `deleteRoastSession` | `(id)` | Restores `greenWeightGrams` to the bean; cascades events/sales/cupping/readings/brews. If published, also removes the static page and re-syncs `docs/`. Redirects to `/roasts`. |

### `src/lib/actions.ts` — Events

| Action | Signature | Effect |
|---|---|---|
| `logEvent` | `({ roastSessionId, type, atSeconds, fanLevel?, heatLevel?, tempFahrenheit?, note? })` | Creates one `RoastEvent`. Takes a plain object, not `FormData` — called from client code that already has typed values (`EventLogPanel` during a live roast, `AddEventForm` when backfilling one after the fact), not a raw form submit. |
| `deleteEvent` | `(roastSessionId, eventId)` | Deletes one `RoastEvent`. |

### `src/lib/actions.ts` — Cupping

| Action | Signature | Effect |
|---|---|---|
| `addCuppingNote` | `(roastSessionId, formData)` | Creates a `CuppingNote`. Roast must be completed. Date-only `cuppedAt` input is parsed as local midnight (not UTC) to avoid an off-by-one-day display bug. |
| `updateCuppingNote` | `(cuppingNoteId, formData)` | Updates score fields/notes on an existing note. |
| `deleteCuppingNote` | `(roastSessionId, cuppingNoteId)` | Deletes one. |

### `src/lib/actions.ts` — Roasted stock & Sales ("roast drops")

| Action | Signature | Effect |
|---|---|---|
| `adjustRoastedStock` | `(roastSessionId, "add" \| "remove", amount)` | Same shift-both-totals correction pattern as `adjustBeanStock`, applied to `roastedWeightGrams`/`roastedRemainingGrams`. |
| `setRoastedStock` | `(roastSessionId, amount)` | Pure recount of `roastedRemainingGrams` only. |
| `recordSale` | `(roastSessionId, formData)` | Creates a `Sale` (this roast's coffee given/sold to a friend). Requires positive weight ≤ what's on hand. Find-or-creates the `Friend` by name (case-insensitive). |
| `deleteSale` | `(roastSessionId, saleId)` | Restores the weight to `roastedRemainingGrams`, deletes the `Sale`. If it was fulfilling a `DropClaim`, that claim's `saleId` auto-nulls via the FK. |

### `src/lib/actions.ts` — Publish & export

| Action | Signature | Effect |
|---|---|---|
| `publishRoast` | `(id)` | Renders a completed roast to a static HTML page under the repo's `docs/`, regenerates the published-roasts index, and `git push`es. Rolls `publishedAt` back to `null` if the push fails (files are already correct locally either way). |
| `unpublishRoast` | `(id)` | Removes the static page, regenerates the index, pushes. Rolls back the same way on push failure. |

### `src/lib/actions.ts` — Friends

| Action | Signature | Effect |
|---|---|---|
| `updateFriend` | `(id, formData)` | Edits name/notes. |
| `deleteFriend` | `(id)` | Un-links (doesn't delete) their `Sale`/`DropClaim` history. Redirects to `/friends`. |

### `src/lib/actions.ts` — Drops (green-coffee group buys)

| Action | Signature | Effect |
|---|---|---|
| `startDrop` | `(formData)` | Creates a `Drop`, reserving `totalGrams` out of the bean's stock immediately (same pattern as `startRoast`). |
| `deleteDrop` | `(dropId)` | Restores the reservation to the bean, cascades claims. Redirects to `/friends`. |
| `closeDrop` | `(dropId)` | Sets `closedAt` — stops accepting new claims. |
| `reopenDrop` | `(dropId)` | Clears `closedAt`. |
| `addDropClaim` | `(dropId, formData)` | Creates a `DropClaim`. Rejects if it would exceed the drop's unclaimed remainder. Find-or-creates the `Friend` by name. |
| `deleteDropClaim` | `(dropId, claimId)` | Deletes the claim (frees its grams back up on the drop). |
| `setDropClaimPaid` | `(dropId, claimId, paid)` | Toggles the plain `paid` boolean — independent of fulfillment. |
| `fulfillDropClaim` | `(dropId, claimId, formData)` | Creates a real `Sale` against a chosen completed `RoastSession` of the same bean (decrementing its roasted stock) and links it via `DropClaim.saleId`. Rejects if already fulfilled or if the chosen roast doesn't have enough stock. |
| `unfulfillDropClaim` | `(dropId, claimId)` | Deletes the linked `Sale` (restoring its roasted stock), which auto-nulls `saleId`. No-op if the claim wasn't fulfilled. |

### `src/lib/brew-actions.ts` — Recipes

| Action | Signature | Effect |
|---|---|---|
| `createRecipe` | `(formData)` | Creates a `Recipe`. Requires name, method, positive dose and water. |
| `updateRecipe` | `(id, formData)` | Edits all fields. |
| `deleteRecipe` | `(id)` | Deletes it — `onDelete: SetNull` on `Brew.recipeId` means past brews that referenced it just lose the soft link, not deleted. Redirects to `/recipes`. |

### `src/lib/brew-actions.ts` — Brews

All of these require a signed-in `AllowedUser` (`requireUser()`); the three that touch an *existing* brew also call `assertOwnsBrew` to re-verify the caller owns it, server-side, every time.

| Action | Signature | Effect |
|---|---|---|
| `logBrew` | `(formData)` | Creates a `Brew` owned by the caller. Requires exactly one of a `roastSessionId` (drawn from tracked stock — decrements it, rejecting if insufficient) or a free-text `beanName`. |
| `updateBrew` | `(id, formData)` | Edits an owned brew. If it's linked to a `RoastSession` and the dose changed, adjusts that session's stock by the delta (rejecting if it would overdraw); `beanName` is only updated for brews *without* a `roastSessionId`. |
| `deleteBrew` | `(id)` | Deletes an owned brew, restoring its dose to the linked session's stock if any. Redirects to `/brews`. |

### `src/lib/admin-actions.ts` — Allowlist

All three require the caller to already be an admin (`requireAdmin()`).

| Action | Signature | Effect |
|---|---|---|
| `addAllowedUser` | `(formData)` | Creates an `AllowedUser` row (email, optional `isAdmin` checkbox). |
| `setAllowedUserAdmin` | `(id, isAdmin)` | Toggles admin status. Refuses to demote the last remaining admin. |
| `removeAllowedUser` | `(id)` | Deletes the row (revokes sign-in access). Refuses to remove the last remaining admin. |

### `src/lib/auth-actions.ts` — Session

Thin wrappers around Auth.js's own `signIn`/`signOut`, not custom logic.

| Action | Signature | Effect |
|---|---|---|
| `signInWithGitHub` | `()` | `signIn("github", { redirectTo: "/" })` |
| `signInWithGoogle` | `()` | `signIn("google", { redirectTo: "/" })` |
| `logout` | `()` | `signOut({ redirectTo: "/login" })` |
