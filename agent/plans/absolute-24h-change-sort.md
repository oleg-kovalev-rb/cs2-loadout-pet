---
status: implemented
app: fetcher+core
goal: Make the 24h-change sort sign-agnostic and offer both amount (cents) and percent magnitude, with one shared vocabulary across dashboard, Items, and inventory detail.
created: 2026-10-26
---

# Development Plan

## Goal

Replace the current signed `change_24h_desc` ordering (`order(change_24h_cents: :desc)`) with
four sign-agnostic sort options — max/min amount and max/min percent — expose the same four
options with identical labels on the dashboard, the Items catalog, and the inventory detail
item list, and show the money delta next to the percentage in item rows so the amount-based
sorts are visually verifiable.

## Expected Behavior

**Normal behavior**

- Every item list offers exactly these four `24h change` options, in this order:
  - `24h change: max amount` → `ABS(change_24h_cents)` descending;
  - `24h change: min amount` → `ABS(change_24h_cents)` ascending;
  - `24h change: max percent` → `ABS(change_24h_cents / (current_price_cents - change_24h_cents))` descending;
  - `24h change: min percent` → the same magnitude ascending.
- Sign never affects ordering: a `-55` cent change outranks a `+4` cent change under
  `max amount`, and neither is pushed below the zeros just for being negative.
- The Items catalog (`/tracked-items`) defaults to `24h change: max percent`, so the default
  order matches the percentage rendered in the row.
- The dashboard item list and the inventory detail item list keep their current default
  (`Price: high to low`); only their change options become the four above.
- Ties are broken deterministically by `market_hash_name` ascending, so pagination cannot
  reshuffle equal-magnitude rows between requests.
- Item rows (dashboard `ItemRow`, Items `TickerView`/`GridView`, inventory `InventoryItemRow`)
  show the money delta next to the percent delta for non-flat changes, e.g. `▲ 13.3% +$0.04`,
  with the money part visually muted.
- The sort trigger button shows the selected option verbatim (e.g.
  `24h change: max amount`). The old literal `Sort: ` prefix is dropped from those two
  dropdowns; the dashboard already renders the bare label.

**Edge cases**

- `change_24h_cents` NULL or missing: treated as `0` for sorting and display, matching the
  serializers' `change = item.change_24h_cents || 0`.
- `current_price_cents` NULL or `0`: the percent expression yields `0`, matching
  `PriceChangePercent`'s zero-base behavior; no division-by-zero error.
- Zero change: sorts last under `max` and first under `min` (as magnitude zero).
- Prices/currencies other than USD are out of scope; the delta formatter is USD/cents, same as
  the rest of the UI.
- `change_24h_desc` continues to be accepted by the API as a backwards-compatible alias for
  `change_24h_percent_desc`.

**Failure behavior**

- An unrecognized `sort` value still raises `Api::Public::UnsupportedParamError` /
  `Api::Demo::UnsupportedParamError` and renders `400` with `Unsupported sort: <value>`.
- No new error states in the UI; sorting remains server-driven for Items/inventory and
  client-side for the dashboard.

**Must remain unchanged**

- Response shapes of `/api/public/items` and `/api/public/inventories/:steam_id`
  (`change_24h_cents`, `change_24h_percent`, `trend_7d`, etc.).
- `ItemListCache` keying (sort is already part of the key) and its TTL.
- Price/name sort behavior and their labels.
- Filter behavior, pagination, pagination resets on sort change, and refetch-retains-data
  behavior.
- Demo dataset content and synthetic series; only its sort dispatch changes.
- Admin panel (out of scope).

## Scope

### In Scope

- `Options::ItemSortOption`: four new members + legacy alias, sign-agnostic SQL ordering,
  deterministic tie-break.
- `ItemListQuery` default sort.
- `InventoryDetailQuery`'s embedded item list (it already reuses `Options::ItemSortOption`).
- `Demo::Dataset#sort_items` Ruby mirror of all sort options.
- `app_core` dashboard/Items/inventory-detail sort keys, labels, client-side comparators.
- A shared frontend module holding the four keys/labels so the three islands cannot drift.
- Money delta rendering in the four item-row/card components + a shared formatter + CSS.
- All affected specs and the demo API styleguide reference to the sort vocabulary.

### Out of Scope

