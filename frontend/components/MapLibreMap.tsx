'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

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

/* ── Component ── */

export default function LeafletMap({
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
  const mapRef = useRef<L.Map | null>(null)
  const markerLayerRef = useRef<L.LayerGroup | null>(null)
  const polygonLayerRef = useRef<L.LayerGroup | null>(null)
  const circleRef = useRef<L.Circle | null>(null)

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      center: [center[1], center[0]], // Leaflet uses [lat, lng]
      zoom,
      scrollWheelZoom: scrollZoom,
      zoomControl: true,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map)

    mapRef.current = map
    markerLayerRef.current = L.layerGroup().addTo(map)
    polygonLayerRef.current = L.layerGroup().addTo(map)

    return () => {
      map.remove()
      mapRef.current = null
      markerLayerRef.current = null
      polygonLayerRef.current = null
      circleRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Update center/zoom
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    map.setView([center[1], center[0]], zoom)
  }, [center[0], center[1], zoom])

  // Render markers
  useEffect(() => {
    const layer = markerLayerRef.current
    if (!layer) return

    layer.clearLayers()

    for (const m of markers) {
      const color = m.color ?? '#3b82f6'
      const r = m.radius ?? 8

      const circleMarker = L.circleMarker([m.lat, m.lng], {
        radius: r,
        fillColor: color,
        fillOpacity: 1,
        color: '#ffffff',
        weight: 2,
      }).addTo(layer)

      if (m.popupHtml) {
        circleMarker.bindPopup(m.popupHtml, { maxWidth: 250 })
      }
      if (m.onClick) {
        circleMarker.on('click', m.onClick)
      }
    }
  }, [markers])

  // Render polygons + radius circle
  useEffect(() => {
    const map = mapRef.current
    const layer = polygonLayerRef.current
    if (!map || !layer) return

    layer.clearLayers()

    // Remove old radius circle
    if (circleRef.current) {
      circleRef.current.remove()
      circleRef.current = null
    }

    // Radius circle
    if (radiusKm && radiusKm > 0) {
      circleRef.current = L.circle([center[1], center[0]], {
        radius: radiusKm * 1000, // meters
        fillColor: '#3b82f6',
        fillOpacity: 0.05,
        color: '#3b82f6',
        weight: 1,
      }).addTo(map)
    }

    // User polygons (GeoJSON [lng, lat] → Leaflet [lat, lng])
    for (const p of polygons) {
      const latLngs = p.coordinates.map((ring) =>
        ring.map(([lng, lat]) => [lat, lng] as [number, number])
      )

      L.polygon(latLngs, {
        fillColor: p.fillColor ?? '#3b82f6',
        fillOpacity: p.fillOpacity ?? 0.2,
        color: p.lineColor ?? p.fillColor ?? '#1d4ed8',
        weight: p.lineWidth ?? 1.5,
      }).addTo(layer)
    }
  }, [polygons, radiusKm, center[0], center[1]])

  return <div ref={containerRef} className={`${heightClassName} ${className}`} />
}
