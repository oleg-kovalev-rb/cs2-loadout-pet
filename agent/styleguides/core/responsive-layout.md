---
description: app_core responsive/mobile conventions — shared breakpoint scale (960/880/640/560/400), per-stylesheet rule ownership and load order, JS/CSS breakpoint sync, touch sizing, 16px mobile inputs, overflow/safe-area behavior, and the phone exception to fixed-height lists.
---

# Responsive Layout (`app_core`)

## Purpose

The one place that governs how `app_core`’s public islands, admin panel, and
standalone ERB login adapt to narrow screens. It answers:

- which breakpoints the app uses;
- where a responsive rule belongs;
- when behavior needs a JS viewport check instead of CSS;
- what “usable on a phone” means for touch targets, inputs, overflow, and
  safe areas.

It covers layout and viewport behavior, not the data-loading or component
structure rules — those stay in `react-dashboard.md`.

## When to Use

Applies to any change that:

- adds or edits a media query in `tokens.css`, an island stylesheet,
  `admin-panel.css`, or `application.css`;
- changes a page’s behavior based on viewport width or pointer type;
- adds a touch-sized control or a mobile form input;
- introduces a mobile-only layout difference (stacking, hiding a decorative
  element, changing a list’s scroll model);
- fixes horizontal overflow or safe-area/`dvh` behavior.

Does not apply to desktop-only visual polish that leaves all media queries
untouched, or to data-loading/state-shape decisions (see
`react-dashboard.md`).

## Structure

### Breakpoint scale

Use only these widths; do not introduce a new one-off breakpoint for a single
selector.

| Width | Purpose |
| --- | --- |
| `max-width: 960px` | Tablet: 3-column dashboard/inventory grids become 2 columns; the dashboard list keeps its `420px` clamp |
| `max-width: 880px` | Admin shell: fixed sidebar becomes a horizontal nav |
| `max-width: 640px` | Phone: two-row topbar, single-column page grids, stacked toolbars, touch sizing, 16px inputs, no fixed-height item lists |
| `max-width: 560px` | Admin topbar: hide the email chip |
| `max-width: 400px` | Narrow phone: hide the profile name, shrink the hero value, 48px row icons, hide the row sparkline |
| `pointer: coarse` and `min-width: 641px` | Tablets/touch laptops: touch-size controls that the phone block already covers at `≤640px` |

The phone breakpoint is `640px`. It is the same value as
`shared/utils/viewport.js`’s mobile query; see JS/CSS sync below.

### Where responsive rules live

Put each rule in the stylesheet that owns its selector, appended to that
file’s responsive section:

| Area | Stylesheet |
| --- | --- |
| Topbar, nav tabs, brand, profile, tile head, item rows, items list, chart wrapper, dropdown panels, pager | `shared/styles/tokens.css` |
| Dashboard grid and items toolbar | `dashboard/styles/dashboard.css` |
| Inventory cards, inventory toolbar, detail grid, stat tiles, profile head | `inventories/styles/inventories.css` |
| Catalog stat strip, toolbar, view toggle, item grid, ticker | `tracked_items/styles/tracked_items.css` |
| Admin shell, nav, topbar, resource/table, form, pagination | `admin-panel/styles/admin-panel.css` |
| Flash stack and the standalone admin login page | `app/assets/stylesheets/application.css` |

Do not create a shared `responsive.css` or `proposal.css` that every page
imports. A rule keeps its ownership; a new page does not inherit unrelated
island breakpoints.

### Load order

Each island entrypoint imports `shared/styles/tokens.css` **before** its own
stylesheet, and `admin-panel.jsx` imports tokens before the admin stylesheet.
The standalone login page loads only `application.css` (plus the Vite/Stimulus
entrypoints).

Consequences:

- A responsive rule in `tokens.css` cannot override an equal-specificity
  selector defined in an island stylesheet loaded later. Put that override in
  the island stylesheet.
- Rules that target admin-only selectors (`.sidenav`, `.admin-main`,
  `.resource-head`, `.admin-shell`) belong in `admin-panel.css`, not in
  tokens, even though tokens is loaded on the admin page too.
- The login page does not load tokens; its rules must use the fallback
  values/`application.css` palette and live in `application.css`.

## Interface

### JS viewport helpers

`shared/utils/viewport.js` is the only place that reads viewport media
queries for behavior:

- `MOBILE_MEDIA_QUERY` — `'(max-width: 640px)'`;
- `isMobileViewport()` — true only when `window.matchMedia` exists and the
  mobile query matches; false in jsdom and non-browser environments;