- Admin panel item table.
- Renaming API fields (`change_24h_cents` / `change_24h_percent`).
- Splitting `change_24h_cents` into a generated/stored percent column or adding indexes.
- Changing the percent formula itself (`PriceChangePercent`).
- Portfolio-level inventory sort options (`Options::InventorySortOption`).
- Backfilling data or changing price ingestion.
- Unifying price/name labels across islands beyond the shared `24h change` block.
- Currency selection/localization.

## Implementation Approach

The backend stays the single source of ordering for Items and inventory detail. Add four
`T::Enum` members to `Options::ItemSortOption`; each `#apply` appends a raw-SQL `ORDER BY`
expression plus `market_hash_name` as a deterministic tie-break. The percent expression mirrors
`PriceChangePercent` (`change / (current - change) * 100`), rounded to two decimals so the
backend order matches the percentage the serializer returns. Missing values are coalesced to
`0` so NULL rows do not jump to the top under `ASC`.

The dashboard sorts in memory (`dashboard/utils/filters.js`), so its comparators change to the
absolute values of the already-mapped `change24hPercent` / `change24hCents`.

To keep the user-facing vocabulary identical, introduce
`app_core/app/frontend/shared/utils/itemSort.js` exporting the four sort keys and their labels.
All three item sort dropdowns compose their option lists from that module, each keeping its own
price/name entries and reducer wiring (per `react-dashboard.md`'s rule that sort *state* stays
island-local while a pure, state-free vocabulary can live in `shared/`).

Rows already receive both `change_24h_cents` and `change_24h_percent`, so showing the money
delta is a presentation-only change. Add `fmtSignedUSD(cents)` to the existing shared formatter
and render it muted next to the percent in all four delta renderers.

### Decisions

- **Legacy alias:** `change_24h_desc` maps to `change_24h_percent_desc` (the new default), not
  to signed cents. Keeping the old signed behavior would leave the reported bug reachable via
  an explicit API param.
- **Default metric:** percent, because percent is what every list renders; amount ordering is
  opt-in from the menu.
- **Button label:** show the selected option verbatim and drop the `Sort: ` prefix, otherwise
  the label becomes `Sort: 24h change: max amount` (double colon). Dashboard already does this.
- **NULL handling:** coalesce to zero rather than `NULLS LAST`, because the serializer already
  renders missing changes as `0` and `min` should put zeros first.
- **Tie-break:** `market_hash_name ASC` for every change sort, matching the demo dataset's
  existing name tie-break and giving stable pagination.

## Files To Modify

### app_fetcher

- `app_fetcher/app/queries/options/item_sort_option.rb` — add
  `ChangeAmountDesc`/`ChangeAmountAsc`/`ChangePercentDesc`/`ChangePercentAsc`, keep
  `ChangeDesc` as a delegating alias; implement `#apply` branches with the absolute
  amount/percent SQL plus `market_hash_name` tie-break.
- `app_fetcher/app/queries/item_list_query.rb` — default sort becomes
  `Options::ItemSortOption::ChangePercentDesc`.
- `app_fetcher/app/queries/demo/dataset.rb` — extend `#sort_items` with the four new keys and
  the alias; compute `change_24h_cents.abs` and
  `PriceChangePercent.call(...).abs`; tie-break by `market_hash_name`.
- `app_fetcher/spec/queries/options/item_sort_option_spec.rb` — replace the signed
  `ChangeDesc` example with four magnitude examples (one fixture where a large negative
  outranks a small positive) plus the alias.
- `app_fetcher/spec/queries/item_list_query_spec.rb` — assert the new default orders by
  absolute percent (including a large negative first) rather than signed cents.
- `app_fetcher/spec/queries/inventory_detail_query_spec.rb` — add explicit `change_24h_*`
  ordering examples for the embedded `top_items`.
- `app_fetcher/spec/queries/demo/dataset_spec.rb` — update "supports every sort option" to the
  four new keys plus the alias.
- `app_fetcher/spec/requests/api/public/items_spec.rb` — add request-level cases for amount and
  percent, both directions, the alias, and the new default.
- `app_fetcher/spec/requests/api/public/inventories_spec.rb` — add detail `sort` cases for the
  new values (and keep the unknown-value `400`).

### app_core

- `app_core/app/frontend/shared/utils/itemSort.js` — **new**; single source of truth for the
  four `change_24h_*` keys and labels.
- `app_core/app/frontend/shared/__tests__/itemSort.test.js` — **new**; lock the exact labels and
  key list.
- `app_core/app/frontend/shared/utils/format.js` — add `fmtSignedUSD(cents)` for `+$0.04` /
  `-$0.55`.
