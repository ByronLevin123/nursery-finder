'use client'

import { MapContainer, TileLayer, CircleMarker, Circle, Popup, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { Nursery } from '@/lib/api'
import Link from 'next/link'

const GRADE_COLORS: Record<string, string> = {
  'Outstanding': '#22c55e',
  'Good': '#3b82f6',
  'Requires Improvement': '#f59e0b',
  'Inadequate': '#ef4444',
}

interface Props {
  nurseries: Nursery[]
  centerLat: number
  centerLng: number
  radiusKm: number
}

function MapUpdater({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => {
    map.setView([lat, lng], 13)
  }, [lat, lng, map])
  return null
}

import { useEffect } from 'react'

export default function NurseryMap({ nurseries, centerLat, centerLng, radiusKm }: Props) {
  return (
    <MapContainer
      center={[centerLat, centerLng]}
      zoom={13}
      style={{ height: '100%', width: '100%' }}
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Search radius circle */}
      <Circle
        center={[centerLat, centerLng]}
        radius={radiusKm * 1000}
        pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.05, weight: 1 }}
      />

      {/* Nursery markers */}
      {nurseries.map(nursery => {
        if (!nursery.lat || !nursery.lng) return null
        const color = GRADE_COLORS[nursery.ofsted_overall_grade || ''] || '#9ca3af'

        return (
          <CircleMarker
            key={nursery.urn}
            center={[nursery.lat, nursery.lng]}
            radius={8}
            pathOptions={{ color, fillColor: color, fillOpacity: 0.8, weight: 2 }}
          >
            <Popup>
              <div className="text-sm">
                <Link href={`/nursery/${nursery.urn}`} className="font-semibold text-blue-600 hover:underline">
                  {nursery.name}
                </Link>
                <p className="text-gray-500">{nursery.ofsted_overall_grade || 'Not yet inspected'}</p>
                {nursery.distance_km != null && (
                  <p className="text-gray-400">{nursery.distance_km.toFixed(1)}km away</p>
                )}
              </div>
            </Popup>
          </CircleMarker>
        )
      })}
    </MapContainer>
  )
}
