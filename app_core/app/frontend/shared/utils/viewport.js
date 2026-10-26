export const MOBILE_MEDIA_QUERY = '(max-width: 640px)'
export const REDUCED_MOTION_MEDIA_QUERY = '(prefers-reduced-motion: reduce)'

function matches(query) {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia(query).matches
  )
}

export function isMobileViewport() {
  return matches(MOBILE_MEDIA_QUERY)
}

export function prefersReducedMotion() {
  return matches(REDUCED_MOTION_MEDIA_QUERY)
}
