import { describe, test, expect } from 'vitest'
import { fmtPrice, fmtDateTime, fmtSignedUSD } from '../utils/format'

describe('fmtPrice', () => {
  test('renders a dash for null (no price yet)', () => {
    expect(fmtPrice(null)).toBe('—')
  })

  test('renders a dash for undefined (no price yet)', () => {
    expect(fmtPrice(undefined)).toBe('—')
  })

  test('renders zero as a real price, not a missing one', () => {
    expect(fmtPrice(0)).toBe('$0.00')
  })

  test('renders a formatted USD price for a real value', () => {
    expect(fmtPrice(3845)).toBe('$38.45')
  })
})

describe('fmtSignedUSD', () => {
  test('prefixes a positive change with +', () => {
    expect(fmtSignedUSD(4)).toBe('+$0.04')
  })

  test('prefixes a negative change with -', () => {
    expect(fmtSignedUSD(-55)).toBe('-$0.55')
  })

  test('renders zero without a sign', () => {
    expect(fmtSignedUSD(0)).toBe('$0.00')
  })

  test('renders a dash for null/undefined (no change yet)', () => {
    expect(fmtSignedUSD(null)).toBe('—')
    expect(fmtSignedUSD(undefined)).toBe('—')
  })
})

describe('fmtDateTime', () => {
  test('renders a short month/day + hour:minute for an epoch-ms timestamp', () => {
    const epochMs = new Date('2026-03-05T15:45:00').getTime()
    expect(fmtDateTime(epochMs)).toBe('Mar 5, 3:45 PM')
  })
})
