'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { conversationalSearch, getSearchSuggestions, SearchSuggestion } from '@/lib/api'

export default function HomeSearch() {
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [smart, setSmart] = useState(false)
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [sugLoading, setSugLoading] = useState(false)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const fetchSuggestions = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (q.length < 2) { setSuggestions([]); return }
    setSugLoading(true)
    debounceRef.current = setTimeout(async () => {
      const results = await getSearchSuggestions(q)
      setSuggestions(results)
      setSugLoading(false)
      setShowSuggestions(true)
    }, 300)
  }, [])

  function handleInputChange(val: string) {
    setQuery(val)
    fetchSuggestions(val)
  }

  function selectSuggestion(s: SearchSuggestion) {
    setShowSuggestions(false)
    if (s.type === 'nursery' && s.urn) {
      router.push(`/nursery/${s.urn}`)
    } else {
      setQuery(s.postcode || s.label)
      router.push(`/search?q=${encodeURIComponent(s.postcode || s.label)}`)
    }
  }

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setShowSuggestions(false)
    const cleaned = query.trim()
    if (!cleaned) { setError('Please enter a postcode, area, or nursery name'); return }
    setError('')

    if (!smart) {
      router.push(`/search?q=${encodeURIComponent(cleaned)}`)
      return
    }

    setLoading(true)
    try {
      const filters = await conversationalSearch(cleaned)
      const params = new URLSearchParams()
      if (filters?.postcode) params.set('q', filters.postcode)
      else params.set('q', cleaned)
      if (filters?.grade) params.set('grade', filters.grade)
      if (filters?.funded_2yr) params.set('funded_2yr', '1')
      if (filters?.funded_3yr) params.set('funded_3yr', '1')
      if (filters?.radius_km) params.set('radius_km', String(filters.radius_km))
      if (filters?.minFamilyScore != null) params.set('minFamilyScore', String(filters.minFamilyScore))
      if (filters?.maxCrimeRate != null) params.set('maxCrimeRate', String(filters.maxCrimeRate))
      router.push(`/search?${params.toString()}`)
    } catch {
      router.push(`/search?q=${encodeURIComponent(cleaned)}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div ref={wrapperRef}>
      <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3 max-w-xl mx-auto relative">
        <div className="flex-1 relative">
          <input
            type="text"
            value={query}
            onChange={e => handleInputChange(e.target.value)}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            placeholder={smart ? 'Try: "Outstanding nurseries near SW11 with funded 2 year places"' : 'Postcode, area, or nursery name...'}
            className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none"
            autoComplete="off"
          />
          {showSuggestions && (suggestions.length > 0 || sugLoading) && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
              {sugLoading && suggestions.length === 0 && (
                <div className="px-4 py-3 text-sm text-gray-400">Searching...</div>
              )}
              {suggestions.map((s, i) => (
                <button
                  key={`${s.type}-${s.urn || s.postcode}-${i}`}
                  type="button"
                  onClick={() => selectSuggestion(s)}
                  className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center gap-2 border-b border-gray-50 last:border-0"
                >
                  <span className="text-gray-400 text-sm">
                    {s.type === 'nursery' ? '🏫' : '📍'}
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
          type="submit"
          disabled={loading}
          className="px-8 py-3 bg-blue-600 text-white text-lg font-semibold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-60"
        >
          {loading ? 'Thinking…' : 'Search'}
        </button>
      </form>
      <div className="flex items-center justify-center gap-2 mt-2">
        <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={smart}
            onChange={e => setSmart(e.target.checked)}
            className="rounded"
          />
          ✨ Smart search (try natural language)
        </label>
      </div>
      <p className="text-xs text-gray-500 mt-2 text-center">Try a postcode (SW11 1AA), area (Battersea), or nursery name</p>
      {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
    </div>
  )
}