- `app_core/app/frontend/shared/__tests__/format.test.js` — cover positive, negative, zero,
  and null amounts.
- `app_core/app/frontend/shared/styles/tokens.css` — add the muted money-delta class used by
  `.mover-delta` rows (dashboard + inventory detail share it).
- `app_core/app/frontend/dashboard/utils/filters.js` — import the shared keys/labels; replace
  the signed `change_24h_desc`/`change_24h_asc` comparators with the four magnitude
  comparators; add name tie-breaks.
- `app_core/app/frontend/dashboard/components/SortDropdown.jsx` — compose the option list from
  the shared change keys + local price/name keys.
- `app_core/app/frontend/dashboard/components/ItemRow.jsx` — render the muted money delta next
  to the percent.
- `app_core/app/frontend/dashboard/__tests__/filters.test.js` — update comparator/label
  expectations, including a negative-with-big-magnitude case.
- `app_core/app/frontend/dashboard/__tests__/ItemsTile.test.jsx` — assert the money delta is
  rendered and the new sort keys still reorder rows.
- `app_core/app/frontend/tracked_items/components/SortDropdown.jsx` — shared change keys/labels;
  drop the literal `Sort: ` prefix.
- `app_core/app/frontend/tracked_items/reducer.js` — default sort becomes
  `change_24h_percent_desc`.
- `app_core/app/frontend/tracked_items/components/TickerView.jsx` — money delta in the row.
- `app_core/app/frontend/tracked_items/components/GridView.jsx` — money delta in the card.
- `app_core/app/frontend/tracked_items/styles/tracked_items.css` — muted money-delta classes
  for `.ticker-delta` / `.card-delta`.
- `app_core/app/frontend/tracked_items/__tests__/reducer.test.js` — new default key.
- `app_core/app/frontend/tracked_items/__tests__/TrackedItems.test.jsx` — select a new
  `24h change:` option by label (update the `sort:` query), assert the refetch key, and assert
  the money delta renders.
- `app_core/app/frontend/inventories/components/ItemsSortDropdown.jsx` — shared change
  keys/labels; drop the literal `Sort: ` prefix.
- `app_core/app/frontend/inventories/components/InventoryItemRow.jsx` — money delta in the row.
- `app_core/app/frontend/inventories/__tests__/InventoryItemRow.test.jsx` — money-delta
  assertions.
- `app_core/app/frontend/inventories/__tests__/InventoryDetail.test.jsx` — update the sort
  trigger query and, if needed, select a `24h change:` option to prove the new key is sent.

### Documentation

- `agent/styleguides/fetcher/demo-api.md` — replace the listed four legacy sort values with
  the new vocabulary in the "mirror `Options::ItemSortOption`" rule (gated by
  `styleguides-check`/`update-styleguide`).

## Files To Create

- `app_core/app/frontend/shared/utils/itemSort.js` — exports
  `ITEM_CHANGE_SORT_KEYS` (ordered array) and `ITEM_CHANGE_SORT_LABELS` (key → label) for the
  four options. Necessary so dashboard/Items/inventory cannot drift in naming again.
- `app_core/app/frontend/shared/__tests__/itemSort.test.js` — locks the four exact labels and
  their order; pure data test, no rendering.

## Test Plan

**app_fetcher (RSpec)**

- `spec/queries/options/item_sort_option_spec.rb`:
  - `max amount` puts `-300` before `+100` before `+50`;
  - `min amount` reverses that;
  - `max percent` ranks by `|change| / |price − change|`, with fixtures where the percent
    order differs from the cents order;
  - `min percent` reverses;
  - `change_24h_desc` behaves identically to `max percent`;
  - ties break by `market_hash_name`.
- `spec/queries/item_list_query_spec.rb`: default ordering is absolute percent; a large
  negative change is not pushed below zeros.
- `spec/queries/inventory_detail_query_spec.rb`: each new `sort` value orders `top_items`
  accordingly; unknown value still raises.
- `spec/queries/demo/dataset_spec.rb`: all four values + alias; a large negative ranks ahead
  under `max`.
- `spec/requests/api/public/items_spec.rb`: default order, each new value, alias, and the
  existing `400` for unknown values.
- `spec/requests/api/public/inventories_spec.rb`: detail endpoint accepts each new value and
  orders correctly; unknown value still `400`.
- Caching specs need no behavioral change; keep `change_24h_desc` in
  `spec/caching/item_list_cache_spec.rb` to prove the alias/key path still works.

**app_core (Vitest)**