- `prefersReducedMotion()` — the reduced-motion query, used before smooth
  scrolling.

Import the helper instead of inlining `window.matchMedia` or comparing
`window.innerWidth` in a component/reducer.

### Viewport-dependent initial state

When a reducer’s first value depends on the viewport:

- keep the exported `initialState` viewport-independent;
- add a state factory / lazy `useReducer` initializer that reads the
  viewport once;
- do not dispatch a “set mobile view” effect after mount (it causes a
  visible ticker/grid flash);
- do not listen for resize to re-apply the default — it would overwrite the
  user’s explicit toggle.

The factory takes the mobile flag as an argument in unit tests; the browser
read is only the default.

### Viewport-dependent presentation effects

A component may own a side effect that changes what part of the page is
visible after a user action (for example, scrolling the dashboard hero into
view after an item is selected on a phone). It must:

- read the viewport through the shared helper;
- run only on the approved viewport and only for the meaningful state change
  (a new selected item), not on deselect, initial portfolio render, or
  desktop;
- use `scrollIntoView` with `block: 'start'` and `behavior: 'auto'` when
  `prefersReducedMotion()`, otherwise `'smooth'`;
- guard the call (`scrollIntoView?.`) so jsdom and older environments do not
  throw;
- leave keyboard focus where it was unless a task explicitly asks to move
  it.

See the ADR for why the behavior lives in the component rather than a
global scroll manager.

## Responsibilities

- **CSS owns layout.** Do not use JS to switch a grid column count, hide a
  decorative element, or size a control if a media query can express it.
- **JS owns one-time choices and scrolling.** The catalog’s initial view and
  the dashboard scroll are behavior; CSS cannot express “only the first
  time” or “scroll to this element”.
- **ERB owns the public topbar markup.** Responsive topbar behavior is CSS
  only; the topbar is rendered outside the islands and must not grow island-
  specific JS.
- **Admin CSS owns the admin shell.** Keep admin responsive selectors under
  the admin page’s classes and `.shell`; do not leak them into public pages.

## Rules

### MUST

- Use the breakpoint scale above; do not add a one-off media width for a
  single selector.
- Keep the desktop declarations as the base and add `max-width` overrides
  after the existing base rules; do not convert a file to mobile-first.
- Put the rule in the stylesheet that owns the selector (see the table
  above); do not centralize responsive rules in `tokens.css`.
- Keep `640px` in CSS and `MOBILE_MEDIA_QUERY` in sync. When either changes,
  change both in the same commit.
- At `≤640px`, the public topbar is two rows (brand/profile, then tabs),
  the tabs may scroll horizontally inside their own row, the brand subtitle
  is hidden, and the active tab has an accent underline.
- At `≤640px`, no page may have a document-level horizontal scrollbar.
  Tables and other genuinely tabular surfaces may scroll inside their own
  wrapper.
- At `≤640px`, text inputs and selects are `16px` to prevent iOS focus zoom.
- Touch-sized controls use the approved compact range: `34px` for period/
  chip/pager controls, `36–40px` for toolbar/view/icon/pager buttons. Apply
  the same sizes at `pointer: coarse` above 640px; do not inflate desktop
  controls for mouse users.
- At `≤640px`, the dashboard item list uses page scroll: no `max-height`,
  no inner `overflow-y`, and `.mover-row-empty` placeholders hidden.
  Desktop/tablet keep the fixed-height list and placeholder rows.
- At `≤640px`, the dashboard hero chart has a `240px` minimum height and
  `scroll-margin-top: 12px`; the chart x-axis spacer and note stay aligned
  with the Recharts Y-axis at `54px`.
- Sort dropdowns that can sit at the right edge carry `dropdown--end` and
  their panel uses `left: auto; right: 0`; every panel is clamped to
  `calc(100vw - 32px)`.
- The mobile dashboard scroll is triggered by a selected-item change only
  (including item → item), not by deselection or desktop, and respects
  reduced motion.
- The catalog's mobile Grid default is evaluated once at mount; the user’s
  later Ticker/Grid choice is never overridden by a resize listener.
- The admin panel collapses at `880px` (horizontal nav) and hides its
  email chip at `560px`; admin topbar/chip selectors are scoped under
  `.shell` because they are outside `.admin-shell`.
- The admin login card is `box-sizing: border-box` with
  `width: min(320px, calc(100vw - 32px))`; the page uses `100dvh` with a
  `100vh` fallback and phone padding.
- Use `env(safe-area-inset-bottom)` in page bottom padding and
  `touch-action: manipulation` on interactive controls.
