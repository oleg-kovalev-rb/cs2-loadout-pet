import { describe, test, expect } from 'vitest'
import { ITEM_CHANGE_SORT_KEYS, ITEM_CHANGE_SORT_LABELS } from '../utils/itemSort'

describe('item change sort vocabulary', () => {
  test('lists the four sign-agnostic options in menu order', () => {
    expect(ITEM_CHANGE_SORT_KEYS).toEqual([
      'change_24h_amount_desc',
      'change_24h_amount_asc',
      'change_24h_percent_desc',
      'change_24h_percent_asc',
    ])
  })

  test('uses the same labels on every island', () => {
    expect(ITEM_CHANGE_SORT_LABELS).toEqual({
      change_24h_amount_desc: '24h change: max amount',
      change_24h_amount_asc: '24h change: min amount',
      change_24h_percent_desc: '24h change: max percent',
      change_24h_percent_asc: '24h change: min percent',
    })
  })
})
