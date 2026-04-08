'use client'

import { useMemo } from 'react'
import MapLibreMap, { MarkerDef, PolygonDef } from '@/components/MapLibreMap'
import type { AssistantArea } from '@/lib/api'

interface Props {
  results: AssistantArea[]
  isochrone?: {
    type: 'FeatureCollection'
    features: Array<{
      type: 'Feature'
      properties: { duration_min: number; mode: string }
      geometry: { type: 'Polygon'; coordinates: [number, number][][] }
    }>
  } | null
}

function colorFor(score: number): string {
  if (score >= 75) return '#22c55e'
  if (score >= 55) return '#6366f1'
  if (score >= 35) return '#f59e0b'
  return '#ef4444'
}

function center(results: AssistantArea[]): [number, number] {
  const valid = results.filter((r) => r.lat != null && r.lng != null)
  if (valid.length === 0) return [-2.5, 54.0]
  const lat = valid.reduce((s, r) => s + (r.lat as number), 0) / valid.length
  const lng = valid.reduce((s, r) => s + (r.lng as number), 0) / valid.length
  return [lng, lat]
}

const BAND_COLORS = ['#1e3a8a', '#2563eb', '#60a5fa', '#bfdbfe']

export default function InnerMap({ results, isochrone }: Props) {
  const centerLngLat = center(results)
  const zoom = results.length > 0 ? 9 : 6

  const markers: MarkerDef[] = useMemo(
    () =>
      results
        .filter((r) => r.lat != null && r.lng != null)
        .map((r) => {
          const color = colorFor(r.score)
          const rationale = r.match_rationale
            ? `<p style="margin-top:4px;color:#374151;font-size:11px;line-height:1.3">${r.match_rationale}</p>`
            : ''
          const auth = r.local_authority
            ? `<div style="color:#6b7280;font-size:11px">${r.local_authority}</div>`
            : ''
          return {
            id: r.postcode_district,
            lat: r.lat as number,
            lng: r.lng as number,
            color,
            radius: 9,
            popupHtml: `
              <div style="font-family:system-ui,sans-serif;max-width:240px">
                <div style="font-weight:600;color:#111827">${r.postcode_district}</div>
                ${auth}
                <div style="margin-top:2px"><span style="font-weight:600;color:${color}">${r.score}% match</span></div>
                ${rationale}
              </div>`,
          } satisfies MarkerDef
        }),
    [results]
  )

  const polygons: PolygonDef[] = useMemo(() => {
    if (!isochrone?.features?.length) return []
    // Sort by duration descending so largest is drawn first (bottom)
    const sorted = [...isochrone.features].sort(
      (a, b) => b.properties.duration_min - a.properties.duration_min
    )
    return sorted.map((f, idx) => ({
      id: `iso-${f.properties.duration_min}`,
      coordinates: f.geometry.coordinates,
      fillColor: BAND_COLORS[idx % BAND_COLORS.length],
      fillOpacity: 0.18,
      lineColor: BAND_COLORS[idx % BAND_COLORS.length],
      lineWidth: 1.5,
    }))
  }, [isochrone])

  return (
    <MapLibreMap
      center={centerLngLat}
      zoom={zoom}
      markers={markers}
      polygons={polygons}
    />
  )
}
