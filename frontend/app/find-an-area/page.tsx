'use client'

import { useState } from 'react'
import AreaCard from '@/components/AreaCard'
import SaveSearchButton from '@/components/SaveSearchButton'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface AreaResult {
  postcode_district: string
  local_authority?: string
  family_score?: number
  nursery_count_total?: number
  nursery_count_outstanding?: number
  nursery_outstanding_pct?: number
  crime_rate_per_1000?: number
  flood_risk_level?: string
  distance_km?: number
}

export default function FindAnAreaPage() {
  const [postcode, setPostcode] = useState('')
  const [radiusKm, setRadiusKm] = useState(15)
  const [minFamilyScore, setMinFamilyScore] = useState(0)
  const [minNurseryPct, setMinNurseryPct] = useState(0)
  const [sort, setSort] = useState('family_score')
  const [results, setResults] = useState<AreaResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searched, setSearched] = useState(false)

  async function doSearch() {
    if (!postcode.trim()) return
    setLoading(true)
    setError('')

    try {
      const params = new URLSearchParams({
        postcode: postcode.trim(),
        radius_km: String(radiusKm),
        sort,
        ...(minFamilyScore > 0 && { min_family_score: String(minFamilyScore) }),
        ...(minNurseryPct > 0 && { min_nursery_pct: String(minNurseryPct) }),
      })

      const res = await fetch(`${API_URL}/api/v1/areas/family-search?${params}`)
      if (!res.ok) throw new Error('Search failed')

      const data = await res.json()
      setResults(data.data || [])
      setSearched(true)
    } catch (err: any) {
      setError(err.message || 'Search failed')
    }
    setLoading(false)
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Find an area to move to</h1>
        <p className="text-gray-600">Compare areas by Family Score — nursery quality, safety, and more.</p>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm text-gray-600 font-medium">Starting postcode</label>
            <input
              type="text"
              value={postcode}
              onChange={e => setPostcode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doSearch()}
              placeholder="e.g. SW11 1AA"
              className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="text-sm text-gray-600 font-medium">Search radius</label>
            <select
              value={radiusKm}
              onChange={e => setRadiusKm(Number(e.target.value))}
              className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value={5}>5km</option>
              <option value={10}>10km</option>
              <option value={15}>15km</option>
              <option value={25}>25km</option>
              <option value={50}>50km</option>
            </select>
          </div>
          <div>
            <label className="text-sm text-gray-600 font-medium">Sort by</label>
            <select
              value={sort}
              onChange={e => setSort(e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="family_score">Family Score (highest)</option>
              <option value="nursery_score">Nursery quality (highest)</option>
              <option value="distance">Distance (nearest)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <label className="text-sm text-gray-600 font-medium">
              Min Family Score: {minFamilyScore}
            </label>
            <input
              type="range"
              min={0} max={10} step={0.5}
              value={minFamilyScore}
              onChange={e => setMinFamilyScore(Number(e.target.value))}
              className="w-full mt-1"
            />
          </div>
          <div>
            <label className="text-sm text-gray-600 font-medium">
              Min Outstanding nursery %: {minNurseryPct}%
            </label>
            <input
              type="range"
              min={0} max={100} step={5}
              value={minNurseryPct}
              onChange={e => setMinNurseryPct(Number(e.target.value))}
              className="w-full mt-1"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <button
            onClick={doSearch}
            disabled={loading}
            className="w-full sm:w-auto px-8 py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? 'Searching...' : 'Search areas'}
          </button>
          <SaveSearchButton
            criteria={{
              type: 'areas',
              postcode,
              radius_km: radiusKm,
              min_family_score: minFamilyScore,
              min_nursery_pct: minNurseryPct,
              sort,
            }}
            defaultName={postcode ? `Areas near ${postcode}` : 'Area search'}
          />
        </div>
      </div>

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      {searched && (
        <p className="text-sm text-gray-500 mb-4">{results.length} areas found</p>
      )}

      {/* Results grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {results.map(area => (
          <AreaCard key={area.postcode_district} area={area} />
        ))}
      </div>

      {searched && results.length === 0 && !loading && (
        <div className="text-center py-12">
          <p className="text-gray-500">No areas found matching your criteria. Try widening your search.</p>
        </div>
      )}

      <p className="text-xs text-gray-400 mt-8 text-center">
        Family Score is an estimate based on nursery quality, crime data, deprivation indices, and flood risk.
        It is not an official metric. Always visit areas in person before making decisions.
      </p>
    </div>
  )
}
