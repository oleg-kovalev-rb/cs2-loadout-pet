---
status: implemented
app: core
goal: Make app_core usable at phone widths, default the items catalog to grid on mobile, and scroll the dashboard to the hero chart when an item is selected on mobile.
created: 2026-10-26
---

# Development Plan

## Goal

Port the approved `mockups/responsive/` design into `app_core`’s real
stylesheets and React islands, and add the two approved behavior changes:
the dashboard’s item selection scrolls to the hero chart on a phone, and the
items catalog opens in Grid on a phone. Desktop layouts keep their current
density and structure.

## Applicable Styleguides

- **`agent/styleguides/core/responsive-layout.md`** — the breakpoint scale
  (960/880/640/560/400), per-stylesheet rule ownership and load order,
  JS/CSS 640px sync, touch sizing, 16px mobile inputs, overflow/safe-area
  rules, the one-time viewport-state rule, the mobile fixed-height-list
  exception, and the responsive verification matrix. Constrains every CSS
  step, the viewport helper, and the two viewport-dependent behaviors.
- **`agent/styleguides/core/react-dashboard.md`** — React island state,
  one-time viewport-dependent initial state, the allowed mobile hero-scroll
  effect, the phone exception to fixed-height lists, CSS split, and
  Vitest/testing conventions (including local `matchMedia` /
  `scrollIntoView` stubs). Constrains the `PortfolioTile` and
  `TrackedItems`/reducer changes and their tests.
- **`agent/styleguides/ci-and-coverage.md`** — frontend tests, ESLint,
  Prettier, and `bin/ci` are blocking verification; the plan’s verification
  steps must stay aligned with it.
- **`agent/styleguides/core/erb-interaction-patterns.md`** — the topbar and
  flash toast remain plain ERB/zero-JS; the plan touches their CSS (flash
  offset, topbar layout) but introduces no Stimulus/interaction change.
- **`agent/styleguides/git-commits.md`** — the eventual commit uses the
  repo’s `[Scope] Imperative summary` format.

## Expected Behavior

### Shared shell (all public pages)

- At `≤640px` the topbar becomes two rows: brand + profile on row one, the
  three nav tabs on row two. The brand subtitle is hidden, the active tab has
  an accent underline, and the tabs never force page-level horizontal scroll.
- The profile name is truncated with an ellipsis when long; at `≤400px` the
  name is hidden, leaving the avatar, demo badge, and exit control.
- Page padding is `16px` with safe-area bottom padding on iOS.
- Tappable controls are at least ~34–40px tall on a phone and on
  `pointer: coarse` tablets: period buttons, chips, pager buttons, view-toggle
  segments, toolbar buttons, icon buttons.
- Text inputs and selects render at `16px` on a phone so iOS Safari does not
  zoom the page on focus.
- No page gets a horizontal document scrollbar at 320/375/390/414px.
- Toast stack sits below the two-row topbar (`top: 112px` at `≤640px`).

### Dashboard (`/`)

- The existing 3-column desktop grid becomes 2 columns at `641–960px` and
  one column at `≤640px`.
- On a phone the items list flows with the page: no `max-height`/inner
  scroll, and the decorative placeholder rows are hidden. Desktop and tablet
  keep the `PAGE_SIZE`-stable list and placeholder rows.
- The items toolbar becomes two equal buttons in a row on a phone.
- The hero chart has a `240px` minimum height on a phone; the value/axis
  remain readable.
- Tapping an item on a phone selects it, switches to item mode, and scrolls
  the page to the top of the hero section (header, value, and chart visible).
  The scroll is smooth unless `prefers-reduced-motion: reduce` is set.
- Tapping a different item while already in item mode scrolls to the hero
  again. Tapping the already-selected item (return to portfolio) does **not**
  scroll.
- On desktop/tablet selecting an item does not scroll.
- Long item names in the item-mode header wrap inside the hero instead of
  widening the page.
- The x-axis labels align with the chart plot: the mobile spacer stays at the
  same 54px as the Recharts Y-axis; the dead `.chart-yaxis` rule is removed.

### Items catalog (`/tracked-items`)

