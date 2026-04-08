'use client'

import { useMemo } from 'react'
import MapLibreMap, { MarkerDef } from './MapLibreMap'
import { Nursery } from '@/lib/api'

const GRADE_COLORS: Record<string, string> = {
  Outstanding: '#22c55e',
  Good: '#3b82f6',
  'Requires Improvement': '#f59e0b',
  Inadequate: '#ef4444',
}

interface Props {
  nurseries: Nursery[]
  centerLat: number
  centerLng: number
  radiusKm: number
}

export default function NurseryMap({ nurseries, centerLat, centerLng, radiusKm }: Props) {
  const markers: MarkerDef[] = useMemo(
    () =>
      nurseries
        .filter((n) => n.lat != null && n.lng != null)
        .map((n) => {
          const color = GRADE_COLORS[n.ofsted_overall_grade || ''] || '#9ca3af'
          const distanceLine =
            n.distance_km != null
              ? `<p style="color:#9ca3af;margin:2px 0">${n.distance_km.toFixed(1)}km away</p>`
              : ''
          return {
            id: n.urn,
            lat: n.lat as number,
            lng: n.lng as number,
            color,
            radius: 8,
            popupHtml: `
              <div style="font-size:13px;font-family:system-ui,sans-serif">
                <a href="/nursery/${n.urn}" style="color:#2563eb;font-weight:600;text-decoration:none">${n.name}</a>
                <p style="color:#6b7280;margin:2px 0">${n.ofsted_overall_grade || 'Not yet inspected'}</p>
                ${distanceLine}
              </div>`,
          } satisfies MarkerDef
        }),
    [nurseries]
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
