'use client'

import { useMemo } from 'react'
import MapLibreMap, { MarkerDef, CircleDef } from './MapLibreMap'
import { Nursery } from '@/lib/api'

const GRADE_COLORS: Record<string, string> = {
  Outstanding: '#22c55e',
  Good: '#3b82f6',
  'Requires Improvement': '#f59e0b',
  Inadequate: '#ef4444',
}

/* ── Commute band definitions (walk speed ~5km/h = ~83m/min) ── */
const COMMUTE_BANDS: Array<{ minutes: number; radiusM: number; color: string; opacity: number; label: string }> = [
  { minutes: 5,  radiusM: 400,  color: '#166534', opacity: 0.10, label: '5 min walk' },
  { minutes: 10, radiusM: 800,  color: '#22c55e', opacity: 0.08, label: '10 min walk' },
  { minutes: 15, radiusM: 1200, color: '#eab308', opacity: 0.07, label: '15 min walk' },
  { minutes: 20, radiusM: 1600, color: '#f97316', opacity: 0.06, label: '20 min walk' },
  { minutes: 30, radiusM: 2400, color: '#ef4444', opacity: 0.05, label: '30 min walk' },
]

interface Props {
  nurseries: Nursery[]
  centerLat: number
  centerLng: number
  radiusKm: number
  schoolMarkers?: MarkerDef[]
  activityMarkers?: MarkerDef[]
  homeLocation?: { lat: number; lng: number }
  workLocation?: { lat: number; lng: number }
  travelBoundary?: { lat: number; lng: number; radiusM: number; mode: string }
  onBoundsChanged?: (center: { lat: number; lng: number }, zoom: number) => void
  showLegend?: boolean
}

export default function NurseryMap({
  nurseries,
  centerLat,
  centerLng,
  radiusKm,
  schoolMarkers = [],
  activityMarkers = [],
  homeLocation,
  workLocation,
  travelBoundary,
  onBoundsChanged,
  showLegend = true,
}: Props) {
  // Build nursery markers with enhanced popups
  const nurseryMarkers: MarkerDef[] = useMemo(
    () =>
      nurseries
        .filter((n) => n.lat != null && n.lng != null)
        .map((n) => {
          const color = GRADE_COLORS[n.ofsted_overall_grade || ''] || '#9ca3af'
          const grade = n.ofsted_overall_grade || 'Not yet inspected'
          const fee = n.fee_avg_monthly != null ? Math.round(n.fee_avg_monthly) : null
          const distance = n.distance_km != null ? n.distance_km.toFixed(1) : null
          const walkMin = distance ? Math.round(parseFloat(distance) * 12) : null
          const hasFunded = n.places_funded_2yr || n.places_funded_3_4yr

          const popupHtml = `
            <div style="min-width:200px;max-width:280px;font-size:13px;font-family:system-ui,sans-serif">
              <a href="/nursery/${n.urn}" style="font-weight:700;color:#2563eb;text-decoration:none">${n.name}</a>
              <div style="display:flex;gap:6px;margin:4px 0;align-items:center;flex-wrap:wrap">
                <span style="background:#dcfce7;color:#166534;padding:1px 6px;border-radius:9px;font-size:11px">${grade}</span>
                ${fee ? `<span style="font-size:11px;color:#6b7280">£${fee}/mo</span>` : ''}
              </div>
              ${distance ? `<div style="font-size:11px;color:#9ca3af">${distance}km · ${walkMin} min walk</div>` : ''}
              ${hasFunded ? `<div style="font-size:11px;color:#059669">✓ Funded places</div>` : ''}
            </div>`

          return {
            id: n.urn,
            lat: n.lat as number,
            lng: n.lng as number,
            color,
            radius: 8,
            type: 'nursery' as const,
            popupHtml,
          } satisfies MarkerDef
        }),
    [nurseries]
  )

  // Build special location markers (home/work)
  const locationMarkers: MarkerDef[] = useMemo(() => {
    const lm: MarkerDef[] = []
    if (homeLocation) {
      lm.push({
        id: '__home__',
        lat: homeLocation.lat,
        lng: homeLocation.lng,
        type: 'home',
        color: '#10b981',
        radius: 12,
        popupHtml: '<div style="font-size:13px;font-family:system-ui,sans-serif;font-weight:600">Your home</div>',
      })
    }
    if (workLocation) {
      lm.push({
        id: '__work__',
        lat: workLocation.lat,
        lng: workLocation.lng,
        type: 'work',
        color: '#6366f1',
        radius: 12,
        popupHtml: '<div style="font-size:13px;font-family:system-ui,sans-serif;font-weight:600">Your work</div>',
      })
    }
    return lm
  }, [homeLocation, workLocation])

  // Merge all markers
  const allMarkers: MarkerDef[] = useMemo(
    () => [...nurseryMarkers, ...schoolMarkers, ...activityMarkers, ...locationMarkers],
    [nurseryMarkers, schoolMarkers, activityMarkers, locationMarkers]
  )

  // Build commute band circles for home/work locations + travel boundary
  const commuteBandCircles: CircleDef[] = useMemo(() => {
    const cs: CircleDef[] = []

    // Travel boundary — the main filter circle from home
    if (travelBoundary) {
      cs.push({
        lat: travelBoundary.lat,
        lng: travelBoundary.lng,
        radiusM: travelBoundary.radiusM,
        color: '#2563eb',
        opacity: 0.12,
        label: `${Math.round(travelBoundary.radiusM / (travelBoundary.mode === 'walk' ? 83 : travelBoundary.mode === 'cycle' ? 250 : 500))} min ${travelBoundary.mode}`,
      })
    }

    // Commute bands from home/work (only show if no travel boundary active — avoid clutter)
    if (!travelBoundary) {
      const locations = [homeLocation, workLocation].filter(Boolean) as Array<{ lat: number; lng: number }>
      for (const loc of locations) {
        for (let i = COMMUTE_BANDS.length - 1; i >= 0; i--) {
          const band = COMMUTE_BANDS[i]
          cs.push({
            lat: loc.lat,
            lng: loc.lng,
            radiusM: band.radiusM,
            color: band.color,
            opacity: band.opacity,
            label: band.label,
          })
        }
      }
    }
    return cs
  }, [homeLocation, workLocation, travelBoundary])

  return (
    <div className="relative h-full w-full">
      <MapLibreMap
        center={[centerLng, centerLat]}
        zoom={13}
        markers={allMarkers}
        circles={commuteBandCircles}
        radiusKm={radiusKm}
        onBoundsChanged={onBoundsChanged}
      />
      {/* Map legend */}
      {showLegend && (
        <div className="absolute bottom-3 left-3 z-10 bg-white/90 rounded-lg shadow-sm border border-gray-200 p-2 text-xs space-y-1">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block flex-shrink-0" /> Outstanding
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block flex-shrink-0" /> Good
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block flex-shrink-0" /> Requires Improvement
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block flex-shrink-0" /> Inadequate
          </div>
        </div>
      )}
    </div>
  )
}
