---
status: implemented
app: core
goal: Stop the hero chart from collapsing its x-axis into repeated "today" labels when a new account has a near-empty (single-point) series
created: 2026-10-29
---

# Development Plan

## Goal

When a series has no meaningful time span (a brand-new account whose
portfolio history is just the single "live" point, or an item whose price
points all fall within the same hour), the shared hero chart currently
renders `today` on every x-axis tick. Make the chart fall back to the
nominal-period domain and labels for such a degenerate span, exactly as it
already does for an empty series, instead of emitting five identical
`today` labels.

## Expected Behavior

- A `7d` chart whose series is a single point at `now` renders the
  nominal `7d` domain and the canonical labels
  (`7d ago / 5d ago / 4d ago / 2d ago / today`), with the point sitting
  at the right edge — the same result as an empty series. No tick repeats
  `today`.
- A series whose points all lie within one hour behaves the same way
  (nominal domain + canonical labels) rather than a stack of `today`
  ticks.
- The existing behaviors are unchanged:
  - a series that covers the period keeps canonical labels
    (`7d ago … today`, `24h ago … now`, `12mo … today`);
  - a series shorter than the period but still multi-day (e.g. five days
    in `7d`) keeps its real-span labels (`5d ago … today`) and shrinks the
    axis to the data;
  - a mature series anchors at the period boundary and clips older points;
  - `'all'` keeps its blank-label treatment (no fixed span to count from);
  - the y-axis, tooltip, partial-estimate markers, period sets, and CSS
    are untouched.

## Scope

### In Scope

- `app_core/app/frontend/shared/chartConfig.js` — define the minimum
  meaningful axis span and make `generateAxisLabels` fall back to
  `PERIOD_MS[period]` when the effective span is smaller than it.
- `app_core/app/frontend/shared/components/HeroChart.jsx` — apply the same
  minimum-span threshold to `hasAxisSpan` so the x-domain also falls back
  to `[periodStart, now]` for a degenerate series.
- The two existing test files that cover these units:
  `shared/__tests__/chartConfig.test.js` and
  `shared/__tests__/HeroChart.test.jsx`.

### Out of Scope

- The backend (`app_fetcher`). A new account genuinely has a single live
  point; the `/api/v1`/`/api/public` query windows are correct and
  unchanged.
- Fabricating data to fill the gap — out of the question, as before.
- The `'all'` single-point domain (its labels are already blank except a
  trailing `today`, so it does not exhibit the repeated-`today` bug).
- The separate pre-existing limitation where a sub-four-hour span produces
  duplicated hour labels (`2h ago, 2h ago, 1h ago, 1h ago`). The reported
  bug is the all-`today` collapse, not this milder duplicate-label case.

## Implementation Approach

