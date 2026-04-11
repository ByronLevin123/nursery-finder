'use client'

import { useState, useEffect, useMemo, useRef, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { smartSearchNurseries, Nursery, SearchResult, AreaSummary, getAreaSummary, postcodeDistrict, getTravelTime, TravelMode, getSearchSuggestions, SearchSuggestion, API_URL } from '@/lib/api'
import PostcodeAutocomplete from '@/components/PostcodeAutocomplete'
import NurseryCard from '@/components/NurseryCard'
import NurseryModal from '@/components/NurseryModal'
import PreferencesPanel from '@/components/PreferencesPanel'
import SearchFilters, { SearchFilterValues, DEFAULT_FILTERS } from '@/components/SearchFilters'
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

import SortSelect, { SortOption } from '@/components/SortSelect'
import PromotionCard from '@/components/PromotionCard'
import SaveSearchButton from '@/components/SaveSearchButton'
import SearchJsonLd from '@/components/SearchJsonLd'
import RecentlyViewed from '@/components/RecentlyViewed'
import OglAttribution from '@/components/OglAttribution'

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
  const [advancedFilters, setAdvancedFilters] = useState<SearchFilterValues>(DEFAULT_FILTERS)
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
  const [promotions, setPromotions] = useState<any[]>([])
  const [sortBy, setSortBy] = useState<SortOption>('relevance')

  // Autocomplete state
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [sugLoading, setSugLoading] = useState(false)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const searchWrapperRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

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

  // Autocomplete: fetch suggestions with debounce
  const fetchSuggestions = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (q.length < 2) { setSuggestions([]); setShowSuggestions(false); return }
    setSugLoading(true)
    debounceRef.current = setTimeout(async () => {
      const results = await getSearchSuggestions(q)
      setSuggestions(results)
      setSugLoading(false)
      setShowSuggestions(true)
    }, 300)
  }, [])

  function handleQueryChange(val: string) {
    setQuery(val)
    fetchSuggestions(val)
  }

  function selectSuggestion(s: SearchSuggestion) {
    setShowSuggestions(false)
    if (s.type === 'nursery' && s.urn) {
      setSelectedUrn(s.urn)
    } else {
      const term = s.postcode || s.label
      setQuery(term)
      doSearch(term)
    }
  }

  // Close autocomplete on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

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
    // Apply user-selected sort (only when not using preference-based ranking)
    if (sortBy !== 'relevance' && !prefsActive) {
      list = [...list].sort((a, b) => {
        const na = a.nursery
        const nb = b.nursery
        switch (sortBy) {
          case 'distance':
            return (na.distance_km ?? 999) - (nb.distance_km ?? 999)
          case 'score': {
            const scoreA = [na.quality_score, na.cost_score, na.availability_score, na.staff_score, na.sentiment_score].filter((s): s is number => s != null)
            const scoreB = [nb.quality_score, nb.cost_score, nb.availability_score, nb.staff_score, nb.sentiment_score].filter((s): s is number => s != null)
            const avgA = scoreA.length > 0 ? scoreA.reduce((x, y) => x + y, 0) / scoreA.length : 0
            const avgB = scoreB.length > 0 ? scoreB.reduce((x, y) => x + y, 0) / scoreB.length : 0
            return avgB - avgA
          }
          case 'cost_low':
            return (na.fee_avg_monthly ?? 9999) - (nb.fee_avg_monthly ?? 9999)
          case 'cost_high':
            return (nb.fee_avg_monthly ?? 0) - (na.fee_avg_monthly ?? 0)
          case 'rating':
            return (nb.google_rating ?? 0) - (na.google_rating ?? 0)
          default:
            return 0
        }
      })
    }
    return list
  }, [scoredResults, prefsActive, showExcluded, travelEnabled, travelFrom, travelMaxMin, travelTimes, sortBy])

  const excludedCount = useMemo(
    () => scoredResults.filter(r => r.match?.excluded).length,
    [scoredResults]
  )

  async function doSearch(overrideQuery?: string) {
    const searchQuery = overrideQuery ?? query
    if (!searchQuery.trim()) return
    setLoading(true)
    setError('')
    try {
      const data = await smartSearchNurseries({
        query: searchQuery.trim(),
        radius_km: radiusKm,
        grade: advancedFilters.grade || grade,
        has_availability: advancedFilters.has_availability,
        min_rating: advancedFilters.min_rating,
        provider_type: advancedFilters.provider_type,
        has_funded_2yr: advancedFilters.has_funded_2yr || funded2yr,
        has_funded_3yr: advancedFilters.has_funded_3yr || funded3yr,
      })
      setResults(data)
      // Fetch nearby promotions based on search center
      if (data?.meta?.search_lat && data?.meta?.search_lng) {
        fetch(`${API_URL}/api/v1/promotions/nearby?lat=${data.meta.search_lat}&lng=${data.meta.search_lng}`)
          .then(r => r.json())
          .then(p => setPromotions(p.data || []))
          .catch(() => setPromotions([]))
      }
    } catch (err: any) {
      setError(err.message || 'Search failed')
      setResults(null)
      setPromotions([])
    }
    setLoading(false)
  }

  useEffect(() => {
    if (initialQuery) doSearch()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-64px)]">
      {/* Left panel: filters + results */}
      <div className="w-full lg:w-1/3 overflow-y-auto border-r border-gray-200 bg-white lg:h-full">
        <div className="p-4 border-b border-gray-200">
          {/* Search bar with autocomplete */}
          <div className="flex gap-2 mb-4" ref={searchWrapperRef}>
            <div className="flex-1 relative">
              <input
                type="text"
                value={query}
                onChange={e => handleQueryChange(e.target.value)}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    setShowSuggestions(false)
                    doSearch()
                  }
                }}
                placeholder="Postcode, area, or nursery name..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                autoComplete="off"
              />
              {showSuggestions && (suggestions.length > 0 || sugLoading) && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden">
                  {sugLoading && suggestions.length === 0 && (
                    <div className="px-3 py-2 text-xs text-gray-400">Searching...</div>
                  )}
                  {suggestions.map((s, i) => (
                    <button
                      key={`${s.type}-${s.urn || s.postcode}-${i}`}
                      type="button"
                      onClick={() => selectSuggestion(s)}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2 border-b border-gray-50 last:border-0"
                    >
                      <span className="text-gray-400 text-xs">
                        {s.type === 'nursery' ? '\uD83C\uDFEB' : '\uD83D\uDCCD'}
                      </span>
                      <span className="text-sm text-gray-800 truncate">{s.label}</span>
                      <span className="text-xs text-gray-400 ml-auto flex-shrink-0">
                        {s.type === 'nursery' ? 'Nursery' : 'Area'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => { setShowSuggestions(false); doSearch() }}
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

            {/* Advanced filters */}
            <SearchFilters filters={advancedFilters} onChange={setAdvancedFilters} />

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
                  <p className="text-xs text-gray-500 mt-1">
                    Transit routing coming soon — showing drive times instead.
                  </p>
                </div>
              )}
            </div>

            <button
              onClick={() => doSearch()}
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
                  grade: advancedFilters.grade || grade,
                  funded_2yr: funded2yr,
                  funded_3yr: funded3yr,
                  has_availability: advancedFilters.has_availability,
                  min_rating: advancedFilters.min_rating,
                  provider_type: advancedFilters.provider_type,
                  has_funded_2yr: advancedFilters.has_funded_2yr,
                  has_funded_3yr: advancedFilters.has_funded_3yr,
                  preferences: prefs,
                }}
                defaultName={query ? `Nurseries near ${query}` : 'Nursery search'}
              />
            </div>
          </div>
        </div>

        {/* Preferences toggle (both desktop and mobile) */}
        <div className="p-4 border-b border-gray-200">
          <button
            onClick={() => setShowMobilePrefs(p => !p)}
            className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg font-semibold"
          >
            {prefsActive ? '✨ Edit your priorities' : '✨ Tell us what matters to you'}
          </button>
          {showMobilePrefs && (
            <div className="mt-3">
              <PreferencesPanel value={prefs} onChange={updatePrefs} onClear={handleClear} />
            </div>
          )}
        </div>

        {/* Results */}
        <div className="p-4">
          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

          {!results && !loading && <RecentlyViewed />}

          {/* Did you mean banner for fuzzy results */}
          {results?.meta?.mode === 'fuzzy' && results?.meta?.did_you_mean && (
            <div className="mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800">
                Showing results for{' '}
                <button
                  onClick={() => {
                    const term = results.meta.did_you_mean!
                    setQuery(term)
                    doSearch(term)
                  }}
                  className="font-bold underline hover:text-amber-900"
                >
                  {results.meta.did_you_mean}
                </button>
                {results.meta.query && (
                  <span className="text-amber-600"> (searched for &ldquo;{results.meta.query}&rdquo;)</span>
                )}
              </p>
            </div>
          )}

          {results && (
            <div className="mb-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  {prefsActive
                    ? `${visibleResults.length} of ${results.meta.total} match your priorities`
                    : results.meta.mode === 'place'
                      ? `${results.meta.total} nurseries found near ${(results.meta as any).place_name || query}`
                      : `${results.meta.total} nurseries found${results.meta.mode === 'postcode' ? ` within ${radiusKm}km` : ''}`}
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
              {!prefsActive && (
                <SortSelect value={sortBy} onChange={setSortBy} />
              )}
            </div>
          )}

          <div className="space-y-3">
            {visibleResults.map(({ nursery, match }, idx) => (
              <div key={nursery.urn}>
                <NurseryCard
                  nursery={nursery}
                  onClick={() => setSelectedUrn(nursery.urn)}
                  match={match}
                />
                {/* Interleave a promotion card after every 5 results */}
                {promotions.length > 0 && (idx + 1) % 5 === 0 && promotions[Math.floor(idx / 5)] && (
                  <div className="mt-3">
                    <PromotionCard promotion={promotions[Math.floor(idx / 5)]} />
                  </div>
                )}
              </div>
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

      {/* Right panel: map */}
      <div className="w-full lg:w-2/3 h-[400px] lg:h-full sticky top-0">
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

      {results?.data && query && <SearchJsonLd nurseries={results.data} query={query} />}
      <NurseryModal urn={selectedUrn} onClose={() => setSelectedUrn(null)} />
      <OglAttribution />
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
