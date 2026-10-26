# Desktop-First Responsive Layer for `app_core`

## Status

Accepted

## Context

`app_core` has grown from one React island into several public pages
(dashboard, tracked items, inventories, inventory detail) plus an admin
panel and a standalone ERB login page. Their CSS is split deliberately:
`shared/styles/tokens.css` carries the shared shell and design tokens, each
island has its own stylesheet, and the admin/login pages have their own
files.

That split works on desktop, but responsive behavior was added ad hoc. The
public pages use four different breakpoints (`920px`/`600px` for the
dashboard, `1000px`/`640px` for inventories, `640px` for the catalog,
`600px` for the shared shell and flash stack), and the admin panel has no
responsive rules at all. The result is a working desktop product that is
hard to use on a phone:

- the topbar’s brand, three tabs, and profile chip do not fit a 375px row;
- the dashboard’s item list is a fixed-height nested scroller with
  placeholder rows designed for a desktop tile;
- the catalog opens its wide ticker table, which needs horizontal scrolling
  on a phone;
- inventory detail stacks three stat tiles into a very tall column;
- the admin sidebar consumes more than half of a phone viewport;
- the login card renders at 386px (320px content + 64px padding) because it
  lacks `box-sizing`;
- several controls are smaller than a comfortable touch target, and
  inputs below 16px trigger iOS focus zoom.

The approved mockup and the resulting work are tracked in
`agent/plans/mobile-responsive-pass.md`. Two behaviors are viewport-
dependent beyond CSS: the dashboard should scroll to its hero chart after a
mobile item selection, and the catalog should start in Grid on a phone.
There is no shared JS viewport helper today, and `react-dashboard.md`’s
fixed-height list rule does not describe a mobile exception.

The admin panel was previously declared desktop-only in
`agent/plans/admin-panel-frontend.md`; mobile use is now a product
requirement, so that scope decision is superseded.

## Decision

Adopt a **desktop-first responsive layer** for `app_core`:

- Keep the existing desktop declarations as the base and add overrides with
  `max-width` media queries. Do not rewrite the stylesheets mobile-first.
- Use one breakpoint scale: `960px` (tablet grids), `880px` (admin shell),
  `640px` (phone), `560px` (admin topbar chip), `400px` (narrow phone), plus
  `pointer: coarse` for touch sizing on larger touch devices.
- Place each responsive rule in the stylesheet that owns its selector:
  `tokens.css` for shared shell, the island stylesheet for island layout,
  `admin-panel.css` for the admin panel, and `application.css` for the
  standalone login + flash stack. Do not create a single shared
  `responsive.css` that all pages import.
- Use one JS viewport helper, `shared/utils/viewport.js`, for behavior that
  CSS cannot express (mobile scroll-on-selection, catalog’s initial Grid).
  Its mobile query is the same `640px` breakpoint as the CSS.
- Evaluate viewport-dependent initial UI state once, through a reducer
  state factory / lazy initializer. Never flip the user’s view on resize.
- On a phone, the dashboard list abandons the fixed `PAGE_SIZE` height:
  placeholder rows are hidden and the page scrolls normally. Desktop and
  tablet keep the fixed-height list rule.
- Apply phone touch sizing (`34–40px` for compact controls) and `16px`
  inputs; respect `prefers-reduced-motion` for smooth scrolling; use
  `100dvh`/safe-area insets where the viewport edges matter.
- Keep local horizontal scrolling only where a genuinely tabular surface
  needs it (the admin table); no page may gain a document-level horizontal
  scrollbar.
- Delete the temporary `mockups/responsive/` review artifact after the real
  implementation lands; it is not a product asset.

## Alternatives Considered

### Alternative: rewrite the stylesheets mobile-first

Start with phone rules as the base and add `min-width` overrides for larger
screens.

Rejected because it would rewrite every stylesheet and every desktop
declaration, creating a large regression surface for a change whose desktop
result should be unchanged. The existing code is desktop-first and the team
is small; adding scoped overrides is the lower-risk path. The breakpoint
scale and ownership rules still give the layer a consistent shape.

### Alternative: one shared responsive stylesheet

Collect all media queries in a new `responsive.css` (or keep the mockup’s
`proposal.css`) loaded after every page stylesheet.

Rejected because it separates a rule from the selector it belongs to and
turns specificity into a global concern. It also hides the fact that
`tokens.css` loads before island styles; a shared file loaded last would
mask that constraint instead of making it explicit. The project already
uses one-stylesheet-per-owner as its CSS convention.

### Alternative: keep the existing ad-hoc breakpoints

Continue adding whatever width each page seems to need.

Rejected because the current 920/1000/600/640 mix already causes different
pages to switch layout at different widths and makes cross-page review
guesswork. A shared scale makes the responsive behavior predictable and
reviewable.

### Alternative: solve viewport behavior with CSS only

