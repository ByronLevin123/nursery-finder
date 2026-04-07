'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { conversationalSearch } from '@/lib/api'

export default function HomeSearch() {
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [smart, setSmart] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
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
    <div>
      <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3 max-w-xl mx-auto">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={smart ? 'Try: "Outstanding nurseries near SW11 with funded 2 year places"' : 'Postcode, area, or nursery name...'}
          className="flex-1 px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none"
        />
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
