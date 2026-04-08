'use client'

import { useEffect, useRef } from 'react'
import maplibregl, { Map as MlMap, Popup as MlPopup } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

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
  center: [number, number] // [lng, lat] — MapLibre convention
  zoom?: number
  markers?: MarkerDef[]
  polygons?: PolygonDef[]
  style?: string
  scrollZoom?: boolean
  className?: string
  heightClassName?: string
  radiusKm?: number // optional search radius circle
}

const DEFAULT_STYLE =
  process.env.NEXT_PUBLIC_MAP_STYLE ||
  'https://tiles.openfreemap.org/styles/liberty'

// Build a pseudo-circle polygon (for the search radius overlay).
function circlePolygon(lat: number, lng: number, radiusKm: number, steps = 64): [number, number][] {
  const coords: [number, number][] = []
  const latR = radiusKm / 111
  const lngR = radiusKm / (111 * Math.cos((lat * Math.PI) / 180))
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * 2 * Math.PI
    coords.push([lng + lngR * Math.cos(t), lat + latR * Math.sin(t)])
  }
  return coords
}

export default function MapLibreMap({
  center,
  zoom = 13,
  markers = [],
  polygons = [],
  style = DEFAULT_STYLE,
  scrollZoom = true,
  className = '',
  heightClassName = 'h-full w-full',
  radiusKm,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<MlMap | null>(null)
  const markerObjectsRef = useRef<maplibregl.Marker[]>([])
  const popupRef = useRef<MlPopup | null>(null)

  // Create map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = new maplibregl.Map({
      container: containerRef.current,
      style,
      center,
      zoom,
      attributionControl: { compact: true },
    })
    if (!scrollZoom) map.scrollZoom.disable()
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    mapRef.current = map
    return () => {
      markerObjectsRef.current.forEach((m) => m.remove())
      markerObjectsRef.current = []
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Update center/zoom when they change
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    map.jumpTo({ center, zoom })
  }, [center[0], center[1], zoom])

  // Render markers
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    markerObjectsRef.current.forEach((m) => m.remove())
    markerObjectsRef.current = []

    for (const m of markers) {
      const el = document.createElement('div')
      const r = m.radius ?? 9
      const color = m.color ?? '#3b82f6'
      el.style.width = `${r * 2}px`
      el.style.height = `${r * 2}px`
      el.style.borderRadius = '50%'
      el.style.background = color
      el.style.border = '2px solid white'
      el.style.boxShadow = '0 0 0 1px rgba(0,0,0,0.2)'
      el.style.cursor = m.onClick || m.popupHtml ? 'pointer' : 'default'

      const marker = new maplibregl.Marker({ element: el }).setLngLat([m.lng, m.lat]).addTo(map)

      if (m.popupHtml || m.onClick) {
        el.addEventListener('click', (ev) => {
          ev.stopPropagation()
          if (m.onClick) m.onClick()
          if (m.popupHtml) {
            if (popupRef.current) popupRef.current.remove()
            popupRef.current = new maplibregl.Popup({ offset: 14, closeButton: true })
              .setLngLat([m.lng, m.lat])
              .setHTML(m.popupHtml)
              .addTo(map)
          }
        })
      }

      markerObjectsRef.current.push(marker)
    }
  }, [markers])

  // Render polygons + radius
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const applyLayers = () => {
      // Wipe previous polygon/radius layers under our known prefix
      const style = map.getStyle()
      if (style?.layers) {
        for (const l of style.layers) {
          if (l.id.startsWith('mlm-poly-') || l.id.startsWith('mlm-radius-')) {
            if (map.getLayer(l.id)) map.removeLayer(l.id)
          }
        }
      }
      if (style?.sources) {
        for (const sid of Object.keys(style.sources)) {
          if (sid.startsWith('mlm-poly-') || sid.startsWith('mlm-radius-')) {
            if (map.getSource(sid)) map.removeSource(sid)
          }
        }
      }

      // Radius circle
      if (radiusKm && radiusKm > 0) {
        const ring = circlePolygon(center[1], center[0], radiusKm)
        const sid = 'mlm-radius-src'
        map.addSource(sid, {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: { type: 'Polygon', coordinates: [ring] },
          },
        })
        map.addLayer({
          id: 'mlm-radius-fill',
          type: 'fill',
          source: sid,
          paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0.05 },
        })
        map.addLayer({
          id: 'mlm-radius-line',
          type: 'line',
          source: sid,
          paint: { 'line-color': '#3b82f6', 'line-width': 1 },
        })
      }

      // User polygons
      polygons.forEach((p, idx) => {
        const sid = `mlm-poly-src-${p.id}-${idx}`
        map.addSource(sid, {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: { type: 'Polygon', coordinates: p.coordinates },
          },
        })
        map.addLayer({
          id: `mlm-poly-fill-${p.id}-${idx}`,
          type: 'fill',
          source: sid,
          paint: {
            'fill-color': p.fillColor ?? '#3b82f6',
            'fill-opacity': p.fillOpacity ?? 0.2,
          },
        })
        map.addLayer({
          id: `mlm-poly-line-${p.id}-${idx}`,
          type: 'line',
          source: sid,
          paint: {
            'line-color': p.lineColor ?? p.fillColor ?? '#1d4ed8',
            'line-width': p.lineWidth ?? 1.5,
          },
        })
      })
    }

    if (map.isStyleLoaded()) {
      applyLayers()
    } else {
      map.once('load', applyLayers)
    }
  }, [polygons, radiusKm, center[0], center[1]])

  return <div ref={containerRef} className={`${heightClassName} ${className}`} />
}