Use CSS to hide/show the ticker/grid and rely on scroll anchoring for the
item selection.

Rejected because CSS cannot choose a one-time initial view without also
overriding a user’s later toggle, and it cannot scroll the page to the hero
after a selection. The two behaviors need a tiny JS layer with a guarded
viewport check.

### Alternative: separate mobile components/routes

Build dedicated mobile versions of the catalog/dashboard and pick one at
render time.

Rejected as premature duplication. The same components, markup, reducers,
and data hooks work at both sizes; the differences are layout and two small
behaviors. Copying them would create two implementations to keep in sync
and would fragment the tests.

### Alternative: a mobile card layout for the admin table

Replace the admin table with stacked cards on a phone.

Rejected for this pass: the admin panel is an internal ops surface, and the
approved scope is to make it reachable and usable with a horizontal nav and
a locally scrolling table. A card redesign is a larger product change that
can be evaluated separately if the admin panel becomes a phone-first tool.

### Alternative: adopt a UI framework or utility CSS

Use Tailwind, a component library, or CSS-in-JS to get responsive utilities.

Rejected because the project’s frontend conventions deliberately use plain
CSS with one stylesheet per owner and no Tailwind/CSS modules. Introducing a
framework is a separate architectural decision, not a prerequisite for
fixing phone layouts.

## Consequences

### Positive

- Every page switches layout at a predictable set of widths, and the admin
  panel stops being unusable on a phone.
- Responsive rules stay next to the selectors they own; a contributor can
  read one island’s stylesheet and understand its phone behavior.
- A single JS viewport helper removes the risk of the dashboard and catalog
  checking different mobile breakpoints.
- The phone list no longer creates a nested scroll trap; touch users scroll
  one surface (the page).
- The login page, touch targets, and input zoom issues are fixed as part of
  the same consistent layer.

### Negative

- Desktop-first overrides mean the base declarations and the phone block
  must both be read to understand a selector.
- Breakpoints are duplicated between CSS and the JS helper; changing 640px
  requires updating both.
- The admin table keeps a local horizontal scroll on a phone rather than a
  tailored card layout.
- The responsive layer adds a substantial CSS diff without a CSS test suite;
  verification depends on a manual viewport matrix.

### Risks

- **Breakpoint drift** if CSS and `MOBILE_MEDIA_QUERY` diverge. The
  responsive styleguide makes the sync rule explicit.
- **Load-order mistakes**: a rule placed in `tokens.css` can be overridden
  by an equal-specificity island rule loaded later.
- **Touch sizing applied too broadly** could make the desktop UI feel
  oversized; the phone block and `pointer: coarse` keep it scoped.
- **Viewport-dependent state re-evaluated** on rerenders/resizes could flip
  the catalog view under the user; the decision requires a one-time lazy
  initializer.
- **Scroll behavior on desktop** or on deselect would be surprising; the
  effect is gated on item selection and the mobile viewport.
- **Admin scope creep**: the approval is for the shell/table/form to be
  usable, not a full admin redesign.

## Implementation Constraints

- The phone breakpoint is `640px` in CSS and in
  `shared/utils/viewport.js`; update both together.
- Responsive rules live in the owning stylesheet, after the base
  declarations; shared shell rules stay in `tokens.css`, island rules in the
  island file.
- No page-level horizontal scroll. Admin tables and similar genuinely
  tabular surfaces may scroll inside their own wrapper.
- Phone controls use the approved `34–40px` sizing; text inputs/selects use
  `16px` to prevent iOS focus zoom.
- The dashboard list’s fixed-height/placeholder behavior is desktop/tablet
  only; at `≤640px` the list flows and placeholders are hidden.
- The chart’s x-axis spacer and `.chart-note` stay aligned with the Recharts
  Y-axis (54px); the dead `.chart-yaxis` rule must not be reintroduced.
- Sort dropdowns at the right edge use `dropdown--end` and a viewport-clamped
  panel width.
- Admin topbar/chip selectors are scoped under `.shell` because they sit
  outside `.admin-shell`.
- The login card uses `box-sizing: border-box` and
  `min(320px, calc(100vw - 32px))`; `100dvh` has a `100vh` fallback.
- Verification covers 320/375/390/414/768/1024/1440 widths, reduced motion,
  and the admin/login pages.

## Related

- `agent/styleguides/core/responsive-layout.md` — how responsive rules,
  breakpoints, touch sizing, and viewport behavior must be implemented.
- `agent/styleguides/core/react-dashboard.md` — the React-side rules for
  viewport-dependent state/effects and the mobile fixed-height exception.
- `agent/plans/mobile-responsive-pass.md` — the implementation plan that
  first applies this decision.
- `agent/plans/admin-panel-frontend.md` — the earlier desktop-only admin
  scope note that this decision supersedes for phone use.