- A fresh load on a phone (`≤640px`) starts in **Grid**; a fresh load above
  640 starts in **Ticker**.
- The default is decided once on mount. Resizing the window later does not
  flip the user’s current view; the Ticker/Grid toggle keeps working in both
  directions for the life of the page.
- On a phone the toolbar is: full-width search, Filters/Sort side by side,
  full-width Ticker/Grid toggle with equal segments.
- Grid shows two cards per row at 390px (`minmax(160px, 1fr)`), one column on
  very narrow screens.
- Ticker becomes a compact stacked card list on a phone: no 720px min-width
  and no horizontal scroll. The header row is hidden, and the price, spark,
  rarity, and category stay visible.
- The stat strip stays three columns on a phone; labels wrap instead of
  overflowing.
- Pagination with per-page select wraps rather than widening the page.

### Inventories index (`/inventories`)

- Cards are one column on a phone; the demo card is no longer sticky and
  cannot overlay the cards below it.
- Search and sort each take their own row so the long “Sort: Value, high to
  low” label is not truncated.
- Long nicknames/values do not produce page-level horizontal scroll.
- Pagination wraps when needed.

### Inventory detail (`/inventories/:steam_id`)

- The three stat tiles stay in one compact 3-column row on a phone instead of
  becoming three full-width tiles.
- The profile avatar stays beside the nickname; the nickname gets a smaller
  mobile size and can wrap without pushing the page sideways.
- The rarity mix and top-items tile are full width; the top-items sort panel
  opens to the left when it is near the right edge.
- The hero chart uses the same mobile height/axis behavior as the dashboard.

### Admin panel (`/admin`)

- At `≤880px` the fixed 216px sidebar becomes a horizontal, scrollable nav
  bar above the content; group labels are hidden and the active link is
  underlined.
- Admin main padding and topbar padding shrink; the email chip is hidden at
  `≤560px`, leaving the avatar/sign-out affordance.
- The resource header/buttons wrap; the create form becomes one column; the
  table keeps its own horizontal scroll inside `.table-wrap`.
- Pagination controls wrap/scroll locally; buttons and icon buttons are
  touch-sized.
- Desktop admin layout at `>880px` is unchanged.

### Admin login (`/admin/session/new`)

- The card is `min(320px, 100vw - 32px)` with `box-sizing: border-box`, so it
  no longer renders at 386px on a 375px screen.
- The page is at least `100dvh` tall with no extra scrollbar, and the form
  inputs are 16px on a phone.

### Must remain unchanged

- All desktop layouts above the breakpoints, apart from the small alignment
  fixes explicitly listed here (sort panel alignment, login card width, chart
  axis alignment).
- Every data-loading hook, API call, reducer action, and backend endpoint.
- The public topbar’s server-rendered markup and admin authentication.
- The existing item/catalog/inventory data shapes and formatting rules.

## Scope

### In Scope

- Responsive CSS for `tokens.css`, `dashboard.css`, `inventories.css`,
  `tracked_items.css`, `admin-panel.css`, and `application.css`, using the
  approved values in `mockups/responsive/proposal.css`.
- A shared viewport helper (`shared/utils/viewport.js`) used by both new JS
  behaviors.
- The dashboard scroll-to-hero behavior in `PortfolioTile`.
- The one-time mobile Grid default for the items catalog.
- The `dropdown--end` modifier on the four sort-dropdown components.
- Vitest coverage for the viewport helper, scroll behavior, and catalog
  default.
- Manual responsive verification across the approved breakpoints.
- Deleting `mockups/responsive/` after the port is verified.

### Out of Scope

- Backend, API, database, workers, or `app_fetcher` changes.
- A redesign of any page beyond the approved mockup.
- New breakpoints beyond 960 / 880 (admin) / 640 / 560 / 400.
- A mobile card layout for the admin table (it keeps local horizontal
  scrolling), a hamburger menu, or a sticky topbar.
- Persisting the catalog view choice across reloads or sessions.
- Moving keyboard focus to the chart after a mobile item tap (scroll only).
- Updating `docs/images/*.png` screenshots.
- Styleguide creation/amendments — handled by `styleguides-check`, not this
  plan.
- Keeping `mockups/responsive/` as a committed reference.

