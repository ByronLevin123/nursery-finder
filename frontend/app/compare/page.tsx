'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { compareNurseries, Nursery } from '@/lib/api'
import { getCompareList, removeFromCompare, clearCompare } from '@/lib/compare'
import ComparisonTable from '@/components/ComparisonTable'
import Link from 'next/link'
import { useSession } from '@/components/SessionProvider'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

function CompareContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [nurseries, setNurseries] = useState<Nursery[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [emailing, setEmailing] = useState(false)
  const [emailToast, setEmailToast] = useState<string | null>(null)
  const { session, user } = useSession()

  useEffect(() => {
    async function load() {
      // Get URNs from URL params or localStorage
      const urlUrns = searchParams.get('urns')?.split(',').filter(Boolean) || []
      const urns = urlUrns.length >= 2 ? urlUrns : getCompareList()

      if (urns.length < 2) {
        setLoading(false)
        return
      }

      try {
        const data = await compareNurseries(urns)
        setNurseries(data)
      } catch (err: any) {
        setError(err.message || 'Failed to load nurseries')
      }
      setLoading(false)
    }

    load()
  }, [searchParams])

  function handleRemove(urn: string) {
    removeFromCompare(urn)
    const updated = nurseries.filter(n => n.urn !== urn)
    setNurseries(updated)

    // Update URL
    if (updated.length >= 2) {
      const newUrns = updated.map(n => n.urn).join(',')
      router.replace(`/compare?urns=${newUrns}`)
    }
  }

  function handleClearAll() {
    clearCompare()
    setNurseries([])
    router.replace('/compare')
  }

  async function handleEmail() {
    if (!session) return
    const defaultEmail = user?.email || ''
    const to = window.prompt('Send comparison to which email?', defaultEmail)
    if (!to) return
    setEmailing(true)
    setEmailToast(null)
    try {
      const res = await fetch(`${API_URL}/api/v1/email/comparison`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ to, urns: nurseries.map(n => n.urn) }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to send email')
      }
      setEmailToast('Email sent!')
    } catch (err: any) {
      setEmailToast(err.message || 'Failed to send')
    } finally {
      setEmailing(false)
      setTimeout(() => setEmailToast(null), 4000)
    }
  }

  function handleShare() {
    const urns = nurseries.map(n => n.urn).join(',')
    const url = `${window.location.origin}/compare?urns=${urns}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-16 text-center">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-64 mx-auto mb-4" />
          <div className="h-4 bg-gray-200 rounded w-48 mx-auto" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Comparison Error</h1>
        <p className="text-red-500 mb-6">{error}</p>
        <Link
          href="/search"
          className="inline-block px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700"
        >
          Search nurseries
        </Link>
      </div>
    )
  }

  if (nurseries.length < 2) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="text-5xl mb-4">&#9878;</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Compare Nurseries</h1>
        <p className="text-gray-500 mb-2">
          Add at least 2 nurseries to compare them side by side.
        </p>
        <p className="text-gray-400 text-sm mb-8">
          Use the compare button (&#9878;) on any nursery card to add it to your comparison.
        </p>
        <Link
          href="/search"
          className="inline-block px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700"
        >
          Search nurseries to compare
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Compare Nurseries ({nurseries.length})
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Best values are highlighted in <span className="bg-green-50 text-green-700 px-1.5 py-0.5 rounded text-xs font-medium">green</span>
          </p>
        </div>
        <div className="flex gap-2">
          {session ? (
            <button
              onClick={handleEmail}
              disabled={emailing}
              className="px-4 py-2 text-sm border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50"
            >
              {emailing ? 'Sending…' : 'Email this comparison'}
            </button>
          ) : (
            <Link
              href="/login?next=/compare"
              className="px-4 py-2 text-sm border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 transition-colors"
            >
              Sign in to email
            </Link>
          )}
          <button
            onClick={handleShare}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {copied ? '\u2713 Copied!' : '\ud83d\udccb Share link'}
          </button>
          <Link
            href="/search"
            className="px-4 py-2 text-sm border border-blue-300 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
          >
            + Add nursery
          </Link>
          <button
            onClick={handleClearAll}
            className="px-4 py-2 text-sm border border-red-200 text-red-500 rounded-lg hover:bg-red-50 transition-colors"
          >
            Clear all
          </button>
        </div>
      </div>

      {emailToast && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
          {emailToast}
        </div>
      )}

      {/* Comparison Table — horizontal scroll on mobile, sticky first column */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
        <ComparisonTable nurseries={nurseries} onRemove={handleRemove} />
      </div>

      {/* Legend */}
      <div className="mt-4 flex gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-green-50 border border-green-200 inline-block" />
          Best value
        </span>
        <span className="flex items-center gap-1">
          <span className="text-amber-500">&#9888;</span>
          Inspection over 4 years old
        </span>
      </div>
    </div>
  )
}

export default function ComparePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-gray-500">Loading comparison...</p>
      </div>
    }>
      <CompareContent />
    </Suspense>
  )
}
