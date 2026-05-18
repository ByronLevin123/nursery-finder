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
}

interface TimelineStep {
  stage: string
  ages: string
  current?: boolean
  year?: number
  location: string
}

interface ProgressionData {
  nursery: { urn: string; name: string; grade: string | null }
  schools: School[]
  timeline: TimelineStep[] | null
}

const GRADE_COLORS: Record<string, string> = {
  Outstanding: 'bg-green-50 text-green-700 border-green-200',
  Good: 'bg-blue-50 text-blue-700 border-blue-200',
  'Requires Improvement': 'bg-amber-50 text-amber-700 border-amber-200',
  Inadequate: 'bg-red-50 text-red-700 border-red-200',
}

export default function ProgressionPath({ urn }: { urn: string }) {
  const [data, setData] = useState<ProgressionData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API_URL}/api/v1/nurseries/${urn}/progression`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [urn])

  if (loading) return null
  if (!data || !data.timeline || data.schools.length === 0) return null

  return (
    <section className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-1">School Progression Path</h2>
      <p className="text-xs text-gray-500 mb-4">From nursery to primary school — nearby options for your child</p>

      {/* Timeline */}
      <div className="flex items-center gap-0 mb-6 overflow-x-auto">
        {data.timeline.map((step, i) => (
          <div key={step.stage} className="flex items-center">
            <div className={`flex-shrink-0 px-4 py-3 rounded-xl text-center min-w-[120px] ${
              step.current
                ? 'bg-indigo-50 border-2 border-indigo-300'
                : 'bg-gray-50 border border-gray-200'
            }`}>
              <p className={`text-sm font-semibold ${step.current ? 'text-indigo-700' : 'text-gray-700'}`}>
                {step.stage}
              </p>
              <p className="text-xs text-gray-500">{step.ages} yrs</p>
              {step.year && (
                <p className="text-xs font-medium text-indigo-600 mt-1">Sept {step.year}</p>
              )}
            </div>
            {i < data.timeline!.length - 1 && (
              <div className="flex-shrink-0 w-8 h-0.5 bg-gray-300 mx-1" />
            )}
          </div>
        ))}
      </div>

      {/* Schools list */}
      <p className="text-sm font-medium text-gray-700 mb-3">
        Primary schools within 2km ({data.schools.length} found)
      </p>
      <div className="space-y-2">
        {data.schools.map((school) => (
          <div key={school.urn} className="flex items-center justify-between gap-3 py-2 border-b border-gray-100 last:border-0">
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
                {school.age_range && <span>{school.age_range} yrs</span>}
                {school.pupils && <span>{school.pupils} pupils</span>}
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