## Implementation Approach

### CSS

Use the existing desktop-first `max-width` media-query pattern. Put each
responsive rule in the stylesheet that owns its selector, not all in
`tokens.css`:

- `tokens.css` owns the shared shell: topbar, nav, profile, tile head, list
  rows, items list, chart wrapper, dropdown panels, pager.
- `dashboard.css` owns the dashboard grid and items toolbar.
- `inventories.css` owns inventory cards, the inventory toolbar, the detail
  grid, stat tiles, and profile head.
- `tracked_items.css` owns the stat strip, catalog toolbar, view toggle,
  grid cards, and ticker layout.
- `admin-panel.css` owns the admin shell/nav/topbar/form/table/pagination.
- `application.css` owns flash placement and the standalone admin login.

This matters because `tokens.css` loads **before** each island’s stylesheet. A
media rule in `tokens.css` cannot override an equal-specificity island rule
loaded later; island-specific mobile rules must live in that island’s file.

Breakpoints after this change:

| Context | Query |
| --- | --- |
| Shared shell / dashboard / inventories / catalog / login | `max-width: 640px` |
| Tablet grids | `min-width: 641px` and `max-width: 960px` |
| Very narrow phones | `max-width: 400px` |
| Admin shell | `max-width: 880px` |
| Admin topbar chip | `max-width: 560px` |
| Coarse-pointer tablets | `pointer: coarse` and `min-width: 641px` |

The approved values live in `mockups/responsive/proposal.css` until the
folder is deleted. Fold them into the owning files; do not ship
`proposal.css` as a separate app stylesheet.

### JavaScript

- Add a shared, framework-free viewport utility with the 640px query and a
  reduced-motion query. It must guard a missing `window.matchMedia` so jsdom
  and non-browser environments fall back to the desktop behavior.
- In `PortfolioTile`, own a ref to the hero `<section>` and run an effect
  after a selection changes. Trigger only when item mode is active and the
  selected `marketHashName` changed; skip portfolio/deselect and desktop.
  Use `scrollIntoView({ block: 'start', behavior: reduced ? 'auto' : 'smooth' })`
  with an optional-call guard. `scroll-margin-top: 12px` on the mobile hero
  keeps a small gap above the tile.
- In `tracked_items/reducer.js`, keep the base `initialState.view = 'ticker'`
  and add a factory such as `createInitialState(isMobile = isMobileViewport())`
  returning `{ ...initialState, view: isMobile ? 'grid' : 'ticker' }`.
  `TrackedItems` initializes the reducer lazily with that factory, so the
  media query is read once and there is no ticker-to-grid flash.
- Add `dropdown--end` to the root of the dashboard, catalog, inventories, and
  top-items sort dropdowns; the left-hand filter dropdowns keep the default
  alignment. Add the matching panel alignment rule to `tokens.css`.

### Mockup lifecycle

`mockups/responsive/` remains the visual reference during implementation.
Delete the entire folder after the real pages are verified and before the
final commit; it must not become part of the app.

## Files To Modify

### JavaScript / JSX

- `app_core/app/frontend/dashboard/components/PortfolioTile.jsx`
  - Add `useRef`/`useEffect`, a section ref, and the mobile scroll effect.
  - Keep rendering behavior unchanged otherwise.
  - Why: the hero chart is the target of the approved mobile scroll.

- `app_core/app/frontend/tracked_items/TrackedItems.jsx`
  - Initialize `useReducer` with the new state factory (lazy init) instead of
    the static `initialState`.
  - Why: choose Grid on a phone without overriding the user’s later toggle.

- `app_core/app/frontend/tracked_items/reducer.js`
  - Export `createInitialState`, importing the shared mobile helper.
  - Keep `initialState` and all reducer actions unchanged.
  - Why: make the one-time initial view testable without mocking a browser
    API in the pure reducer test.

- `app_core/app/frontend/dashboard/components/SortDropdown.jsx`
- `app_core/app/frontend/tracked_items/components/SortDropdown.jsx`
- `app_core/app/frontend/inventories/components/InventorySortDropdown.jsx`
- `app_core/app/frontend/inventories/components/ItemsSortDropdown.jsx`
  - Add the `dropdown--end` class to the root element.
  - Why: right-aligned panels must not grow past the viewport on a phone.

