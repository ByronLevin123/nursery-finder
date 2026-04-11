'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import AreaCard from '@/components/AreaCard'
import SaveSearchButton from '@/components/SaveSearchButton'
import PostcodeAutocomplete from '@/components/PostcodeAutocomplete'
import { API_URL, getIsochrone, IsochroneResponse, TravelMode } from '@/lib/api'

const MapLibreMap = dynamic(() => import('@/components/MapLibreMap'), { ssr: false })

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
  const [showCommuteZones, setShowCommuteZones] = useState(false)
  const [commuteMode, setCommuteMode] = useState<TravelMode>('drive')
  const [isochrone, setIsochrone] = useState<IsochroneResponse | null>(null)
  const [isoLoading, setIsoLoading] = useState(false)

  useEffect(() => {
    if (!showCommuteZones || !postcode.trim()) {
      setIsochrone(null)
      return
    }
    let cancelled = false
    setIsoLoading(true)
    getIsochrone({ postcode: postcode.trim() }, [15, 30, 45, 60], commuteMode).then((r) => {
      if (cancelled) return
      setIsochrone(r)
      setIsoLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [showCommuteZones, commuteMode, postcode])

  const BAND_COLORS = ['#1e3a8a', '#2563eb', '#60a5fa', '#bfdbfe']
  const isoPolygons = isochrone?.features
    ? [...isochrone.features]
        .sort((a, b) => b.properties.duration_min - a.properties.duration_min)
        .map((f, idx) => ({
          id: `iso-${f.properties.duration_min}`,
          coordinates: f.geometry.coordinates,
          fillColor: BAND_COLORS[idx % BAND_COLORS.length],
          fillOpacity: 0.18,
          lineColor: BAND_COLORS[idx % BAND_COLORS.length],
        }))
    : []
  const isoCenter: [number, number] = isochrone?.meta
    ? [isochrone.meta.from.lng, isochrone.meta.from.lat]
    : [-2.5, 54.0]

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
            <div className="mt-1">
              <PostcodeAutocomplete
                value={postcode}
                onChange={setPostcode}
                placeholder="e.g. SW11 1AA"
              />
            </div>
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

      {/* Commute zones toggle + map */}
      <div className="mb-6 bg-white border border-gray-200 rounded-xl p-4">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <input
            type="checkbox"
            checked={showCommuteZones}
            onChange={(e) => setShowCommuteZones(e.target.checked)}
            className="rounded"
          />
          Show commute zones from {postcode || 'postcode'}
          <select
            value={commuteMode}
            onChange={(e) => setCommuteMode(e.target.value as TravelMode)}
            className="ml-2 px-2 py-1 border border-gray-300 rounded text-sm"
          >
            <option value="walk">by walk</option>
            <option value="cycle">by cycle</option>
            <option value="drive">by drive</option>
          </select>
        </label>
        {showCommuteZones && (
          <div className="mt-3 h-96 rounded-lg overflow-hidden border border-gray-200">
            {isoLoading && (
              <div className="flex items-center justify-center h-full text-sm text-gray-500">
                Computing commute zones…
              </div>
            )}
            {!isoLoading && (
              <MapLibreMap center={isoCenter} zoom={10} polygons={isoPolygons} />
            )}
          </div>
        )}
        {showCommuteZones && isochrone && (
          <div className="mt-2 flex gap-3 text-xs text-gray-600">
            {[15, 30, 45, 60].map((m, idx) => (
              <span key={m} className="flex items-center gap-1">
                <span
                  className="inline-block w-3 h-3 rounded"
                  style={{ background: BAND_COLORS[3 - idx] }}
                />
                ≤{m}min
              </span>
            ))}
          </div>
        )}
      </div>

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
