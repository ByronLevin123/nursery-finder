'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { loadGoogleMapsScript, getGoogleMapsApiKey } from '@/lib/googleMaps'

interface Props {
  lat: number
  lng: number
  name: string
  height?: string
}

export default function StreetViewPanorama({ lat, lng, name, height = 'h-72 sm:h-96' }: Props) {
  const API_KEY = getGoogleMapsApiKey()
  const containerRef = useRef<HTMLDivElement>(null)
  const panoramaRef = useRef<any>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'no-coverage' | 'error'>('loading')
  const [showMap, setShowMap] = useState(true)

  const initStreetView = useCallback(async () => {
    if (!API_KEY) {
      setStatus('error')
      return
    }

    try {
      await loadGoogleMapsScript()

      if (!containerRef.current || !window.google?.maps) {
        setStatus('error')
        return
      }

      const google = window.google
      const location = new google.maps.LatLng(lat, lng)

      // Check if Street View coverage exists near this location
      const svService = new google.maps.StreetViewService()
      svService.getPanorama(
        { location, radius: 100, source: google.maps.StreetViewSource.OUTDOOR },
        (data: any, svStatus: any) => {
          if (svStatus === google.maps.StreetViewStatus.OK && containerRef.current) {
            panoramaRef.current = new google.maps.StreetViewPanorama(containerRef.current, {
              position: data.location.latLng,
              pov: {
                heading: google.maps.geometry
                  ? google.maps.geometry.spherical.computeHeading(data.location.latLng, location)
                  : 0,
                pitch: 5,
              },
              zoom: 1,
              addressControl: false,
              showRoadLabels: false,
              motionTracking: false,
              motionTrackingControl: false,
              fullscreenControl: true,
              linksControl: true,
              panControl: true,
              zoomControl: true,
              enableCloseButton: false,
            })
            setStatus('ready')
          } else {
            setStatus('no-coverage')
          }
        }
      )
    } catch {
      setStatus('error')
    }
  }, [lat, lng])

  useEffect(() => {
    if (showMap) {
      setStatus('loading')
      initStreetView()
    }
    return () => {
      panoramaRef.current = null
    }
  }, [initStreetView, showMap])

  if (!API_KEY) return null

  if (status === 'no-coverage') {
    return (
      <div className={`${height} bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center`}>
        <div className="text-center text-gray-500 px-4">
          <svg className="w-8 h-8 mx-auto mb-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
          </svg>
          <p className="text-sm font-medium">Street View not available</p>
          <p className="text-xs mt-1">No coverage near {name}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Toggle button */}
      <div className="absolute top-2 right-2 z-10 flex gap-1">
        <button
          onClick={() => setShowMap(true)}
          className={`px-2.5 py-1 text-xs font-medium rounded-l-md border transition ${
            showMap
              ? 'bg-white text-gray-900 border-gray-300 shadow-sm'
              : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'
          }`}
        >
          Street View
        </button>
        <button
          onClick={() => setShowMap(false)}
          className={`px-2.5 py-1 text-xs font-medium rounded-r-md border transition ${
            !showMap
              ? 'bg-white text-gray-900 border-gray-300 shadow-sm'
              : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'
          }`}
        >
          Map
        </button>
      </div>

      {showMap ? (
        <div className={`${height} rounded-lg overflow-hidden border border-gray-200 relative`}>
          {status === 'loading' && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
              <div className="flex items-center gap-2 text-gray-500 text-sm">
                <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
                Loading Street View...
              </div>
            </div>
          )}
          <div ref={containerRef} className="w-full h-full" />
        </div>
      ) : (
        <div className={`${height} rounded-lg overflow-hidden border border-gray-200`}>
          {/* Static map fallback — rendered by parent component */}
          <StaticMapFallback lat={lat} lng={lng} name={name} />
        </div>
      )}
    </div>
  )
}

/** Interactive Google Map when user toggles away from Street View */
function StaticMapFallback({ lat, lng, name }: { lat: number; lng: number; name: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)

  useEffect(() => {
    let cancelled = false
    async function init() {
      await loadGoogleMapsScript()
      if (cancelled || !containerRef.current || !window.google?.maps) return

      const google = window.google
      const center = { lat, lng }
      const map = new google.maps.Map(containerRef.current, {
        center,
        zoom: 16,
        gestureHandling: 'cooperative',
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      })
      new google.maps.Marker({ position: center, map, title: name })
      mapInstanceRef.current = map
    }
    init()
    return () => { cancelled = true }
  }, [lat, lng, name])

  return <div ref={containerRef} className="w-full h-full" />
}