### CSS

- `app_core/app/frontend/shared/styles/tokens.css`
  - Replace the `600px` media block with `640px`.
  - Add the shared overflow guards: wrapping tile heads, `min-width: 0` on
    headings/eyebrows, `max-width: calc(100vw - 32px)` on dropdown panels,
    wrapping `.list-pager`, and the `dropdown--end` panel alignment.
  - Add the two-row topbar, brand subtitle hiding, profile truncation/order,
    active-tab underline, and horizontal tab scrolling.
  - Add phone touch sizing for shared controls, safe-area bottom padding,
    `touch-action: manipulation`, the `240px` chart minimum, and
    `scroll-margin-top: 12px` on the hero.
  - Hide `.mover-row-empty` and remove the items-list max-height/overflow on
    a phone.
  - Add the `≤400px` brand/hero/row-size/sparkline rules.
  - Add the coarse-pointer touch sizing.
  - Remove the dead `.chart-yaxis` rule and the 40px x-axis spacer override;
    keep the 54px spacer/note alignment.
  - Why: shared chrome and list/chart behavior live here.

- `app_core/app/frontend/dashboard/styles/dashboard.css`
  - Replace `920px` with `960px` for the two-column tablet grid and keep the
    `420px` list clamp only there.
  - Replace `600px` with `640px`; make the dashboard one column, hero/items
    full width, and the items toolbar a two-column grid.
  - Why: dashboard-specific grid/toolbar rules.

- `app_core/app/frontend/inventories/styles/inventories.css`
  - Replace `1000px` with `960px` for the tablet grid.
  - Add the profile-head overflow guards and mobile profile sizing.
  - In the `≤640px` block: one-column inventory cards, static demo card,
    stacked search/sort rows, 40px controls, 16px search input, three-column
    compact stat row, full-width rarity/top-items, and wrapping pagination.
  - Why: these selectors are inventory-specific.

- `app_core/app/frontend/tracked_items/styles/tracked_items.css`
  - Rewrite the `≤640px` block for the 3-column stat strip, grid toolbar,
    two-column item grid, full-width view toggle with equal segments, and the
    stacked ticker card layout.
  - Add `16px` search/per-page sizing and a `≤400px` stat-size adjustment.
  - Why: catalog-specific layout.

- `app_core/app/frontend/admin-panel/styles/admin-panel.css`
  - Add `@media (max-width: 880px)` for the horizontal nav, column shell,
    reduced main/topbar padding, one-column form, and `100dvh` root sizing.
  - Add `@media (max-width: 640px)` for resource-head padding, button/icon/
    pager sizing, wrapping pagination, and 16px form/select inputs.
  - Add `@media (max-width: 560px)` to hide `.shell .admin-chip`.
  - Add the coarse-pointer admin button sizing.
  - Scope topbar/chip selectors under `.shell`; they are outside
    `.admin-shell`.
  - Why: the admin panel currently has no responsive rules.

- `app_core/app/assets/stylesheets/application.css`
  - Make `.admin-login` border-box with `100vh`/`100dvh` fallback and 16px
    padding; make `.admin-login-card` border-box with the `min(320px, ...)`
    width.
  - Add the `≤400px` card padding.
  - Change the flash `600px` query to `640px` and move the toast stack to
    `top: 112px`.
  - Add 16px login input sizing on a phone.
  - Do not add another `body { margin: 0 }` — it already exists here.
  - Why: the standalone ERB login page and global toasts are not covered by
    the Vite stylesheets.

### Tests

- `app_core/app/frontend/dashboard/__tests__/PortfolioTile.test.jsx`
  - Add mobile-scroll coverage (see Test Plan).
- `app_core/app/frontend/tracked_items/__tests__/TrackedItems.test.jsx`
  - Add the phone-default Grid test; existing ticker expectations remain.
- `app_core/app/frontend/tracked_items/__tests__/reducer.test.js`
  - Add factory tests for explicit mobile/desktop flags; keep
    `initialState.view === 'ticker'`.

### Cleanup

