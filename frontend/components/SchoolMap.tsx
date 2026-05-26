'use client'

import { useMemo } from 'react'
import MapLibreMap, { MarkerDef } from './MapLibreMap'
import { School } from '@/lib/api'

const GRADE_COLORS: Record<string, string> = {
  Outstanding: '#22c55e',
  Good: '#3b82f6',
  'Requires Improvement': '#f59e0b',
  Inadequate: '#ef4444',
}

interface Props {
  schools: School[]
  centerLat: number
  centerLng: number
  radiusKm: number
}

export default function SchoolMap({ schools, centerLat, centerLng, radiusKm }: Props) {
  const markers: MarkerDef[] = useMemo(
    () =>
      schools
        .filter((s) => s.lat != null && s.lng != null)
        .map((s) => {
          const color = GRADE_COLORS[s.ofsted_rating || ''] || '#9ca3af'
          const distanceLine =
            s.distance_km != null
              ? `<p style="color:#9ca3af;margin:2px 0">${s.distance_km.toFixed(1)}km away</p>`
              : ''
          return {
            id: s.urn,
            lat: s.lat as number,
            lng: s.lng as number,
            color,
            radius: 8,
            popupHtml: `
              <div style="font-size:13px;font-family:system-ui,sans-serif">
                <a href="/school/${s.urn}" style="color:#2563eb;font-weight:600;text-decoration:none">${s.name}</a>
                <p style="color:#6b7280;margin:2px 0">${s.ofsted_rating || 'Not yet inspected'}${s.phase ? ` &middot; ${s.phase}` : ''}</p>
                ${distanceLine}
              </div>`,
          } satisfies MarkerDef
        }),
    [schools]
  )

  return (
    <MapLibreMap
      center={[centerLng, centerLat]}
      zoom={13}
      markers={markers}
      radiusKm={radiusKm}
    />
  )
}
