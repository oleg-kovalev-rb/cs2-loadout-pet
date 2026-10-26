// Single source of truth for the sign-agnostic 24h-change sort vocabulary.
// Each island keeps its own reducer state and its own price/name entries, but
// the change keys and labels must match everywhere — the sort trigger renders
// the selected label verbatim, so a drift here is visible to users.
export const ITEM_CHANGE_SORT_KEYS = [
  'change_24h_amount_desc',
  'change_24h_amount_asc',
  'change_24h_percent_desc',
  'change_24h_percent_asc',
]

export const ITEM_CHANGE_SORT_LABELS = {
  change_24h_amount_desc: '24h change: max amount',
  change_24h_amount_asc: '24h change: min amount',
  change_24h_percent_desc: '24h change: max percent',
  change_24h_percent_asc: '24h change: min percent',
}
