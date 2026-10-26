import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, test, expect, vi } from 'vitest'
import { PortfolioTile } from '../components/PortfolioTile'
import { MOBILE_MEDIA_QUERY } from '../../shared/utils/viewport'

const ITEM = {
  marketHashName: 'AK-47 | Redline (FT)',
  weaponType: 'AK-47',
  itemName: 'Redline',
  condition: 'Field-Tested',
  stattrak: false,
  currentPriceCents: 4000,
}

const OTHER_ITEM = { ...ITEM, marketHashName: 'AWP | Dragon Lore (FT)', itemName: 'Dragon Lore' }

const COMPLETE_CURRENT = {
  totalValueCents: 15000,
  itemsCount: 1,
  pricableItemsCount: 1,
  pricedItemsCount: 1,
  complete: true,
}

const NO_CHANGE = { cents: 0, percent: 0, basisAt: null, partial: false, available: false }

const DEFAULT_PROPS = {
  portfolioSeries: [],
  current: COMPLETE_CURRENT,
  change: NO_CHANGE,
  itemHistorySeries: [],
  itemHistoryStatus: 'pending',
  period: '7d',
  mode: 'portfolio',
  selectedItem: null,
  onPeriodChange: vi.fn(),
  onBack: vi.fn(),
}

function tileProps(overrides = {}) {
  return { ...DEFAULT_PROPS, ...overrides }
}

function renderTile(overrides = {}) {
  return render(<PortfolioTile {...tileProps(overrides)} />)
}

function stubMatchMedia({ mobile = false, reduced = false } = {}) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query) => ({
      matches:
        query === MOBILE_MEDIA_QUERY
          ? mobile
          : query === '(prefers-reduced-motion: reduce)'
            ? reduced
            : false,
      media: query,
    })),
  )
}

const originalScrollIntoView = Element.prototype.scrollIntoView
let scrollIntoView

beforeEach(() => {
  scrollIntoView = vi.fn()
  Element.prototype.scrollIntoView = scrollIntoView
})

afterEach(() => {
  Element.prototype.scrollIntoView = originalScrollIntoView
  vi.unstubAllGlobals()
})