- Delete `mockups/responsive/` (untracked) after verification.
- No ERB view changes, no backend changes, no docs screenshot changes.

## Files To Create

- `app_core/app/frontend/shared/utils/viewport.js`
  - Responsibility: one place for the `640px` mobile query and the
    reduced-motion query, with a safe fallback when `matchMedia` is absent.
  - Why: both the dashboard scroll and the catalog default must use the same
    breakpoint, and both islands need the same guard.

- `app_core/app/frontend/shared/__tests__/viewport.test.js`
  - Responsibility: unit tests for the helper’s true/false/missing-API paths.
  - Why: keep the JS breakpoint behavior deterministic without rendering.

## Test Plan

### New unit tests — `viewport.test.js`

- `isMobileViewport()` returns the `matches` value of
  `(max-width: 640px)`.
- It returns `false` when `window.matchMedia` is missing.
- `prefersReducedMotion()` returns the `matches` value of the reduced-motion
  query.
- Restore stubs in `afterEach` (`vi.unstubAllGlobals`).

### New/changed `PortfolioTile.test.jsx`

Use `vi.stubGlobal('matchMedia', ...)` and a stubbed
`Element.prototype.scrollIntoView`; restore both after each test.

- Item mode + mobile → `scrollIntoView` called once with
  `{ block: 'start', behavior: 'smooth' }`.
- Item mode + mobile + reduced motion → `behavior: 'auto'`.
- Item mode + desktop → not called.
- Portfolio mode → not called.
- Switching from item A to item B while in item mode → called again.
- Switching back to portfolio (same item deselected) → not called again.
- Keep all existing value/delta/period assertions unchanged.

### New/changed `TrackedItems.test.jsx`

- With `matchMedia` reporting a phone width before render, the first render
  contains `.grid-view` and not `.ticker-wrap`.
- With `matchMedia` absent (the existing jsdom situation), the first render
  stays on Ticker so the current “switching Ticker to Grid” test remains
  meaningful.
- The existing Ticker→Grid no-refetch test and all fetch/mutation tests remain
  green.

### New/changed `tracked_items/__tests__/reducer.test.js`

- `createInitialState(false).view === 'ticker'`.
- `createInitialState(true).view === 'grid'`.
- The base `initialState.view` remains `'ticker'` for reducer unit tests.

### Regression coverage

- Full `npm run test` for both islands and shared code.
- Existing Dashboard/ItemsTile/Inventory tests must pass unchanged.
- No CSS unit tests exist; CSS is covered by the manual matrix below.

## Implementation Steps

1. **Add the viewport helper and tests.**
   Create `shared/utils/viewport.js`; export the 640px query constant,
   `isMobileViewport`, and `prefersReducedMotion`; guard missing
   `matchMedia`; add `viewport.test.js`.

2. **Implement the dashboard scroll.**
   Add the ref/effect to `PortfolioTile`; add the mobile `scroll-margin-top`;
   extend `PortfolioTile.test.jsx` with the mobile/desktop/reduced-motion/
   switch/back cases. Run that test file.

3. **Implement the one-time Grid default.**
   Add `createInitialState` to the tracked-items reducer; use lazy reducer
   initialization in `TrackedItems`; add reducer and component tests. Run the
   tracked-items suite.

4. **Add `dropdown--end`.**
   Add the class to the four sort dropdowns and the panel alignment rule in
   `tokens.css`. No new tests; existing dropdown tests must stay green.

5. **Shared shell CSS (`tokens.css`).**
   Fold in the topbar, nav, profile, touch sizing, safe area, inputs-adjacent
   rules, list/chart mobile rules, overflow guards, `≤400px` rules, and the
   chart-axis alignment fix. Keep desktop declarations untouched.

6. **Dashboard CSS.**
   Replace the 920/600 blocks with the 960 tablet and 640 phone blocks;
   convert the items toolbar to the two-button grid and remove the phone
   list clamp. Verify the desktop grid is unchanged.

7. **Inventories CSS.**
   Replace 1000 with 960; add profile-head guards and the phone rules for
   cards, toolbar, stat row, rarity, and top items.