- `shared/__tests__/itemSort.test.js`: exact keys/order/labels.
- `shared/__tests__/format.test.js`: `fmtSignedUSD` positive/negative/zero/null.
- `dashboard/__tests__/filters.test.js`: four comparators, sign-agnostic ordering, tie-break,
  and labels.
- `dashboard/__tests__/ItemsTile.test.jsx` and `tracked_items/__tests__/TrackedItems.test.jsx`:
  money delta rendered; selecting a new change option refetches with its key (Items) or
  reorders rows (dashboard).
- `tracked_items/__tests__/reducer.test.js`: default is `change_24h_percent_desc`.
- `inventories/__tests__/InventoryItemRow.test.jsx`: money delta rendered/omitted correctly.
- `inventories/__tests__/InventoryDetail.test.jsx`: sort control still changes the request
  param; update the button query after dropping `Sort: `.

## Implementation Steps

1. Write the failing backend spec cases for the four sort values (option spec first, since it
   is the narrowest unit).
2. Add the enum members/alias and SQL ordering in `Options::ItemSortOption`; make the option
   spec green.
3. Update `ItemListQuery`'s default; update/extend `item_list_query_spec` and the public items
   request spec.
4. Add inventory-detail query/request sort cases; confirm the shared enum is enough (no new
   query code).
5. Update `Demo::Dataset#sort_items` and its spec so the demo mirror matches the enum.
6. Add `shared/utils/itemSort.js` + its test; wire all three sort dropdowns to it and remove
   the `Sort: ` prefix where the four-part labels appear.
7. Replace the dashboard comparators and reducer/default keys; update `filters.test.js` and
   reducer tests (dashboard + tracked items).
8. Add `fmtSignedUSD` + tests, then render the money delta in `ItemRow`, `TickerView`,
   `GridView`, and `InventoryItemRow`; add the muted CSS classes.
9. Update component tests (`ItemsTile`, `TrackedItems`, `InventoryItemRow`,
   `InventoryDetail`) for the new labels and money delta.
10. Update `agent/styleguides/fetcher/demo-api.md` (via `styleguides-check`/
    `update-styleguide`) to the new sort vocabulary.
11. Run the full verification set below.

## Verification

- `app_fetcher`: targeted specs first
  (`spec/queries/options/item_sort_option_spec.rb`,
  `spec/queries/item_list_query_spec.rb`,
  `spec/queries/inventory_detail_query_spec.rb`,
  `spec/queries/demo/dataset_spec.rb`,
  `spec/requests/api/public/items_spec.rb`,
  `spec/requests/api/public/inventories_spec.rb`), then the full RSpec suite.
- `app_fetcher`: `bin/rubocop` on touched Ruby files and `bundle exec srb tc`.
- `app_core`: Vitest full suite (at minimum the touched dashboard/tracked_items/inventories/
  shared specs), ESLint, Prettier.
- Specs must run through the repo's CI compose setup per
  `agent/styleguides/ci-and-coverage.md` and `bin/ci`.
- Manual sanity check against a running stack (or the public API):
  - default Items order is `max percent` and matches the rendered percentages;
  - `max amount` puts a large negative money change above small positives;
  - rows render `▲/▼ pp% +$x.xx`;
  - `change_24h_desc` still returns 200.

## Risks

- **Public API semantics change.** `change_24h_desc` no longer means signed cents. Any external
  consumer relying on the old order will see a different list; documented in the plan and
  mitigated by the explicit new keys.
- **Percent formula duplication.** The SQL expression must stay in sync with
  `PriceChangePercent`; a future formula change has to touch both. The plan keeps the formula
  in one comment-linked place and covers both with specs.
- **Rounding mismatch.** SQL rounds to two decimals to match the serializer; float-vs-numeric
  half-cent cases could theoretically order differently from the client-side dashboard
  comparator, but only for near-ties.
- **Expression sort has no index.** Fine at the current catalog size; note for future scale.
- **Layout pressure.** Adding money deltas to the grid card pill and ticker rows may overflow
  narrow viewports; the muted inline span must be tested in both views.
- **Button label change.** Dropping `Sort: ` breaks existing tests and changes a visible label;
  covered explicitly in the expected behavior.

## Assumptions

- The user approved showing the money delta next to the percentage in item rows.
- `amount` means the absolute change in cents/currency, and `percent` means the absolute
  relative change already returned as `change_24h_percent`.
- Keeping dashboard/inventory-detail defaults at `Price: high to low` is acceptable; only
  Items defaults to `max percent`.
