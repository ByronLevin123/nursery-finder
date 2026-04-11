/**
 * Shared Google Maps JavaScript API loader.
 * Used by MapLibreMap (now GoogleMap), StreetViewPanorama, and any future
 * component that needs the google.maps namespace.
 */

declare global {
  interface Window {
    google?: any
    __googleMapsCallback?: () => void
  }
}

let _apiKey: string | null = null

let scriptLoaded = false
let scriptLoading = false
const loadCallbacks: (() => void)[] = []

/** Lazy getter — reads env var on first call, safe during SSR/build */
export function getGoogleMapsApiKey(): string {
  if (_apiKey === null) {
    _apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''
  }
  return _apiKey
}

export function loadGoogleMapsScript(): Promise<void> {
  if (scriptLoaded && window.google?.maps) return Promise.resolve()

  return new Promise((resolve) => {
    loadCallbacks.push(resolve)

    if (scriptLoading) return

    scriptLoading = true
    window.__googleMapsCallback = () => {
      scriptLoaded = true
      scriptLoading = false
      loadCallbacks.forEach((cb) => cb())
      loadCallbacks.length = 0
    }

    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${getGoogleMapsApiKey()}&callback=__googleMapsCallback&libraries=geometry`
    script.async = true
    script.defer = true
    document.head.appendChild(script)
  })
}
