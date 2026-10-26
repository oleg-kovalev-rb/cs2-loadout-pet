import { describe, test, expect, vi, afterEach } from 'vitest'
import { MOBILE_MEDIA_QUERY, isMobileViewport, prefersReducedMotion } from '../utils/viewport'

afterEach(() => {
  vi.unstubAllGlobals()
})

function stubMatchMedia(matches = {}) {
  const matchMedia = vi.fn((query) => ({ matches: Boolean(matches[query]), media: query }))
  vi.stubGlobal('matchMedia', matchMedia)
  return matchMedia
}

describe('isMobileViewport', () => {
  test('is true when the phone query matches', () => {
    const matchMedia = stubMatchMedia({ [MOBILE_MEDIA_QUERY]: true })

    expect(isMobileViewport()).toBe(true)
    expect(matchMedia).toHaveBeenCalledWith(MOBILE_MEDIA_QUERY)
  })

  test('is false when the phone query does not match', () => {
    stubMatchMedia({ [MOBILE_MEDIA_QUERY]: false })

    expect(isMobileViewport()).toBe(false)
  })

  test('is false when matchMedia is unavailable', () => {
    vi.stubGlobal('matchMedia', undefined)

    expect(isMobileViewport()).toBe(false)
  })
})

describe('prefersReducedMotion', () => {
  test('is true when the reduced-motion query matches', () => {
    const matchMedia = stubMatchMedia({ '(prefers-reduced-motion: reduce)': true })

    expect(prefersReducedMotion()).toBe(true)
    expect(matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)')
  })

  test('is false when the reduced-motion query does not match', () => {
    stubMatchMedia({ '(prefers-reduced-motion: reduce)': false })

    expect(prefersReducedMotion()).toBe(false)
  })

  test('is false when matchMedia is unavailable', () => {
    vi.stubGlobal('matchMedia', undefined)

    expect(prefersReducedMotion()).toBe(false)
  })
})
