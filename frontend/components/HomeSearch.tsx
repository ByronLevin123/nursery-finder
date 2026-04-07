'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function HomeSearch() {
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const cleaned = query.trim()
    if (!cleaned) { setError('Please enter a postcode, area, or nursery name'); return }
    setError('')
    router.push(`/search?q=${encodeURIComponent(cleaned)}`)
  }

  return (
    <div>
      <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3 max-w-xl mx-auto">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Postcode, area, or nursery name..."
          className="flex-1 px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none"
        />
        <button
          type="submit"
          className="px-8 py-3 bg-blue-600 text-white text-lg font-semibold rounded-xl hover:bg-blue-700 transition-colors"
        >
          Search
        </button>
      </form>
      <p className="text-xs text-gray-500 mt-2 text-center">Try a postcode (SW11 1AA), area (Battersea), or nursery name</p>
      {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
    </div>
  )
}
