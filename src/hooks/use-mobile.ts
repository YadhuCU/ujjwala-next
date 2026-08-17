import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  // Read the media query during render via useSyncExternalStore rather than
  // setting state inside an effect, which caused a cascading re-render.
  const isMobile = React.useSyncExternalStore(
    subscribe,
    () => window.innerWidth < MOBILE_BREAKPOINT,
    // The server has no viewport; assume desktop and let hydration correct it
    () => false,
  )

  return isMobile
}

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
  mql.addEventListener("change", onChange)
  return () => mql.removeEventListener("change", onChange)
}