- The demo API styleguide's sort list is expected to be updated as part of this change rather
  than left stale.

## Applicable Styleguides

- `agent/styleguides/fetcher/list-query-objects.md` — constrains
  `Options::ItemSortOption` (one `T::Enum` member per sort, exhaustive
  `T.absurd`, `#apply(scope)` ordering, `Appliers::SortApplier` remains the
  only resolver), the `ItemListQuery` default, and the layer's
  unit-vs-request test split. It also permits the raw `Arel.sql` ordering
  already used by `NameAsc`.
- `agent/styleguides/fetcher/demo-api.md` — constrains
  `Demo::Dataset#sort_items`: it must mirror every enum member in Ruby with
  an exhaustive `T.absurd` case, sign-agnostic magnitudes, the
  `market_hash_name` tie-break, and the legacy alias mapping.
- `agent/styleguides/fetcher/public-api-controllers.md` — constrains the
  closed-enum `sort` contract: unknown values still raise
  `Api::Public::UnsupportedParamError` and render `400 Unsupported sort: …`;
  new values are additive and do not change response shapes.
- `agent/styleguides/rails-layering.md` — the change stays inside the
  existing query/enum layer; no new controller, service, or model
  responsibility is introduced.
- `agent/styleguides/core/react-dashboard.md` — constrains the shared
  `itemSort` vocabulary (pure/stateless cross-island module in `shared/`,
  island-local sort state), the money-delta rendering (flat means no badge,
  one row renderer per island, per-island stylesheet), and the
  Vitest/testing conventions.
- `agent/styleguides/ruby-sorbet.md` — `typed: strict`, `sig` on the enum
  and dataset changes, no `T.unsafe` beyond the existing enum dispatch.
- `agent/styleguides/rspec-conventions.md` — unit specs for the enum and
  demo dataset under `spec/queries/`, request specs as the JSON contract
  lock.
- `agent/styleguides/git-commits.md` — commit as
  `[Fetcher+Core] Imperative summary` (both apps touched).
- `agent/styleguides/ci-and-coverage.md` + `git-hooks.md` — the
  verification commands run through the repo's CI compose setup; the
  pre-commit hook lints staged Ruby/JS and enforces the commit format.
- `agent/styleguides/fix_me.md` — checked: none of the files this plan
  touches is listed as a known deviation. The existing
  `react-dashboard.md` entry concerns a stale test-file list
  (`HeroChart`/`ChartTooltip`), unrelated to this change, so it stays.

## Completion Criteria

- [x] Four sign-agnostic sort values exist in the enum, demo mirror, and all three islands.
- [x] Labels are identical everywhere and come from one shared module.
- [x] Default Items order is `max percent`; ties are deterministic.
- [x] Rows show muted money delta next to percent delta.
- [x] Backend and frontend tests updated and green; linters/type checks pass.
- [x] Demo API styleguide updated to the new vocabulary.

# Implementation Summary

## Implemented

- `Options::ItemSortOption` — added `ChangeAmountDesc`, `ChangeAmountAsc`,
  `ChangePercentDesc`, `ChangePercentAsc`; `#apply` now orders by
  `ABS(COALESCE(change_24h_cents, 0))` / a `PriceChangePercent`-mirroring
  percent expression, with `market_hash_name` as the deterministic
  tie-break. `ChangeDesc` (`change_24h_desc`) stays as an alias of
  `ChangePercentDesc`.
- `ItemListQuery` — default sort is now `ChangePercentDesc`.
- `Demo::Dataset#sort_items` — mirrors all five change values in Ruby using
  `amount_magnitude` / `percent_magnitude` (the latter reuses
  `PriceChangePercent`), same name tie-break.
- `app_core` — new `shared/utils/itemSort.js` with the four keys/labels;
  dashboard, Items, and inventory-detail dropdowns compose from it. The
  literal `Sort: ` prefix was removed from the Items and inventory-detail
  triggers so the selected label (`24h change: max amount`) shows verbatim,
  matching the dashboard.
- Dashboard client-side comparators are sign-agnostic for both amount and
  percent, with name tie-breaks; Items default moved to
  `change_24h_percent_desc`.
- Item rows/cards (`ItemRow`, `InventoryItemRow`, `TickerView`,
  `GridView`) now render a muted `fmtSignedUSD` amount next to the percent
  delta; `shared/utils/format.js` gained `fmtSignedUSD`, and `tokens.css`
  gained `.delta-amount`.