8. **Tracked-items CSS.**
   Rewrite the 640 block for stat strip, toolbar, grid, ticker cards, view
   toggle, search/per-page sizing, and the 400px stat adjustment.

9. **Admin CSS.**
   Add the 880/640/560/coarse rules with `.shell` scoping for the topbar and
   chip. Confirm the desktop admin layout is unchanged at 1440.

10. **Application CSS.**
    Fix the login card/height/input sizing and move the flash query to 640
    with the new top offset. Do not duplicate the body reset.

11. **Run the JS checks.**
    `npm run test`, `npm run lint`, `npm run format:check` in `app_core`; fix
    formatting with `npm run format` if needed.

12. **Manual responsive verification.**
    Use the matrix below, compare against `mockups/responsive/` while it
    still exists, and fix any regression. Pay special attention to the two
    new behaviors and to page-level horizontal scroll.

13. **Delete the mockup.**
    Remove `mockups/responsive/` entirely; confirm `git status` contains only
    the intended app/test changes.

14. **Final verification.**
    Run the full suite once more (and `bin/ci` if the local Docker stack is
    available). Report the files changed and the manual checks performed.

## Verification

### Automated

- `cd app_core && npm run test`
- `cd app_core && npm run lint`
- `cd app_core && npm run format:check`
- `cd app_core && bin/ci` when the database/Redis stack is available
  (includes RSpec, Sorbet, RuboCop, Brakeman, bundler-audit, frontend tests).

### Manual matrix

Widths: **320×568, 375×667, 390×844, 414×896, 768×1024, 1024×768,
1440×900**.

Pages/flows:

- `/` signed out, signed in/demo, and item mode.
- `/tracked-items` fresh load, Grid/Ticker toggle, filters, search, pagination.
- `/inventories` with demo card and multiple cards.
- `/inventories/:steam_id` with a long nickname.
- `/admin/session/new` and `/admin` (Items page plus create form/menu).
- Flash toast on a public page at 390.

Specific checks:

- `document.documentElement.scrollWidth <= window.innerWidth` on every page
  and width.
- Dashboard mobile: tap item → page scrolls to the hero with a small gap;
  tap another item → scrolls again; tap the selected item → portfolio and no
  scroll; desktop tap → no scroll; reduced-motion emulation → instant.
- Items mobile: fresh load is Grid; toggle to Ticker shows compact cards
  without horizontal scroll; resizing does not flip the current view.
- Topbar tabs/profile never force page-level scroll; long nicknames truncate.
- Inventory detail stat tiles are one row at 390; profile avatar and name stay
  side by side.
- Admin sidebar becomes a horizontal nav; table scrolls inside its wrapper;
  login card is 320px and the page is one viewport tall.
- Dropdown panels at the right edge open inward, not off-screen.
- Touch targets are comfortably tappable; focusing a search/login input on a
  phone does not zoom the page (DevTools device emulation).
- Desktop pages at 1440 retain the current 3-column dashboard, 3-column
  inventory grid, and admin sidebar.

## Risks

- **CSS load order.** `tokens.css` loads before island styles; responsive
  rules that override an island selector of equal specificity must live in
  that island’s stylesheet. Copying `proposal.css` wholesale into
  `tokens.css` will silently lose rules.
- **Fixed-height list rule.** The `react-dashboard.md` rule requires
  placeholder rows on desktop/tablet; hiding them at `≤640px` is a
  documented mobile exception (see `responsive-layout.md`). Do not apply
  the exception above 640px or stop paginating the list.
- **jsdom lacks `matchMedia`/`scrollIntoView`.** Both helpers/effects must
  guard; tests must stub locally rather than making the whole suite pretend
  to be mobile.
- **Existing ticker-default test.** It passes only because jsdom has no
  `matchMedia`. Do not add a global mobile `matchMedia` stub to
  `setup.js`; stub per test.
- **Breakpoint drift.** 640 appears in CSS and JS. The new helper is the
  single JS source; the styleguide should require updating both together.
- **Admin scope reversal.** Previous admin plans explicitly deferred mobile;
  this plan deliberately supersedes that. Keep the desktop admin layout
  untouched above 880.
- **Admin topbar selectors.** The topbar/chip sit outside `.admin-shell`;
  use `.shell > .topbar` / `.shell .admin-chip` or they will not apply.