describe('PortfolioTile', () => {
  test('portfolio mode: a complete, genuinely-zero inventory shows $0.00 with no delta', () => {
    const { container } = renderTile({
      current: { ...COMPLETE_CURRENT, totalValueCents: 0 },
    })

    expect(screen.getByText('$0.00')).toBeInTheDocument()
    expect(container.querySelector('.hero-delta')).not.toBeInTheDocument()
    expect(container.querySelector('.hero-estimating')).not.toBeInTheDocument()
  })

  test('portfolio mode: an incomplete valuation shows the partial sum, badge, and no delta', () => {
    const { container } = renderTile({
      current: {
        totalValueCents: 1234,
        itemsCount: 5,
        pricableItemsCount: 5,
        pricedItemsCount: 3,
        complete: false,
      },
      portfolioSeries: [
        { at: 1, value: 1000, complete: false },
        { at: 2, value: 1234, complete: false },
      ],
    })

    expect(screen.getByText('Estimating…')).toBeInTheDocument()
    expect(screen.getByText('$12.34')).toBeInTheDocument()
    expect(screen.getByText('3/5 priced')).toBeInTheDocument()
    expect(screen.queryByText('$0.00')).not.toBeInTheDocument()
    expect(container.querySelector('.hero-value-skeleton')).not.toBeInTheDocument()
    expect(container.querySelector('.hero-delta')).not.toBeInTheDocument()
  })

  test('portfolio mode: shows a placeholder when nothing is priced yet', () => {
    const { container } = renderTile({
      current: {
        totalValueCents: 0,
        itemsCount: 5,
        pricableItemsCount: 5,
        pricedItemsCount: 0,
        complete: false,
      },
    })

    expect(screen.getByText('Estimating…')).toBeInTheDocument()
    expect(screen.getByText('0/5 priced')).toBeInTheDocument()
    expect(container.querySelector('.hero-value-skeleton')).toBeInTheDocument()
    expect(screen.queryByText('$0.00')).not.toBeInTheDocument()
  })

  test('portfolio mode: shows the current value and a delta when the change is complete', () => {
    const { container } = renderTile({
      current: COMPLETE_CURRENT,
      portfolioSeries: [
        { at: 1, value: 14000, complete: true },
        { at: 2, value: 15000, complete: true },
      ],
      change: { cents: 1000, percent: 7.14, basisAt: 1, partial: false, available: true },
    })

    expect(screen.getByText('$150.00')).toBeInTheDocument()
    expect(container.querySelector('.hero-delta')).toBeInTheDocument()
  })

  test('portfolio mode: a zero change shows no delta', () => {
    const { container } = renderTile({
      current: COMPLETE_CURRENT,
      portfolioSeries: [{ at: 1, value: 15000, complete: true }],
      change: { cents: 0, percent: 0, basisAt: null, partial: false, available: true },
    })

    expect(screen.getByText('$150.00')).toBeInTheDocument()
    expect(container.querySelector('.hero-delta')).not.toBeInTheDocument()
  })

  test('portfolio mode: suppresses the delta when the change is partial', () => {
    const { container } = renderTile({
      current: COMPLETE_CURRENT,
      change: { cents: 500, percent: 3.45, basisAt: 1, partial: true, available: true },
    })

    expect(screen.getByText('Partial history')).toBeInTheDocument()
    expect(container.querySelector('.hero-delta')).not.toBeInTheDocument()
  })

  test('item mode: a single-point history shows no delta', () => {
    const { container } = renderTile({
      mode: 'item',
      selectedItem: {
        marketHashName: 'AK-47 | Redline (FT)',
        weaponType: 'AK-47',
        itemName: 'Redline',
        condition: 'Field-Tested',
        stattrak: false,
        currentPriceCents: 4000,
      },
      itemHistorySeries: [{ at: 1, value: 4000 }],
      itemHistoryStatus: 'ready',
    })

    expect(container.querySelector('.hero-delta')).not.toBeInTheDocument()
  })

  test('item mode: shows a loading state while item history is pending, not a zero', () => {
    const { container } = renderTile({
      mode: 'item',
      selectedItem: {
        marketHashName: 'AK-47 | Redline (FT)',
        weaponType: 'AK-47',
        itemName: 'Redline',
        condition: 'Field-Tested',
        stattrak: false,
        currentPriceCents: 4000,
      },
      itemHistorySeries: [],
      itemHistoryStatus: 'pending',
    })

    expect(container.querySelector('.hero-delta')).not.toBeInTheDocument()
  })

  test('item mode: renders the item series once history has loaded', () => {
    const { container } = renderTile({
      mode: 'item',
      selectedItem: {
        marketHashName: 'AK-47 | Redline (FT)',
        weaponType: 'AK-47',
        itemName: 'Redline',
        condition: 'Field-Tested',
        stattrak: false,
        currentPriceCents: 4000,
      },
      itemHistorySeries: [
        { at: 1, value: 3700 },
        { at: 2, value: 4000 },
      ],
      itemHistoryStatus: 'ready',
    })

    expect(screen.getByText('$40.00')).toBeInTheDocument()
    expect(container.querySelector('.hero-delta')).toBeInTheDocument()
  })

  test('portfolio mode: the period toggle has no 24h option', () => {
    renderTile({ mode: 'portfolio' })

    expect(screen.queryByRole('button', { name: '24h' })).not.toBeInTheDocument()
  })

  test('item mode: the period toggle includes a 24h option', () => {
    renderTile({
      mode: 'item',
      selectedItem: {
        marketHashName: 'AK-47 | Redline (FT)',
        weaponType: 'AK-47',
        itemName: 'Redline',
        condition: 'Field-Tested',
        stattrak: false,
        currentPriceCents: 4000,
      },
    })

    expect(screen.getByRole('button', { name: '24h' })).toBeInTheDocument()
  })
})

describe('PortfolioTile mobile hero scroll', () => {
  test('scrolls the hero into view when item mode is entered on a phone', () => {
    stubMatchMedia({ mobile: true })

    renderTile({ mode: 'item', selectedItem: ITEM })

    expect(scrollIntoView).toHaveBeenCalledTimes(1)
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
  })

  test('uses an instant scroll when reduced motion is requested', () => {
    stubMatchMedia({ mobile: true, reduced: true })

    renderTile({ mode: 'item', selectedItem: ITEM })

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' })
  })

  test('does not scroll on a desktop viewport', () => {
    stubMatchMedia({ mobile: false })

    renderTile({ mode: 'item', selectedItem: ITEM })

    expect(scrollIntoView).not.toHaveBeenCalled()
  })

  test('does not scroll in portfolio mode', () => {
    stubMatchMedia({ mobile: true })

    renderTile({ mode: 'portfolio', selectedItem: null })

    expect(scrollIntoView).not.toHaveBeenCalled()
  })

  test('scrolls again when another item is selected, but not when returning to portfolio', () => {
    stubMatchMedia({ mobile: true })

    const { rerender } = renderTile({ mode: 'item', selectedItem: ITEM })
    expect(scrollIntoView).toHaveBeenCalledTimes(1)

    scrollIntoView.mockClear()
    rerender(<PortfolioTile {...tileProps({ mode: 'item', selectedItem: OTHER_ITEM })} />)
    expect(scrollIntoView).toHaveBeenCalledTimes(1)

    scrollIntoView.mockClear()
    rerender(<PortfolioTile {...tileProps({ mode: 'portfolio', selectedItem: null })} />)
    expect(scrollIntoView).not.toHaveBeenCalled()
  })
})
