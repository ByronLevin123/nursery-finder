'use client'

import { useState, useEffect } from 'react'
import { getShortlist, removeFromShortlist } from '@/lib/shortlist'
import { getNursery, Nursery } from '@/lib/api'
import NurseryCard from '@/components/NurseryCard'
import Link from 'next/link'

export default function ShortlistPage() {
  const [nurseries, setNurseries] = useState<Nursery[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    async function loadShortlist() {
      const urns = getShortlist()
      if (urns.length === 0) {
        setLoading(false)
        return
      }

      const results = await Promise.allSettled(
        urns.map(urn => getNursery(urn))
      )

      const loaded = results
        .filter((r): r is PromiseFulfilledResult<Nursery> => r.status === 'fulfilled')
        .map(r => r.value)

      setNurseries(loaded)
      setLoading(false)
    }

    loadShortlist()
  }, [])

  function handleRemove(urn: string) {
    removeFromShortlist(urn)
    setNurseries(prev => prev.filter(n => n.urn !== urn))
  }

  function handleShare() {
    const urns = nurseries.map(n => n.urn).join(',')
    const url = `${window.location.origin}/shortlist?urns=${urns}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <p className="text-gray-500">Loading shortlist...</p>
      </div>
    )
  }

  if (nurseries.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Your Shortlist</h1>
        <p className="text-gray-500 mb-6">No nurseries saved yet. Search for nurseries to add them.</p>
        <Link
          href="/search"
          className="inline-block px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700"
        >
          Search nurseries →
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Your Shortlist ({nurseries.length})</h1>
        <button
          onClick={handleShare}
          className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          {copied ? '✓ Copied!' : '📋 Share shortlist'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {nurseries.map(nursery => (
          <div key={nursery.urn} className="relative">
            <NurseryCard nursery={nursery} showDistance={false} />
            <button
              onClick={() => handleRemove(nursery.urn)}
              className="absolute top-2 right-2 text-xs text-red-500 hover:text-red-700 bg-white rounded-full px-2 py-1 border border-red-200"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
