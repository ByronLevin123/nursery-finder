'use client'

import { useEffect, useState } from 'react'
import { getTravelTime, TravelMode, TravelEndpoint } from '@/lib/api'
import PostcodeAutocomplete from './PostcodeAutocomplete'

interface Props {
  nurseryLat: number
  nurseryLng: number
  nurseryUrn: string
  homePostcode?: string | null
}

type Origin = 'home' | 'nursery' | 'custom'

const MODES: { id: TravelMode; label: string; icon: string }[] = [
  { id: 'walk', label: 'Walk', icon: '🚶' },
  { id: 'cycle', label: 'Cycle', icon: '🚴' },
  { id: 'drive', label: 'Drive', icon: '🚗' },
]

export default function TravelTimePanel({
  nurseryLat,
  nurseryLng,
  nurseryUrn,
  homePostcode,
}: Props) {
  const [origin, setOrigin] = useState<Origin>(homePostcode ? 'home' : 'custom')
  const [customPostcode, setCustomPostcode] = useState('')
  const [destPostcode, setDestPostcode] = useState('')
  const [mode, setMode] = useState<TravelMode>('walk')
  const [result, setResult] = useState<{ duration_s: number; distance_m: number; fallback?: boolean } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function fetchTime(m: TravelMode) {
    setError(null)
    setLoading(true)
    try {
      let from: TravelEndpoint
      let to: TravelEndpoint
      if (origin === 'nursery') {
        if (!destPostcode.trim()) {
          setLoading(false)
          return
        }
        from = { urn: nurseryUrn }
        to = { postcode: destPostcode.trim() }
      } else {
        const pc = origin === 'home' ? homePostcode : customPostcode.trim()
        if (!pc) {
          setError('Enter a postcode')
          setLoading(false)
          return
        }
        from = { postcode: pc }
        to = { lat: nurseryLat, lng: nurseryLng }
      }
      const r = await getTravelTime(from, to, m)
      if (!r) setError('Could not compute travel time')
      else setResult(r)
    } catch (e: any) {
      setError(e?.message || 'Travel time failed')
    } finally {
      setLoading(false)
    }
  }

  // Clear the result when origin/postcode changes
  useEffect(() => {
    setResult(null)
  }, [origin, customPostcode, destPostcode])

  const minutes = result ? Math.round(result.duration_s / 60) : null
  const km = result ? (result.distance_m / 1000).toFixed(1) : null

  return (
    <section className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
      <h3 className="font-semibold text-gray-900 mb-3">Travel time</h3>

      <div className="flex flex-wrap gap-2 items-center text-sm mb-3">
        <label className="text-gray-600">From</label>
        <select
          value={origin}
          onChange={(e) => setOrigin(e.target.value as Origin)}
          className="px-2 py-1.5 border border-gray-300 rounded-md text-sm"
        >
          {homePostcode && <option value="home">Home ({homePostcode})</option>}
          <option value="nursery">This nursery (to destination)</option>
          <option value="custom">Enter postcode…</option>
        </select>

        {origin === 'custom' && (
          <div className="w-48">
            <PostcodeAutocomplete
              value={customPostcode}
              onChange={setCustomPostcode}
              placeholder="e.g. SW11 1AA"
            />
          </div>
        )}
        {origin === 'nursery' && (
          <div className="w-48">
            <PostcodeAutocomplete
              value={destPostcode}
              onChange={setDestPostcode}
              placeholder="Destination postcode"
            />
          </div>
        )}
      </div>

      <div className="flex gap-2 mb-3">
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => {
              setMode(m.id)
              fetchTime(m.id)
            }}
            className={`px-3 py-1.5 rounded-md border text-sm ${
              mode === m.id
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {m.icon} {m.label}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-gray-500">Calculating…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {result && !loading && (
        <p className="text-sm text-gray-800">
          <strong>{minutes} min</strong> ({km} km) by {mode}
          {result.fallback && (
            <span className="ml-2 text-xs text-gray-400">(estimated)</span>
          )}
        </p>
      )}
    </section>
  )
}
