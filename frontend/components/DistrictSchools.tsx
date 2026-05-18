'use client'

import { useEffect, useState } from 'react'
import { API_URL } from '@/lib/api'

interface School {
  urn: string
  name: string
  ofsted_rating: string | null
  age_range: string | null
  distance_km: number
  pupils: number | null
  website: string | null
  phase: string | null
}

const GRADE_COLORS: Record<string, string> = {
  Outstanding: 'bg-green-50 text-green-700 border-green-200',
  Good: 'bg-blue-50 text-blue-700 border-blue-200',
  'Requires Improvement': 'bg-amber-50 text-amber-700 border-amber-200',
  Inadequate: 'bg-red-50 text-red-700 border-red-200',
}

export default function DistrictSchools({ lat, lng, district }: { lat: number; lng: number; district: string }) {
  const [schools, setSchools] = useState<School[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API_URL}/api/v1/schools/near?lat=${lat}&lng=${lng}&radius_km=3`)
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((d) => setSchools(d.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [lat, lng])

  if (loading || schools.length === 0) return null

  const primary = schools.filter((s) => s.phase === 'Primary' || s.phase === 'All-through')
  const secondary = schools.filter((s) => s.phase === 'Secondary')
  const outstanding = schools.filter((s) => s.ofsted_rating === 'Outstanding').length
  const good = schools.filter((s) => s.ofsted_rating === 'Good').length

  return (
    <section className="mt-10">
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Schools near {district}</h2>
      <p className="text-sm text-gray-500 mb-4">
        {primary.length} primary, {secondary.length} secondary within 3km.
        {outstanding > 0 && ` ${outstanding} rated Outstanding.`}
        {good > 0 && ` ${good} rated Good.`}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {schools.slice(0, 10).map((school) => (
          <div key={school.urn} className="flex items-center justify-between gap-3 bg-white border border-gray-200 rounded-lg p-3">
            <div className="min-w-0">
              {school.website ? (
                <a href={school.website} target="_blank" rel="noopener noreferrer"
                  className="text-sm font-medium text-blue-600 hover:underline truncate block">
                  {school.name}
                </a>
              ) : (
                <p className="text-sm font-medium text-gray-900 truncate">{school.name}</p>
              )}
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>{school.phase}</span>
                {school.age_range && <span>{school.age_range} yrs</span>}
                <span>{school.distance_km.toFixed(1)}km</span>
              </div>
            </div>
            {school.ofsted_rating && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border flex-shrink-0 ${GRADE_COLORS[school.ofsted_rating] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                {school.ofsted_rating}
              </span>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
