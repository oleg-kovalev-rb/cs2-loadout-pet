import { ITEM_CHANGE_SORT_LABELS } from '../../shared/utils/itemSort'

// Canonical wear-order vocabulary, used both to filter and to order
// whichever of these are actually present in a given inventory (see
// conditionsPresent) — not shown in full regardless of inventory contents.
export const CONDITIONS = [
  'Factory New',
  'Minimal Wear',
  'Field-Tested',
  'Well-Worn',
  'Battle-Scarred',
]

export function applyFilters(items, filters) {
  return items.filter((item) => {
    if (filters.weapons.size > 0 && !filters.weapons.has(item.weaponType)) return false
    if (filters.conditions.size > 0 && !filters.conditions.has(item.condition)) return false
    if (filters.stattrakOnly && !item.stattrak) return false
    return true
  })
}

export function weaponTypesPresent(items) {
  return [...new Set(items.map((item) => item.weaponType))].filter(Boolean).sort()
}

export function conditionsPresent(items) {
  const present = new Set(items.map((item) => item.condition))
  return CONDITIONS.filter((condition) => present.has(condition))
}

export function changePct(item) {
  return item.change24hPercent || 0
}

function changeCents(item) {
  return item.change24hCents || 0
}

// Sign-agnostic: the "24h change" sorts rank by magnitude, so a -10% move
// outranks a +2% one. Ties break by name for the same deterministic order the
// server-side sorts use.
function byMagnitude(read, direction) {
  return (a, b) => {
    const diff = (Math.abs(read(a)) - Math.abs(read(b))) * direction
    return diff !== 0 ? diff : a.marketHashName.localeCompare(b.marketHashName)
  }
}

export const SORTERS = {
  change_24h_amount_desc: byMagnitude(changeCents, -1),
  change_24h_amount_asc: byMagnitude(changeCents, 1),
  change_24h_percent_desc: byMagnitude(changePct, -1),
  change_24h_percent_asc: byMagnitude(changePct, 1),
  price_desc: (a, b) => b.currentPriceCents - a.currentPriceCents,
  price_asc: (a, b) => a.currentPriceCents - b.currentPriceCents,
  name_asc: (a, b) =>
    `${a.weaponType} ${a.itemName}`.localeCompare(`${b.weaponType} ${b.itemName}`),
}

export const SORT_LABELS = {
  ...ITEM_CHANGE_SORT_LABELS,
  price_desc: 'Price ↓',
  price_asc: 'Price ↑',
  name_asc: 'Name A–Z',
}

export function applySort(items, sortKey) {
  return [...items].sort(SORTERS[sortKey])
}
