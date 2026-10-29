---
status: implemented
app: core
goal: Unify the 24h-change delta badge across every item row/card into a single compact pill — `▲ $3.12 (+8.1%)` — matching the hero's amount-first order, and stop the ticker's fixed price column from overflowing.
created: 2026-10-29
---

# Development Plan

## Goal

Replace the current two-tone delta badge (`▲ 8.1% +$3.00`, colored percent + muted gray
amount) with one compact pill that puts the absolute amount first and the percent in
parentheses — `▲ $3.12 (+8.1%)` — in a single `--up`/`--down` color on a soft background,
matching the hero delta's existing `▲ $10.00 (+7.14%)` order. Fix the ticker's fixed
`110px` price column so the wider pill no longer bleeds into the sparkline column.

This supersedes the presentation choice in `agent/plans/absolute-24h-change-sort.md`
("money part visually muted"); the amount-first pill is the new convention.

## Expected Behavior

**Normal behavior**

- Every item row/card that renders a 24h delta shows a single compact pill:
  - up: `▲ $3.12 (+8.1%)` (green `--up` on `--up-soft`);
  - down: `▼ $0.50 (-1.2%)` (red `--down` on `--down-soft`).
- The amount is the absolute `change_24h_cents` (unsigned — the arrow carries direction),
  formatted with `fmtUSD`/`centsToUSD` at two decimals. The percent is
  `Math.abs(pct).toFixed(1)` with an explicit `+`/`-` sign, in parentheses.
- The four surfaces render identically: dashboard `ItemRow`, inventories
  `InventoryItemRow`, tracked-items `TickerView` (ticker row) and `GridView` (card).
- The hero delta (`PortfolioTile`, `PortfolioHeroTile`) is unchanged — it already uses the
  amount-then-percent order; the rows now match it.
- No more `.delta-amount` muted fragment, and `shared/utils/format.js`'s `fmtSignedUSD`
  is removed (its only four callers switch to `fmtUSD` + `Math.abs`).

**Edge cases**

- Flat change (`change_24h_percent === 0` or missing): no badge at all — unchanged, still
  gated on `trendDirection(pct) !== 'flat'`.
- Unpriced item (`current_price_cents` null/0): no badge — unchanged.
- `change_24h_cents` null while percent non-zero cannot happen (percent is derived from
  cents in `PriceChangePercent`); the amount renders directly from `change_24h_cents`
  without a null guard, same trust the hero places in its own `delta`.
- Large amounts (`▲ $123.45 (+8.8%)`) fit the widened ticker column and stay on one line
  (`white-space: nowrap`).

**Failure behavior**

- None. No data or error states change; this is presentation-only.

## Approach

- `app_core/app/frontend/dashboard/components/ItemRow.jsx` — reorder the delta to
  `{arrow} {fmtUSD(centsToUSD(Math.abs(change24hCents)))} ({sign}{pct.toFixed(1)}%)`,
  drop the `.delta-amount` span and the `fmtSignedUSD` import.
- `app_core/app/frontend/inventories/components/InventoryItemRow.jsx` — same.
- `app_core/app/frontend/tracked_items/components/TickerView.jsx` — same.
- `app_core/app/frontend/tracked_items/components/GridView.jsx` — same (already a pill).
- `app_core/app/frontend/shared/utils/format.js` — delete `fmtSignedUSD`.
- `app_core/app/frontend/shared/styles/tokens.css` — make `.mover-delta` a pill
  (`padding: 1px 6px; border-radius: var(--radius-sm); white-space: nowrap`) and give
  `.mover-delta.up/.down` their soft backgrounds; delete `.delta-amount`.
- `app_core/app/frontend/tracked_items/styles/tracked_items.css` — make `.ticker-delta` a
  pill the same way, add `white-space: nowrap` to `.card-delta`, and widen the price
  column `110px → 150px` in both `.ticker-head` and `.ticker-row`.

## Testing

- `shared/__tests__/format.test.js` — remove the `fmtSignedUSD` describe block.
- `inventories/__tests__/InventoryItemRow.test.jsx` — rewrite the two money-delta tests to
  assert the single pill text (`▲ $1.30 (+3.2%)`, `▼ $0.50 (-1.2%)`) and no `.delta-amount`.
- `inventories/__tests__/InventoryDetail.test.jsx` — change `+$1.30` to `/\$1\.30/`.
- `dashboard/__tests__/ItemsTile.test.jsx` — change `-$10.00` to `/\$10\.00/`.
- `dashboard/__tests__/ItemRow.test.jsx`, `tracked_items/__tests__/TrackedItems.test.jsx` —
  unchanged (they assert arrow/class and badge absence, not the amount text).

## Status

- [x] Styleguide updated (`agent/styleguides/core/react-dashboard.md`).
- [x] Components render the pill in all four surfaces.
- [x] `fmtSignedUSD` removed with its tests.
- [x] Ticker column widened; `nowrap` guards the pill.
- [x] `npm run lint` and `npm run format` clean; `npx vitest run` green (354 tests).
