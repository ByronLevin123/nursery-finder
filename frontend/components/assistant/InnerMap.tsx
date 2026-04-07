'use client'

import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import type { AssistantArea } from '@/lib/api'

interface Props {
  results: AssistantArea[]
}

function colorFor(score: number): string {
  if (score >= 75) return '#22c55e'
  if (score >= 55) return '#6366f1'
  if (score >= 35) return '#f59e0b'
  return '#ef4444'
}

function center(results: AssistantArea[]): [number, number] {
  const valid = results.filter((r) => r.lat != null && r.lng != null)
  if (valid.length === 0) return [54.0, -2.5]
  const lat = valid.reduce((s, r) => s + (r.lat as number), 0) / valid.length
  const lng = valid.reduce((s, r) => s + (r.lng as number), 0) / valid.length
  return [lat, lng]
}

export default function InnerMap({ results }: Props) {
  const [lat, lng] = center(results)
  const zoom = results.length > 0 ? 9 : 6

  return (
    <MapContainer
      key={`${lat}-${lng}-${results.length}`}
      center={[lat, lng]}
      zoom={zoom}
      style={{ height: '100%', width: '100%' }}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {results.map((r) => {
        if (r.lat == null || r.lng == null) return null
        const color = colorFor(r.score)
        return (
          <CircleMarker
            key={r.postcode_district}
            center={[r.lat, r.lng]}
            radius={9}
            pathOptions={{ color, fillColor: color, fillOpacity: 0.8, weight: 2 }}
          >
            <Popup>
              <div className="text-sm max-w-[240px]">
                <div className="font-semibold text-gray-900">{r.postcode_district}</div>
                {r.local_authority && (
                  <div className="text-gray-500 text-xs">{r.local_authority}</div>
                )}
                <div className="mt-1">
                  <span className="font-semibold" style={{ color }}>
                    {r.score}% match
                  </span>
                </div>
                {r.match_rationale && (
                  <p className="mt-1 text-xs text-gray-700 leading-snug">{r.match_rationale}</p>
                )}
              </div>
            </Popup>
          </CircleMarker>
        )
      })}
    </MapContainer>
  )
}
