'use client'

import { useEffect, useRef, useCallback } from 'react'
import { loadGoogleMapsScript, getGoogleMapsApiKey } from '@/lib/googleMaps'

/* ── Public interfaces (unchanged — all consumers depend on these) ── */

export interface MarkerDef {
  id?: string | number
  lat: number
  lng: number
  color?: string
  radius?: number
  popupHtml?: string
  onClick?: () => void
}

export interface PolygonDef {
  id: string
  coordinates: [number, number][][] // GeoJSON polygon coordinates (outer + holes)
  fillColor?: string
  fillOpacity?: number
  lineColor?: string
  lineWidth?: number
}

interface Props {
  center: [number, number] // [lng, lat] — kept for backward compat
  zoom?: number
  markers?: MarkerDef[]
  polygons?: PolygonDef[]
  style?: string // ignored — kept for API compat
  scrollZoom?: boolean
  className?: string
  heightClassName?: string
  radiusKm?: number
}

/* ── Helpers ── */

/** Convert GeoJSON [lng, lat] ring to google.maps.LatLng array */
function ringToLatLngs(ring: [number, number][]): any[] {
  const google = window.google
  return ring.map(([lng, lat]) => new google.maps.LatLng(lat, lng))
}

/* ── Component ── */

export default function GoogleMap({
  center,
  zoom = 13,
  markers = [],
  polygons = [],
  scrollZoom = true,
  className = '',
  heightClassName = 'h-full w-full',
  radiusKm,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<any>(null)
  const markerObjectsRef = useRef<any[]>([])
  const infoWindowRef = useRef<any>(null)
  const polygonObjectsRef = useRef<any[]>([])
  const circleRef = useRef<any>(null)
  const readyRef = useRef(false)

  // Initialize map once
  const initMap = useCallback(async () => {
    if (!containerRef.current || mapRef.current) return
    if (!getGoogleMapsApiKey()) return

    await loadGoogleMapsScript()

    const google = window.google
    if (!google?.maps || !containerRef.current) return

    const map = new google.maps.Map(containerRef.current, {
      center: { lat: center[1], lng: center[0] },
      zoom,
      gestureHandling: scrollZoom ? 'auto' : 'cooperative',
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      styles: [
        // Subtle, clean style
        { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
      ],
    })

    mapRef.current = map
    infoWindowRef.current = new google.maps.InfoWindow()
    readyRef.current = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    initMap()
    return () => {
      // Cleanup
      markerObjectsRef.current.forEach((m) => m.setMap(null))
      markerObjectsRef.current = []
      polygonObjectsRef.current.forEach((p) => p.setMap(null))
      polygonObjectsRef.current = []
      if (circleRef.current) circleRef.current.setMap(null)
      if (infoWindowRef.current) infoWindowRef.current.close()
      mapRef.current = null
      readyRef.current = false
    }
  }, [initMap])

  // Update center/zoom
  useEffect(() => {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    map.setCenter({ lat: center[1], lng: center[0] })
    map.setZoom(zoom)
  }, [center[0], center[1], zoom])

  // Render markers
  useEffect(() => {
    const map = mapRef.current
    if (!map || !readyRef.current || !window.google) return

    const google = window.google

    // Clear old markers
    markerObjectsRef.current.forEach((m) => m.setMap(null))
    markerObjectsRef.current = []

    for (const m of markers) {
      const color = m.color ?? '#3b82f6'
      const r = m.radius ?? 9
      const scale = r / 9 // normalize against default 9px

      const marker = new google.maps.Marker({
        position: { lat: m.lat, lng: m.lng },
        map,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: color,
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
          scale: r,
        },
        clickable: !!(m.popupHtml || m.onClick),
      })

      if (m.popupHtml || m.onClick) {
        marker.addListener('click', () => {
          if (m.onClick) m.onClick()
          if (m.popupHtml && infoWindowRef.current) {
            infoWindowRef.current.setContent(m.popupHtml)
            infoWindowRef.current.open(map, marker)
          }
        })
      }

      markerObjectsRef.current.push(marker)
    }
  }, [markers])

  // Render polygons + radius circle
  useEffect(() => {
    const map = mapRef.current
    if (!map || !readyRef.current || !window.google) return

    const google = window.google

    // Clear old polygons
    polygonObjectsRef.current.forEach((p) => p.setMap(null))
    polygonObjectsRef.current = []

    // Clear old radius circle
    if (circleRef.current) {
      circleRef.current.setMap(null)
      circleRef.current = null
    }

    // Radius circle
    if (radiusKm && radiusKm > 0) {
      circleRef.current = new google.maps.Circle({
        map,
        center: { lat: center[1], lng: center[0] },
        radius: radiusKm * 1000, // meters
        fillColor: '#3b82f6',
        fillOpacity: 0.05,
        strokeColor: '#3b82f6',
        strokeWeight: 1,
        clickable: false,
      })
    }

    // User polygons
    for (const p of polygons) {
      // GeoJSON: coordinates[0] is outer ring, rest are holes
      const paths = p.coordinates.map((ring) => ringToLatLngs(ring))

      const poly = new google.maps.Polygon({
        paths,
        map,
        fillColor: p.fillColor ?? '#3b82f6',
        fillOpacity: p.fillOpacity ?? 0.2,
        strokeColor: p.lineColor ?? p.fillColor ?? '#1d4ed8',
        strokeWeight: p.lineWidth ?? 1.5,
        clickable: false,
      })

      polygonObjectsRef.current.push(poly)
    }
  }, [polygons, radiusKm, center[0], center[1]])

  return <div ref={containerRef} className={`${heightClassName} ${className}`} />
}