- `agent/styleguides/fetcher/demo-api.md` — replaced the stale four-value
  list with the "mirror every enum member, sign-agnostic magnitude" rule.

## Tests

Changed/added:

- `spec/queries/options/item_sort_option_spec.rb` — four magnitude sorts,
  alias, name tie-break, NULL→0, zero-price percent.
- `spec/queries/item_list_query_spec.rb` — default absolute-percent order.
- `spec/queries/inventory_detail_query_spec.rb` — all change sorts + alias.
- `spec/queries/demo/dataset_spec.rb` — every sort option mirrored.
- `spec/requests/api/public/items_spec.rb` — amount/percent sorts, alias,
  default.
- `spec/requests/api/public/inventories_spec.rb` — detail change sorts.
- `shared/__tests__/itemSort.test.js` (new) — keys/order/labels.
- `shared/__tests__/format.test.js` — `fmtSignedUSD` cases.
- `dashboard/__tests__/filters.test.js` — four comparators + tie-break.
- `dashboard/__tests__/ItemsTile.test.jsx` — magnitude sorting + money
  delta.
- `tracked_items/__tests__/TrackedItems.test.jsx` — new labels, key
  refetch, money delta.
- `tracked_items/__tests__/reducer.test.js` — new default sort key.
- `tracked_items/__tests__/useItemsCatalog.test.js` — new key.
- `inventories/__tests__/InventoryItemRow.test.jsx` — money delta.
- `inventories/__tests__/InventoryDetail.test.jsx` — new trigger label,
  money delta.

Commands actually executed:

- `docker compose ... run --rm --no-deps app_fetcher bundle exec rspec` —
  **579 examples, 0 failures**.
- `docker compose ... run --rm --no-deps app_fetcher bash -c "bin/rubocop -f simple && bundle exec srb tc"` —
  **198 files inspected, no offenses**; **No errors**.
- `docker compose ... run --rm --no-deps app_fetcher bin/brakeman --no-pager` —
  **Security Warnings: 0**.
- `docker compose ... run --rm --no-deps app_fetcher bin/ci` and
  `... app_core bin/ci` — **CI passed** in both apps (includes
  `bin/bundler-audit`, Brakeman, RSpec, Vitest, and the seed replant).
- `docker compose ... run --rm --no-deps app_core npm test` —
  **56 files, 345 tests passed**.
- `docker compose ... run --rm --no-deps app_core bash -c "npm run lint && npm run format:check"` —
  0 ESLint errors (1 pre-existing `TrackedItems.jsx` warning), Prettier
  clean after formatting three touched files.

## Verification

- Full `app_fetcher` RSpec, RuboCop, and `srb tc`: green.
- Full `app_core` Vitest, ESLint, Prettier: green.
- Targeted request specs prove the public `sort` contract: new keys work,
  `change_24h_desc` still returns 200 with the absolute-percent order,
  unknown values still `400`.
- Not performed: manual browser pass against a running stack / real Steam
  login.

## Deviations

- During TDD the percent SQL originally left a zero-price/absent-price row
  as `NULL`, which Postgres sorts first under `DESC`; wrapped the
  expression in `COALESCE(..., 0)` and added a regression example.
- Dropped the literal `Sort: ` prefix in the Items and inventory-detail
  triggers (planned) because the new label already contains a colon.
- Brakeman flagged the first ordering helper's
  `Arel.sql("#{expression} #{direction}")` as a possible SQL injection
  (false positive — both parts are internal). Replaced the interpolation
  with literal `Arel.sql(...)` expressions plus `.desc`/`.asc` nodes, so
  the report is clean without an ignore file.

## Remaining Issues

- `change_24h_desc` intentionally changes meaning (signed cents → absolute
  percent); external consumers relying on the old order will see a
  different list. The explicit new keys cover both metrics and directions.
- `ItemListCache` is TTL-only (2 minutes); the alias key can serve an old
  pending payload for that window after deploy. The frontend sends the new
  `change_24h_percent_desc` key, so it does not read the old entries.
- Percent ordering uses a SQL expression without an index; fine at the
  current catalog size, revisit with a generated column if the catalog
  grows substantially.
- Admin panel item table remains out of scope and unchanged.
- CI's `bin/bundler-audit` flagged `crass 1.0.7` (GHSA-pq4g-8rxf-4g29) on a
  fresh advisory DB; patched both lockfiles to `crass 1.0.8` with
  `bundle update --conservative crass` (the only gem that moved), rebuilt
  both images, and re-ran `bin/ci` in both apps successfully.
