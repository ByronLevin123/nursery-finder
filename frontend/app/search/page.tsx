'use client'

import { useState, useEffect, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { smartSearchNurseries, Nursery, SearchResult, AreaSummary, getAreaSummary, postcodeDistrict, getTravelTime, TravelMode } from '@/lib/api'
import PostcodeAutocomplete from '@/components/PostcodeAutocomplete'
import NurseryCard from '@/components/NurseryCard'
import NurseryModal from '@/components/NurseryModal'
import PreferencesPanel from '@/components/PreferencesPanel'
import {
  Preferences,
  DEFAULT_PREFERENCES,
  loadPreferences,
  savePreferences,
  clearPreferences,
  scoreNursery,
  hasActivePreferences,
  MatchResult,
} from '@/lib/preferences'
import dynamic from 'next/dynamic'

import SaveSearchButton from '@/components/SaveSearchButton'

const NurseryMap = dynamic(() => import('@/components/NurseryMap'), { ssr: false })

function SearchContent() {
  const searchParams = useSearchParams()
  const initialQuery = searchParams.get('q') || searchParams.get('postcode') || ''

  const [query, setQuery] = useState(initialQuery)
  const [selectedUrn, setSelectedUrn] = useState<string | null>(null)
  const [radiusKm, setRadiusKm] = useState(5)
  const [grade, setGrade] = useState<string | null>(null)
  const [funded2yr, setFunded2yr] = useState(false)
  const [funded3yr, setFunded3yr] = useState(false)
  const [results, setResults] = useState<SearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFERENCES)
  const [prefsLoaded, setPrefsLoaded] = useState(false)
  const [areas, setAreas] = useState<Map<string, AreaSummary | null>>(new Map())
  const [showExcluded, setShowExcluded] = useState(false)
  const [showMobilePrefs, setShowMobilePrefs] = useState(false)
  const [travelEnabled, setTravelEnabled] = useState(false)
  const [travelMaxMin, setTravelMaxMin] = useState(20)
  const [travelMode, setTravelMode] = useState<TravelMode>('walk')
  const [travelFrom, setTravelFrom] = useState('')
  const [travelTimes, setTravelTimes] = useState<Map<string, number>>(new Map())

  useEffect(() => {
    setPrefs(loadPreferences())
    setPrefsLoaded(true)
  }, [])

  function updatePrefs(p: Preferences) {
    setPrefs(p)
    savePreferences(p)
  }
  function handleClear() {
    clearPreferences()
    setPrefs(DEFAULT_PREFERENCES)
  }

  // Fetch area data per district as results arrive (deduplicated)
  useEffect(() => {
    if (!results?.data) return
    const districts = new Set<string>()
    for (const n of results.data) {
      const d = postcodeDistrict(n.postcode)
      if (d && !areas.has(d)) districts.add(d)
    }
    if (districts.size === 0) return
    let cancelled = false
    Promise.all(
      Array.from(districts).map(async d => {
        try {
          const a = await getAreaSummary(d)
          return [d, a] as const
        } catch {
          return [d, null] as const
        }
      })
    ).then(entries => {
      if (cancelled) return
      setAreas(prev => {
        const next = new Map(prev)
        for (const [d, a] of entries) next.set(d, a)
        return next
      })
    })
    return () => { cancelled = true }
  }, [results]) // eslint-disable-line react-hooks/exhaustive-deps

  const prefsActive = useMemo(() => prefsLoaded && hasActivePreferences(prefs), [prefs, prefsLoaded])

  // Compute scored + sorted results
  const scoredResults = useMemo(() => {
    if (!results?.data) return [] as Array<{ nursery: Nursery; match: MatchResult | null }>
    const list = results.data.map(n => {
      if (!prefsActive) return { nursery: n, match: null as MatchResult | null }
      const d = postcodeDistrict(n.postcode)
      const area = d ? areas.get(d) ?? null : null
      return { nursery: n, match: scoreNursery(n, area, prefs) }
    })
    if (prefsActive) {
      list.sort((a, b) => {
        const sa = a.match?.excluded ? -1 : a.match?.score ?? 0
        const sb = b.match?.excluded ? -1 : b.match?.score ?? 0
        return sb - sa
      })
    }
    return list
  }, [results, prefs, prefsActive, areas])

  // Refine by travel time — fetches for top 20 results only
  useEffect(() => {
    if (!travelEnabled || !travelFrom.trim() || !results?.data) {
      setTravelTimes(new Map())
      return
    }
    let cancelled = false
    const top = results.data.slice(0, 20).filter((n) => n.lat && n.lng)
    Promise.all(
      top.map(async (n) => {
        const r = await getTravelTime(
          { postcode: travelFrom.trim() },
          { lat: n.lat!, lng: n.lng! },
          travelMode
        )
        return [n.urn, r?.duration_s ?? Infinity] as const
      })
    ).then((entries) => {
      if (cancelled) return
      const m = new Map<string, number>()
      for (const [urn, s] of entries) m.set(urn, s)
      setTravelTimes(m)
    })
    return () => {
      cancelled = true
    }
  }, [travelEnabled, travelFrom, travelMode, results])

  const visibleResults = useMemo(() => {
    let list = scoredResults
    if (prefsActive && !showExcluded) list = list.filter((r) => !r.match?.excluded)
    if (travelEnabled && travelFrom.trim() && travelTimes.size) {
      list = list.filter((r) => {
        const s = travelTimes.get(r.nursery.urn)
        return s != null && s <= travelMaxMin * 60
      })
    }
    return list
  }, [scoredResults, prefsActive, showExcluded, travelEnabled, travelFrom, travelMaxMin, travelTimes])

  const excludedCount = useMemo(
    () => scoredResults.filter(r => r.match?.excluded).length,
    [scoredResults]
  )

  async function doSearch() {
    if (!query.trim()) return
    setLoading(true)
    setError('')
    try {
      const data = await smartSearchNurseries({
        query: query.trim(),
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
    if (initialQuery) doSearch()
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
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doSearch()}
              placeholder="Postcode, area, or nursery name..."
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

            {/* Travel time filter */}
            <div className="border-t border-gray-200 pt-3">
              <label className="flex items-center gap-2 text-sm text-gray-700 font-medium">
                <input
                  type="checkbox"
                  checked={travelEnabled}
                  onChange={(e) => setTravelEnabled(e.target.checked)}
                  className="rounded"
                />
                Travel time filter
              </label>
              {travelEnabled && (
                <div className="mt-2 space-y-2">
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    Within
                    <input
                      type="number"
                      min={1}
                      max={120}
                      value={travelMaxMin}
                      onChange={(e) => setTravelMaxMin(Number(e.target.value) || 20)}
                      className="w-14 px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                    min by
                    <select
                      value={travelMode}
                      onChange={(e) => setTravelMode(e.target.value as TravelMode)}
                      className="px-2 py-1 border border-gray-300 rounded text-sm"
                    >
                      <option value="walk">Walk</option>
                      <option value="cycle">Cycle</option>
                      <option value="drive">Drive</option>
                    </select>
                  </div>
                  <PostcodeAutocomplete
                    value={travelFrom}
                    onChange={setTravelFrom}
                    placeholder="From postcode…"
                  />
                </div>
              )}
            </div>

            <button
              onClick={doSearch}
              disabled={loading}
              className="w-full py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              Apply filters
            </button>

            <div className="pt-2">
              <SaveSearchButton
                criteria={{
                  type: 'nurseries',
                  query,
                  radius_km: radiusKm,
                  grade,
                  funded_2yr: funded2yr,
                  funded_3yr: funded3yr,
                  preferences: prefs,
                }}
                defaultName={query ? `Nurseries near ${query}` : 'Nursery search'}
              />
            </div>
          </div>
        </div>

        {/* Preferences panel (desktop) */}
        <div className="hidden lg:block p-4 border-b border-gray-200">
          <PreferencesPanel value={prefs} onChange={updatePrefs} onClear={handleClear} />
        </div>

        {/* Mobile prefs toggle */}
        <div className="lg:hidden p-4 border-b border-gray-200">
          <button
            onClick={() => setShowMobilePrefs(true)}
            className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg font-semibold"
          >
            {prefsActive ? 'Edit your priorities' : 'Tell us what matters to you'}
          </button>
        </div>

        {/* Results */}
        <div className="p-4">
          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

          {results && (
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                {prefsActive
                  ? `${visibleResults.length} of ${results.meta.total} match your priorities`
                  : `${results.meta.total} nurseries found within ${radiusKm}km`}
              </p>
              {prefsActive && excludedCount > 0 && (
                <button
                  onClick={() => setShowExcluded(s => !s)}
                  className="text-xs text-indigo-700 hover:underline font-medium"
                >
                  {showExcluded ? 'Hide' : 'Show'} {excludedCount} excluded
                </button>
              )}
            </div>
          )}

          <div className="space-y-3">
            {visibleResults.map(({ nursery, match }) => (
              <NurseryCard
                key={nursery.urn}
                nursery={nursery}
                onClick={() => setSelectedUrn(nursery.urn)}
                match={match}
              />
            ))}
          </div>

          {results && visibleResults.length === 0 && !loading && (
            <div className="text-center py-8">
              <p className="text-gray-500">
                {prefsActive
                  ? 'No nurseries match your priorities. Try loosening the filters.'
                  : 'No nurseries found. Try increasing the search radius.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Mobile prefs sheet */}
      {showMobilePrefs && (
        <div className="lg:hidden fixed inset-0 z-[2000] bg-black/50 flex items-end" onClick={() => setShowMobilePrefs(false)}>
          <div
            className="bg-white w-full max-h-[85vh] overflow-y-auto rounded-t-2xl p-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-gray-900">Your priorities</h3>
              <button onClick={() => setShowMobilePrefs(false)} className="text-gray-500 text-xl">✕</button>
            </div>
            <PreferencesPanel value={prefs} onChange={updatePrefs} onClear={handleClear} />
          </div>
        </div>
      )}

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
            <p className="text-gray-400">Search by postcode, area, or nursery name</p>
          </div>
        )}
      </div>

      <NurseryModal urn={selectedUrn} onClose={() => setSelectedUrn(null)} />
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