- **Chart axis alignment.** Keep the 54px spacer and `.chart-note` padding;
  removing the dead `.chart-yaxis` rule must not change the x-axis offset.
- **Long content.** A very long unbroken nickname or item name must not
  produce horizontal overflow; the profile-head/name and tile-head guards are
  part of the fix, not optional polish.
- **Safe areas/dvh.** `100dvh` and `env(safe-area-inset-bottom)` should have
  sane fallbacks and not add scroll height on desktop.
- **Mockup deletion.** Delete only `mockups/responsive/` after the port; do
  not delete `docs/images` or app assets. The cropped mockup icons are not
  app assets and must not be copied into the app.

## Assumptions

- The approved mockup is the source of truth for the visual values; no
  further design changes are expected during implementation.
- The mobile breakpoint is 640px in both CSS and JS.
- “Mobile” for the dashboard scroll and catalog default means the 640px
  breakpoint, checked at the moment of selection/initial mount respectively.
- Scrolling happens on any selected-item change (including item → item), but
  not on return to portfolio and not on desktop.
- The scroll target is the hero section, not just the chart plot, with a
  small `scroll-margin-top`.
- The catalog Grid default is evaluated once on first mount; it does not
  listen for resize and does not persist across reloads.
- The admin panel is in scope despite older plans deferring it.
- No backend/API changes are needed.
- `mockups/responsive/` is a temporary review artifact and is deleted after
  verification.
- The responsive-layout guide and the `react-dashboard.md` amendment are
  approved and apply; no styleguide work remains in the implementation
  steps.

## Completion Criteria

- The plan’s desired behavior is explicit and observable.
- Scope and out-of-scope areas are explicit.
- All affected CSS/JS/test files are identified, including the chart-axis
  and admin-scope corrections.
- The test strategy covers both new behaviors and the existing regression
  surface.
- Implementation steps are ordered and actionable without redesign.
- Verification includes automated checks and a concrete responsive matrix.
- The plan is written to `agent/plans/mobile-responsive-pass.md`.
- `mockups/responsive/` is removed at the end of implementation.

---

# Implementation Summary

## Implemented

### Behavior

- `shared/utils/viewport.js`: added `MOBILE_MEDIA_QUERY` (`(max-width: 640px)`),
  `isMobileViewport()`, and `prefersReducedMotion()`, all guarded for
  environments without `window.matchMedia`.
- `dashboard/components/PortfolioTile.jsx`: owns a ref to the hero section and
  scrolls it into view when item mode is entered or the selected item changes
  on a phone. It does not scroll on desktop, in portfolio mode, or when the
  same item is deselected; reduced motion gets an instant scroll.
- `tracked_items/reducer.js` + `TrackedItems.jsx`: added `createInitialState`
  and used it as `useReducer`’s lazy initializer, so a fresh phone load starts
  in Grid while `initialState` stays desktop-neutral and the user’s later
  Toggle is never overridden by a resize.
- Added `dropdown--end` to the four sort dropdown components, with the
  matching right-aligned panel rule.

### CSS

- `tokens.css`: two-row phone topbar, tab underline, profile truncation,
  safe-area padding, touch sizing, shared overflow guards, 240px phone chart,
  `scroll-margin-top`, phone list/placeholder behavior, narrow-phone row
  sizing, coarse-pointer sizing, and the 54px x-axis spacer alignment fix
  (dead `.chart-yaxis` rule removed).
- `dashboard.css`: 960px tablet / 640px phone breakpoints; phone items
  toolbar is a two-button grid.
- `inventories.css`: 960px tablet; profile-head overflow guards; phone
  card/toolbar/stat-row/profile rules; 400px stat sizing.
- `tracked_items.css`: phone stat strip, catalog toolbar grid, two-column
  grid, full-width segmented view toggle, stacked ticker cards, 16px
  search/per-page sizing, and 400px stat sizing.
- `admin-panel.css`: 880px horizontal nav shell, 640px touch/form/table
  rules, 560px email-chip hiding, and coarse-pointer button sizing.
