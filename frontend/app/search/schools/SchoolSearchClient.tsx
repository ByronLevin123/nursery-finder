'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { searchSchools, School, SchoolSearchResult } from '@/lib/api'
import SchoolCard from '@/components/SchoolCard'
import OglAttribution from '@/components/OglAttribution'
import dynamic from 'next/dynamic'

const SchoolMap = dynamic(() => import('@/components/SchoolMap'), { ssr: false })

const PHASE_OPTIONS = [
  { value: '', label: 'All phases' },
  { value: 'Primary', label: 'Primary' },
  { value: 'Secondary', label: 'Secondary' },
  { value: 'All-through', label: 'All-through' },
]

const RATING_OPTIONS = [
  { value: '', label: 'Any Ofsted rating' },
  { value: 'Outstanding', label: 'Outstanding' },
  { value: 'Good', label: 'Good' },
  { value: 'Requires Improvement', label: 'Requires Improvement' },
]

function SchoolSearchContent() {
  const searchParams = useSearchParams()
  const initialQuery = searchParams.get('q') || ''

  const [postcode, setPostcode] = useState(initialQuery)
  const [radiusKm, setRadiusKm] = useState(3)
  const [phase, setPhase] = useState('')
  const [ofstedRating, setOfstedRating] = useState('')
  const [results, setResults] = useState<SchoolSearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mobileView, setMobileView] = useState<'list' | 'map'>('list')

  async function doSearch() {
    const cleaned = postcode.trim()
    if (!cleaned) {
      setError('Please enter a postcode')
      return
    }
    setLoading(true)
    setError('')
    try {
      const data = await searchSchools({
        postcode: cleaned,
        radius_km: radiusKm,
        phase: phase || null,
        ofsted_rating: ofstedRating || null,
      })
      setResults(data)
    } catch (err: any) {
      setError(err.message || 'Search failed')
      setResults(null)
    }
    setLoading(false)
  }

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-64px)] relative">
      {/* Mobile List/Map toggle */}
      {results && (
        <div className="lg:hidden fixed bottom-20 left-1/2 -translate-x-1/2 z-40">
          <div className="flex bg-white rounded-full shadow-lg border border-gray-200 p-1">
            <button
              onClick={() => setMobileView('list')}
              className={`px-4 py-2 text-sm font-medium rounded-full transition-colors ${
                mobileView === 'list' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              List
            </button>
            <button
              onClick={() => setMobileView('map')}
              className={`px-4 py-2 text-sm font-medium rounded-full transition-colors ${
                mobileView === 'map' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Map
            </button>
          </div>
        </div>
      )}

      {/* Left panel: filters + results */}
      <div className={`w-full lg:w-1/3 overflow-y-auto border-r border-gray-200 bg-white lg:h-full ${mobileView === 'map' ? 'hidden lg:block' : ''}`}>
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-lg font-bold text-gray-900 mb-3">Find Schools</h1>

          {/* Search bar */}
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={postcode}
              onChange={e => setPostcode(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') doSearch() }}
              placeholder="Enter postcode..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
              autoComplete="off"
            />
            <button
              onClick={doSearch}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? '...' : 'Search'}
            </button>
          </div>

          {/* Distance */}
          <div className="mb-3">
            <label className="text-xs text-gray-500 font-medium">Distance: {radiusKm}km</label>
            <div className="flex gap-2 mt-1">
              {[1, 2, 3, 5, 10].map(km => (
                <button
                  key={km}
                  onClick={() => setRadiusKm(km)}
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

          {/* Phase filter */}
          <div className="mb-3">
            <label className="text-xs text-gray-500 font-medium">Phase</label>
            <select
              value={phase}
              onChange={e => setPhase(e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
            >
              {PHASE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Ofsted rating filter */}
          <div className="mb-3">
            <label className="text-xs text-gray-500 font-medium">Ofsted rating</label>
            <select
              value={ofstedRating}
              onChange={e => setOfstedRating(e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
            >
              {RATING_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <button
            onClick={doSearch}
            disabled={loading}
            className="w-full py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            Apply filters
          </button>
        </div>

        {/* Results */}
        <div className="p-4">
          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

          {results && (
            <p className="text-sm text-gray-500 mb-3" aria-live="polite" role="status">
              {results.meta.total} school{results.meta.total !== 1 ? 's' : ''} found within {radiusKm}km
            </p>
          )}

          <div className="space-y-3">
            {results?.data.map(school => (
              <SchoolCard key={school.urn} school={school} />
            ))}
          </div>

          {results && results.data.length === 0 && !loading && (
            <div className="text-center py-8">
              <p className="text-gray-500">No schools found. Try increasing the search radius or changing filters.</p>
            </div>
          )}

          {results && <OglAttribution />}
        </div>
      </div>

      {/* Right panel: map */}
      <div className={`w-full lg:w-2/3 lg:h-full sticky top-0 ${mobileView === 'map' ? 'h-[calc(100vh-64px)]' : 'hidden lg:block'}`}>
        {results?.meta.search_lat && results?.meta.search_lng ? (
          <SchoolMap
            schools={results.data}
            centerLat={results.meta.search_lat}
            centerLng={results.meta.search_lng}
            radiusKm={radiusKm}
          />
        ) : (
          <div className="h-full bg-gray-100 flex items-center justify-center">
            <p className="text-gray-400">Search by postcode to find nearby schools</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function SchoolSearchClient() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><p>Loading...</p></div>}>
      <SchoolSearchContent />
    </Suspense>
  )
}
