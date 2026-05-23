'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type GeoStatus = 'idle' | 'loading' | 'error'

const POPULAR_AREAS = [
  { label: 'Battersea (SW11)', district: 'SW11' },
  { label: 'Hackney (N16)', district: 'N16' },
  { label: 'Hampstead (NW3)', district: 'NW3' },
  { label: 'Dalston (E8)', district: 'E8' },
  { label: 'Brighton (BN1)', district: 'BN1' },
  { label: 'Bristol (BS6)', district: 'BS6' },
  { label: 'Wimbledon (SW19)', district: 'SW19' },
  { label: 'Manchester (M20)', district: 'M20' },
]

export default function NearMeClient() {
  const router = useRouter()
  const [geoStatus, setGeoStatus] = useState<GeoStatus>('idle')
  const [geoError, setGeoError] = useState<string | null>(null)
  const [postcode, setPostcode] = useState('')

  function handleUseLocation() {
    if (!navigator.geolocation) {
      setGeoStatus('error')
      setGeoError('Geolocation is not supported by your browser.')
      return
    }

    setGeoStatus('loading')
    setGeoError(null)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        router.push(`/search?lat=${latitude}&lng=${longitude}`)
      },
      (err) => {
        setGeoStatus('error')
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setGeoError('Location access was denied. Please enter your postcode instead.')
            break
          case err.TIMEOUT:
            setGeoError('Location request timed out. Please try again or enter your postcode.')
            break
          default:
            setGeoError('Could not determine your location. Please enter your postcode instead.')
        }
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    )
  }

  function handlePostcodeSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = postcode.trim()
    if (!trimmed) return
    router.push(`/search?postcode=${encodeURIComponent(trimmed)}`)
  }

  return (
    <div className="text-center">
      <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3 tracking-tight">
        Find nurseries near you
      </h1>
      <p className="text-gray-600 mb-8">
        Compare Ofsted-rated nurseries in your area with ratings, fees, and availability.
      </p>

      {/* Use my location button */}
      <button
        onClick={handleUseLocation}
        disabled={geoStatus === 'loading'}
        className="w-full px-6 py-4 bg-indigo-600 text-white rounded-xl font-semibold text-lg shadow-md hover:bg-indigo-700 transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-3 mx-auto"
      >
        {geoStatus === 'loading' ? (
          <>
            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Finding your location...
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Use my location
          </>
        )}
      </button>

      {/* Geolocation error */}
      {geoStatus === 'error' && geoError && (
        <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
          {geoError}
        </p>
      )}

      {/* Divider */}
      <div className="flex items-center gap-4 my-8">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-sm text-gray-400 font-medium">Or enter your postcode</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>

      {/* Postcode form */}
      <form onSubmit={handlePostcodeSubmit} className="flex gap-2">
        <input
          type="text"
          value={postcode}
          onChange={(e) => setPostcode(e.target.value)}
          placeholder="e.g. SW11 1AA"
          aria-label="Postcode"
          className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-base focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none"
        />
        <button
          type="submit"
          className="px-6 py-3 bg-gray-900 text-white rounded-xl font-semibold hover:bg-gray-800 transition"
        >
          Search
        </button>
      </form>

      {/* Popular areas */}
      <div className="mt-14">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Browse nurseries in popular areas
        </h2>
        <div className="flex flex-wrap justify-center gap-2">
          {POPULAR_AREAS.map((area) => (
            <Link
              key={area.district}
              href={`/nurseries-in/${area.district.toLowerCase()}`}
              className="px-4 py-2 rounded-full border border-purple-200 bg-purple-50 text-purple-800 text-sm font-medium hover:bg-purple-100 hover:border-purple-300 transition"
            >
              {area.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