The chart already has a "no span" fallback: `HeroChart` uses
`[periodStart, now]` as the domain when `hasAxisSpan` is false, and
`generateAxisLabels` substitutes `PERIOD_MS[period]` when `end <= start`.
The bug is that a single-point series is *not* caught by either fallback:
`axisEnd` (`Date.now()`) exceeds `axisStart` (the point's timestamp) by a
few milliseconds, so `hasAxisSpan` is true and `span` is a positive but
meaningless number of milliseconds. `labelUnit` downgrades to hours,
`spanUnits ≈ 0`, and `Math.round(spanUnits * (1 - frac))` yields `0` for
every tick — hence `today` everywhere.

Fix by giving "meaningful span" an explicit floor shared by both sites:

- In `chartConfig.js`, add an exported
  `MIN_AXIS_SPAN_MS = UNIT_MS.h` (one hour — the finest label unit).
- In `generateAxisLabels`, compute the span as the effective `end - start`
  only when it is at least `MIN_AXIS_SPAN_MS`; otherwise use
  `PERIOD_MS[period]`.
- In `HeroChart`, import `MIN_AXIS_SPAN_MS` and change `hasAxisSpan` from
  `axisEnd > axisStart` to `axisEnd - axisStart >= MIN_AXIS_SPAN_MS`.

Because `generateAxisLabels` receives the same `axisStart`/`axisEnd` that
`HeroChart` used for the domain, both fall back together: a degenerate
series gets the nominal domain *and* the nominal labels, matching the
empty state.

## Files To Modify

- `app_core/app/frontend/shared/chartConfig.js`
  - add `export const MIN_AXIS_SPAN_MS = UNIT_MS.h`;
  - change the `span` computation in `generateAxisLabels` to require
    `end - start >= MIN_AXIS_SPAN_MS`;
  - reason: single source of truth for "what span is worth labelling".
- `app_core/app/frontend/shared/components/HeroChart.jsx`
  - import `MIN_AXIS_SPAN_MS`;
  - change `hasAxisSpan` to use the `>= MIN_AXIS_SPAN_MS` threshold;
  - reason: make the x-domain fall back to `[periodStart, now]` for the
    same degenerate series, so the point renders at "today" on a sane axis.
- `app_core/app/frontend/shared/__tests__/chartConfig.test.js`
  - add degenerate-span cases (zero span and sub-hour span → canonical
    nominal labels, not repeated `today`);
  - reason: lock the fallback in a pure-function test.
- `app_core/app/frontend/shared/__tests__/HeroChart.test.jsx`
  - add a single-point `7d` case asserting `7d ago` is present and
    `today` appears exactly once;
  - reason: regression coverage for the reported symptom.

## Files To Create

None.

## Test Plan

- `shared/__tests__/chartConfig.test.js` (pure function):
  - `generateAxisLabels('7d', NOW, NOW)` (zero span) → canonical
    `['7d ago', '5d ago', '4d ago', '2d ago', 'today']`;
  - `generateAxisLabels('7d', NOW - 1, NOW)` (sub-hour span) → the same
    canonical labels, proving no `today`-collapse;
  - keep the existing full-period, short-series, and `'all'` cases green.
- `shared/__tests__/HeroChart.test.jsx` (component):
  - a single-point `7d` series renders `7d ago` and exactly one `today`;
  - the existing short-series (`48h ago`, no `7d ago`) and mature-series
    (`7d ago`, no `8d ago`) cases keep passing.

## Implementation Steps

1. In `chartConfig.js`, add `export const MIN_AXIS_SPAN_MS = UNIT_MS.h`
   after the `UNIT_MS` declaration and tighten the `span` expression in
   `generateAxisLabels`.
2. In `HeroChart.jsx`, import `MIN_AXIS_SPAN_MS` and update the
   `hasAxisSpan` predicate; adjust the inline comment to mention the
   single-point/degenerate-span fallback.
3. Add the degenerate-span cases to `chartConfig.test.js` (red first —
   the current code produces `today`×5 for the sub-hour input).
4. Add the single-point regression case to `HeroChart.test.jsx`.
5. Run the frontend suite and confirm all chart tests pass.

## Verification

- `app_core`: `npm test` (Vitest), `npm run lint`,
  `npm run format:check` — the same checks `bin/ci` runs.
- Manual: on a fresh account whose portfolio has only the live point,
  open `7d` (and `30d`, `1y`) and confirm the x-axis reads the canonical
  labels with a single `today`, not a row of `today`s.

## Risks

- The one-hour floor is a judgment call; it is the finest label unit, so
  any span below it cannot currently produce distinct labels anyway.
  A series that genuinely spans 30–59 minutes (rare) now falls back to the
  nominal period rather than showing minutes — acceptable, since the label
  system has no minute unit.
- The floor must keep full-period and short-series labels byte-identical;
  the existing unit tests plus the new ones guard this.

## Assumptions

- `Date.now()` on the frontend is always at least slightly after the live
  point's `Time.current` timestamp, so a single-point series produces a
  tiny positive `end - start` (verified by tracing `HeroChart` and
  `InventoryValueQuery.history`).

## Applicable Styleguides

- `agent/styleguides/core/react-dashboard.md` — constrains the chart
  x-axis rule ("Hero chart x-axis: span the data, not just the period",
  now including the degenerate-span fallback) that the `HeroChart.jsx` and
  `chartConfig.js` changes implement, and the Vitest/`@testing-library`
  conventions (`shared/__tests__/`, `.test.js` vs `.test.jsx`, explicit
  vitest imports) the two test-file changes follow.
- `agent/styleguides/git-commits.md` — the `[Scope] Imperative summary`
  commit message (`[Core] …`) used when the change is committed.

## Completion Criteria

- the desired behavior is explicit;
- scope is explicit;
- affected files are identified;
- test strategy is defined;
- implementation steps are ordered;
- verification is defined;
- the plan has been written to
  `agent/plans/fix-chart-degenerate-span-labels.md`.

# Implementation Summary

## Implemented

- `app_core/app/frontend/shared/chartConfig.js` — added exported
  `MIN_AXIS_SPAN_MS = UNIT_MS.h` (one hour, the finest label unit) and
  tightened `generateAxisLabels`' span computation to
  `end > start && end - start >= MIN_AXIS_SPAN_MS ? end - start : PERIOD_MS[period]`,
  so a sub-hour span falls back to the nominal period instead of
  collapsing every tick to `today`.
- `app_core/app/frontend/shared/components/HeroChart.jsx` — imported
  `MIN_AXIS_SPAN_MS` and changed `hasAxisSpan` from `axisEnd > axisStart`
  to `axisEnd - axisStart >= MIN_AXIS_SPAN_MS`, so a degenerate series
  falls back to the `[periodStart, now]` domain and the point renders at
  `today` on a sane axis (matching the empty-series state).

## Tests

Added:

- `app_core/app/frontend/shared/__tests__/chartConfig.test.js` — a
  "does not collapse to repeated 'today' for a sub-hour span" case
  asserting both a zero span and a 1-second span yield the canonical
  `7d` labels.
- `app_core/app/frontend/shared/__tests__/HeroChart.test.jsx` — a
  "does not collapse to repeated 'today' for a near-empty series" case
  (single point at `now - 1000`) asserting `7d ago` is present and
  `today` appears exactly once.

Both were red first (produced `today`×5), then green.

## Verification

Commands executed:

- `npm test` (Vitest) — 57 files / 360 tests passed.
- `npm run lint` (ESLint) — 0 errors; only the pre-existing
  `tracked_items/TrackedItems.jsx` `react-hooks/exhaustive-deps` warning
  (unrelated to this change).
- `npm run format:check` (Prettier) — all files match.

## Deviations

None.

## Remaining Issues

None blocking. Manual browser verification of a fresh account is still
worth doing (not executed here — no browser in this environment).