- `application.css`: border-box/`min(320px, …)` login card, `100dvh` with
  fallback, phone padding and 16px login inputs, flash moved to 640px and
  `top: 112px`, 400px card padding. The existing body reset was kept (not
  duplicated).

### Cleanup

- Deleted the approved `mockups/responsive/` review artifact after the port
  and verification.

## Tests

- Added `shared/__tests__/viewport.test.js` — 6 tests for the mobile and
  reduced-motion queries and the missing-`matchMedia` fallback.
- Extended `dashboard/__tests__/PortfolioTile.test.jsx` — mobile smooth
  scroll, reduced-motion instant scroll, desktop no-scroll, portfolio
  no-scroll, item→item re-scroll, and deselect no-scroll (16 tests total in
  the file).
- Extended `tracked_items/__tests__/reducer.test.js` — `createInitialState`
  desktop/mobile flags.
- Extended `tracked_items/__tests__/TrackedItems.test.jsx` — fresh phone load
  renders Grid; the existing Ticker-default expectations still pass under
  jsdom.

Commands executed:

- `cd app_core && npx vitest run shared/__tests__/viewport.test.js` → 6 passed.
- `cd app_core && npx vitest run dashboard/__tests__/PortfolioTile.test.jsx` → 16 passed.
- `cd app_core && npx vitest run tracked_items/__tests__/reducer.test.js tracked_items/__tests__/TrackedItems.test.jsx` → 25 passed.
- `cd app_core && npm run test` → 56 files / 345 tests passed.
- `cd app_core && npm run format:check` → all files pass.
- `cd app_core && npm run lint` → 0 errors, 1 pre-existing warning in
  `TrackedItems.jsx` (`react-hooks/exhaustive-deps` on the unchanged `items`
  memo; not introduced by this change).

## Verification

- **Real-CSS layout matrix:** the approved mockup markup was loaded with the
  mockup’s `proposal.css` disabled, so only the real app stylesheets applied.
  Checked 320 / 375 / 390 / 414 / 768 / 1024 / 1440 for dashboard, item mode,
  inventories, inventory detail, items (grid + ticker), admin, and admin
  login. Every page had `documentElement.scrollWidth === innerWidth`; the
  measured chart, stat tiles, grid columns, toolbar grids, admin nav, and
  login card matched the approved layout.
- **Visual checks:** inspected phone screenshots at 390 for dashboard, item
  mode, inventories, detail, items grid/ticker, admin, and login; inspected
  desktop dashboard, items, and admin at 1440. Desktop density/structure is
  unchanged.
- **Behavior:** covered by Vitest as listed above; the live Rails app was not
  started in this worktree because it has no `.env`/database.
- `bin/ci` was not run (no local Docker/DB stack); the Ruby suite is
  unaffected by this frontend/CSS-only change.

## Deviations

- Added `min-width: 0` to `.profile-group`, `.profile-chip`, and
  `.profile-name` on phone so a 401–414px topbar can shrink/ellipsize the
  profile name instead of wrapping or overflowing. This is a small
  robustness addition on top of the mockup’s max-width.
- The admin coarse-pointer sizing is scoped to `.shell` (not just
  `.admin-shell`) so the topbar Sign out button is included.
- The mockup’s `proposal.css` was folded into the owning stylesheets rather
  than shipped as a separate file, as required by the responsive-layout
  guide and CSS load order.
- The existing `body { margin: 0 }` in `application.css` was reused; no
  duplicate reset was added.
- The plan’s `chart-xaxis-spacer` correction keeps the 54px axis, so the
  dead `.chart-yaxis` mobile block was removed instead of preserved.

## Remaining Issues

- `TrackedItems.jsx` still has the pre-existing ESLint
  `react-hooks/exhaustive-deps` warning around the unchanged `items`
  initialization. It does not fail lint; fixing it is a separate small
  cleanup.
- A live Rails/DB browser pass (including the scroll gesture and the
  admin session) was not possible in this worktree; run `app_core/bin/ci` and
  a real-browser pass before merge. The JS behavior is covered by the new
  Vitest cases, and the CSS layer by the real-stylesheet matrix above.
- `docs/images/*.png` screenshots were not regenerated (explicitly out of
  scope).
