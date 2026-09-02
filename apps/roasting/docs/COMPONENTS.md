# Component reference

The shared primitives in `src/components/ui/` — what each one is for, its
props, and when to reach for it instead of hand-rolling the same markup
again. For the *why* behind a specific primitive's design (e.g. why `Card`
has an `interactive` flag instead of two separate components), see the doc
comment directly above that component's definition — this doc is a
reference table, not the reasoning.

Every feature area (`beans/`, `roasts/`, `brews/`, `friends/`, `admin/`)
has its own component subfolder under `src/components/`; only primitives
generic enough to be used by more than one area live in `ui/`.

## Primitives

| Component | Purpose | Key props | Use it for | Don't use it for |
|---|---|---|---|---|
| `Card` | The shared bordered/shadowed surface (`rounded-xl border-2 ... shadow-[2px_2px_0_var(--shadow-ink)]`) every box in the app sits on. | `interactive?: boolean` (default `true`) | Any bordered box. Pass `interactive={false}` for a static info box/form/panel; leave the default `true` for a whole box that's a clickable link (a list-item card). | Nothing — this is the base every other card-shaped thing should build on. If you're about to type `rounded-xl border-2 border-[var(--border-strong)] bg-surface shadow-[2px_2px_0_var(--shadow-ink)]` by hand, use `Card` instead. |
| `SectionCard` | A labeled, bordered, optionally-collapsible card shell — icon + uppercase label inside the same box as its content, collapse state built in. | `icon`, `label`, `collapsible?`, `defaultCollapsed?`, `headerExtra?` | A section that needs its own collapse/expand affordance and a simple "always show everything or hide everything" body. | A component with a more complex internal layout that needs to keep *some* content always visible while collapsing only part of itself (e.g. `AiSuggestionPanel`'s "show full plan" toggle) — those are legitimate hand-rolled exceptions, see below. |
| `EditableTextCard` | One saved string with view/edit/delete built in — read-only display once saved (Edit/Delete affordances), editable textarea otherwise. | `icon`, `label`, `value`, `placeholder`, `onSave`, `deleteConfirmText?`, `collapsible?`, `defaultCollapsed?`, `hideWhenEmpty?` | Any single free-text field that's saved server-side and needs its own edit/delete UI (roast notes, AI feedback, tasting notes). | Multi-field forms — this is specifically for "one saved string." |
| `Stat` | A "big number + label" tile. | `label: string`, `value: ReactNode` | Any stats-row tile on a detail page. | A side-by-side two-value comparison — see `CompareTab.tsx`'s local `CompareStat`, a deliberate two-value variant, not a duplicate. |
| `ProgressBar` | The thin "how much is left" bar with the `pour-fill` mount animation. | `percent: number`, `low?: boolean` | Any stock/claim/completion bar. | A component that also needs its own adjuster controls next to the bar (`BeanStockBar` composes `ProgressBar` with `StockAdjuster` rather than `ProgressBar` growing that itself). |
| `Eyebrow` | The small uppercase icon+label row used above cards and stat groups. | `icon?`, `children`, `className?` (for per-site margin) | Any standalone section-label row outside of `SectionCard` (which already uses `Eyebrow` internally for its own header). | — |
| `FavoriteToggle` | The star-button favorite toggle, with `stopPropagation` built in for use inside a whole-card `<Link>`. | `isFavorite: boolean`, `onToggle: () => Promise<void>`, `className?` | Any favorite/pin toggle nested inside a clickable card. `RoastProfileFavoriteToggle`/`RecipeFavoriteToggle` are thin per-entity wrappers over this — follow that pattern for a new entity's favorite toggle rather than reimplementing the button. | — |
| `Checkbox` | A labeled checkbox matching `Field`'s label typography; works controlled or uncontrolled. | `label: string` + standard checkbox input props | Any checkbox with a text label next to it. | — |
| `Field` (`TextField`/`SelectField`/`TextareaField`) | Labeled form inputs with the shared border/focus styling. | `label`, `name`, + standard input/select/textarea props | Any labeled form field, including one that needs a `<datalist>` — `TextField` already spreads standard input attributes, so `list="some-id"` works without any change to `Field` itself; just render the `<datalist>` as a sibling. | — |
| `Button` | Primary/secondary/ghost/danger button variants with a "stamp" press effect on primary/secondary. | `variant?`, `size?` | Any button that isn't a bare icon-only control or a chart/legend toggle (those stay hand-rolled — see below). | — |
| `CybarMark` | The mascot icon (light/dark picture pair), with an optional dancing animation. | `dancing?: boolean`, `className` | Any "this is Cybar's AI" branding moment — one visual source instead of redefining it per component. | — |

## Legitimate hand-rolled exceptions

Not everything that looks like it could use a shared primitive should —
these were evaluated and deliberately left alone:

- **`DeleteButton`** — its confirm-then-delete state machine is more than
  `Button`'s variants can express; only its visual styling should track
  `Button`'s `danger`/`ghost` variants, not its whole implementation.
- **`AiSuggestionPanel`'s "show full plan" toggle**, **`RoastCurveChart`'s**
  and **`EventTimeline`'s** collapse state — each has a layout `SectionCard`
  doesn't fit cleanly (a toggle that hides only *part* of the panel while
  the rest stays visible; a chart needing an empty-state branch and a
  title-less standalone mode; a table needing a `bare` mode for when a
  caller already supplies the surrounding `Card`). Their raw `Card`-shaped
  boxes still use `Card` for the shell — only the collapse *logic* stays
  bespoke.
- **`BeanForm`/`LogPastRoastForm`** — native `<details>/<summary>`, not
  `SectionCard`, for a deliberately zero-JS collapse (works before
  hydration) on a form that's closed by default at the top of a list.
- **Icon-only controls, chart-legend toggles, stepper +/- buttons** — these
  don't share enough visual shape with `Button`'s variants to be worth
  forcing through it.
