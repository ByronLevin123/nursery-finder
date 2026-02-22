'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { searchNurseries, Nursery, SearchResult } from '@/lib/api'
import NurseryCard from '@/components/NurseryCard'
import dynamic from 'next/dynamic'

const NurseryMap = dynamic(() => import('@/components/NurseryMap'), { ssr: false })

function SearchContent() {
  const searchParams = useSearchParams()
  const initialPostcode = searchParams.get('postcode') || ''

  const [postcode, setPostcode] = useState(initialPostcode)
  const [radiusKm, setRadiusKm] = useState(5)
  const [grade, setGrade] = useState<string | null>(null)
  const [funded2yr, setFunded2yr] = useState(false)
  const [funded3yr, setFunded3yr] = useState(false)
  const [results, setResults] = useState<SearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function doSearch() {
    if (!postcode.trim()) return
    setLoading(true)
    setError('')
    try {
      const data = await searchNurseries({
        postcode: postcode.trim(),
        radius_km: radiusKm,
        grade,
        funded_2yr: funded2yr,
        funded_3yr: funded3yr,
      })
      setResults(data)
    } catch (err: any) {
      setError(err.message || 'Search failed')
      setResults(null)
    }
    setLoading(false)
  }

  useEffect(() => {
    if (initialPostcode) doSearch()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col lg:flex-row min-h-[calc(100vh-64px)]">
      {/* Left panel: filters + results */}
      <div className="w-full lg:w-1/3 overflow-y-auto border-r border-gray-200 bg-white">
        <div className="p-4 border-b border-gray-200">
          {/* Search bar */}
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={postcode}
              onChange={e => setPostcode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doSearch()}
              placeholder="Postcode..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <button
              onClick={doSearch}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? '...' : 'Search'}
            </button>
          </div>

          {/* Filters */}
          <div className="space-y-3">
            {/* Distance */}
            <div>
              <label className="text-xs text-gray-500 font-medium">Distance: {radiusKm}km</label>
              <div className="flex gap-2 mt-1">
                {[1, 2, 5, 10, 20].map(km => (
                  <button
                    key={km}
                    onClick={() => { setRadiusKm(km); }}
                    className={`px-3 py-1 text-xs rounded-full border ${
                      radiusKm === km
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                    }`}
                  >
                    {km}km
                  </button>
                ))}
              </div>
            </div>

            {/* Grade filter */}
            <div>
              <label className="text-xs text-gray-500 font-medium">Ofsted grade</label>
              <select
                value={grade || ''}
                onChange={e => setGrade(e.target.value || null)}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">All grades</option>
                <option value="Outstanding">Outstanding</option>
                <option value="Good">Good</option>
                <option value="Requires Improvement">Requires Improvement</option>
                <option value="Inadequate">Inadequate</option>
              </select>
            </div>

            {/* Funded toggles */}
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input type="checkbox" checked={funded2yr} onChange={e => setFunded2yr(e.target.checked)} className="rounded" />
                2yr funded
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input type="checkbox" checked={funded3yr} onChange={e => setFunded3yr(e.target.checked)} className="rounded" />
                3-4yr funded
              </label>
            </div>

            <button
              onClick={doSearch}
              disabled={loading}
              className="w-full py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              Apply filters
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="p-4">
          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

          {results && (
            <p className="text-sm text-gray-500 mb-3">
              {results.meta.total} nurseries found within {radiusKm}km
            </p>
          )}

          <div className="space-y-3">
            {results?.data.map(nursery => (
              <NurseryCard key={nursery.urn} nursery={nursery} />
            ))}
          </div>

          {results && results.data.length === 0 && !loading && (
            <div className="text-center py-8">
              <p className="text-gray-500">No nurseries found. Try increasing the search radius.</p>
            </div>
          )}
        </div>
      </div>

      {/* Right panel: map */}
      <div className="w-full lg:w-2/3 h-[400px] lg:h-auto">
        {results?.meta.search_lat && results?.meta.search_lng ? (
          <NurseryMap
            nurseries={results.data}
            centerLat={results.meta.search_lat}
            centerLng={results.meta.search_lng}
            radiusKm={radiusKm}
          />
        ) : (
          <div className="h-full bg-gray-100 flex items-center justify-center">
            <p className="text-gray-400">Enter a postcode to see nurseries on the map</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><p>Loading...</p></div>}>
      <SearchContent />
    </Suspense>
  )
}