- Keep the phone topbar height and the flash stack in sync: the flash stack
  starts below the two-row topbar (`top: 112px` at `≤640px`).
- Verify with the responsive matrix in Testing; do not ship a page that has
  only been checked at one phone width.

### SHOULD

- Prefer hiding decorative metadata (sparklines, secondary tags) at `≤400px`
  before shrinking the primary name/price.
- Keep a single scroll surface per page on a phone; avoid nested scrollers
  unless the content is genuinely tabular.
- Use `100dvh` for full-viewport standalone pages (login) and `100vh` as
  the fallback line.
- Add a short comment for a responsive rule whose reason is not obvious from
  the selector (for example, why the demo inventory card stops being
  sticky).
- Reuse the same breakpoint value for the same kind of transition across
  pages — 960 for 3→2 grids, 640 for phone stacking.

### MUST NOT

- Do not add a new UI framework, utility CSS, or CSS-in-JS to solve a
  responsive case.
- Do not duplicate a page/component just to give mobile a different markup;
  the approved differences are CSS and two small behaviors.
- Do not use `window.innerWidth`/`matchMedia` at module top level; evaluate
  at the action or first render, through `shared/utils/viewport.js`.
- Do not add a global mobile `matchMedia` stub to the Vitest setup; stub it
  per test.
- Do not use `maximum-scale=1`/`user-scalable=no` in the viewport meta.
- Do not hide content that carries information the task requires; hiding
  decorative metadata at `≤400px` is allowed and should be explicit.
- Do not let the admin table push the page sideways; keep its scroll inside
  `.table-wrap`.
- Do not reintroduce `.chart-yaxis` width rules — the class is not rendered;
  the Recharts `YAxis width={54}` is the source of truth.
- Do not change desktop density to make a phone rule simpler.

## Interaction With Other Layers

```text
ERB layout / topbar
    ↓
dash-root (tokens.css)          ← shared shell + base desktop declarations
    ↓
island entrypoint
    ├── tokens.css              ← loaded first
    └── <island>.css            ← island rules, then its media queries

admin page
    ├── tokens.css
    └── admin-panel.css         ← 880/640/560 rules

admin login (plain ERB)
    └── application.css         ← login card, flash, body reset
```

JS behavior reads the viewport through `shared/utils/viewport.js` and talks
to the page’s existing reducer/props; it does not own layout.

## Testing

There is no CSS test runner (no Stylelint, no visual regression suite). Use:

- **Vitest for JS behavior:** viewport helper truth table, mobile catalog
  default, dashboard scroll (mobile/desktop/reduced motion/switch/deselect).
  Stub `window.matchMedia` and `Element.prototype.scrollIntoView` locally.
- **Manual matrix:** at least 320×568, 375×667, 390×844, 414×896, 768×1024,
  1024×768, and 1440×900.
- **Overflow check:** `document.documentElement.scrollWidth <=
  window.innerWidth` on every page and width.
- **Behavior checks:** dashboard item tap scrolls to the hero and returns
  without scrolling on deselect; catalog starts in Grid on a phone and
  Ticker on desktop; resizing does not flip the current catalog view.
- **Admin/login:** horizontal nav, local table scroll, one-column form,
  320px login card, no extra page scroll.
- **Reduced motion:** emulate it in DevTools and confirm the scroll is
  instant.
- **Touch/inputs:** device emulation confirms 34–40px controls and that
  focusing a search/login input does not zoom.

## Canonical Implementations

No responsive implementation exists yet. The first one is specified by
`agent/plans/mobile-responsive-pass.md`; after it lands, the canonical files
will be:

- `app_core/app/frontend/shared/styles/tokens.css` — shared shell/phone rules
- `app_core/app/frontend/dashboard/styles/dashboard.css` — dashboard grids
- `app_core/app/frontend/inventories/styles/inventories.css` — inventory
  cards/detail
- `app_core/app/frontend/tracked_items/styles/tracked_items.css` — catalog
- `app_core/app/frontend/admin-panel/styles/admin-panel.css` — admin
- `app_core/app/assets/stylesheets/application.css` — login/flash
- `app_core/app/frontend/shared/utils/viewport.js` — JS viewport checks
- `app_core/app/frontend/dashboard/components/PortfolioTile.jsx` — mobile
  hero scroll
- `app_core/app/frontend/tracked_items/reducer.js` — one-time Grid default

## Related ADR

- `agent/adr/core/responsive-layout-strategy.md` — why the app uses a
  desktop-first layer, per-owner stylesheets, and a shared 640px JS query,
  and which alternatives (mobile-first, one shared responsive file, separate
  mobile components, a UI framework) were rejected.
