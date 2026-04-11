'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { compareNurseries, Nursery } from '@/lib/api'
import { getCompareList, removeFromCompare, clearCompare } from '@/lib/compare'
import ComparisonTable from '@/components/ComparisonTable'
import ComparisonPrintView from '@/components/ComparisonPrintView'
import RadarChart from '@/components/RadarChart'
import EnquiryModal from '@/components/EnquiryModal'
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
  const [tradeoff, setTradeoff] = useState<string | null>(null)
  const [showEnquiry, setShowEnquiry] = useState(false)
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

        // Fetch AI tradeoff for top 2 if signed in
        if (data.length >= 2 && session?.access_token) {
          try {
            const trRes = await fetch(
              `${API_URL}/api/v1/recommendations/tradeoffs?urns=${data[0].urn},${data[1].urn}`,
              { headers: { Authorization: `Bearer ${session.access_token}` } }
            )
            if (trRes.ok) {
              const trData = await trRes.json()
              setTradeoff(trData.explanation || null)
            }
          } catch {
            // non-fatal
          }
        }
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

  function handlePrint() {
    window.print()
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
      {/* Print-only view */}
      <ComparisonPrintView nurseries={nurseries} />

      {/* Screen content — hidden when printing */}
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 print:hidden">
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
            onClick={handlePrint}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1.5 print:hidden"
            title="Print or save as PDF"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print / Save as PDF
          </button>
          <button
            onClick={handleShare}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors print:hidden"
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
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700 print:hidden">
          {emailToast}
        </div>
      )}

      {/* Comparison Table — horizontal scroll on mobile, sticky first column */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto print:hidden">
        <ComparisonTable nurseries={nurseries} onRemove={handleRemove} />
      </div>

      {/* Radar Chart */}
      {nurseries.length >= 2 && (
        <div className="mt-6 bg-white rounded-xl border border-gray-200 shadow-sm p-6 print:hidden">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 text-center">Dimension Comparison</h2>
          <RadarChart
            axes={(() => {
              const gradeMap: Record<string, number> = { 'Outstanding': 100, 'Good': 75, 'Requires Improvement': 40, 'Inadequate': 10 }
              const fees = nurseries.map((n: any) => n.fee_avg_monthly || 0)
              const maxFee = Math.max(...fees.filter(Boolean), 1)
              const places = nurseries.map((n: any) => n.total_places || 0)
              const maxPlaces = Math.max(...places.filter(Boolean), 1)
              return [
                { label: 'Ofsted', values: nurseries.map((n) => gradeMap[n.ofsted_overall_grade || ''] ?? 50) },
                { label: 'Reviews', values: nurseries.map((n: any) => n.review_avg_rating ? (n.review_avg_rating / 5) * 100 : 50) },
                { label: 'Google', values: nurseries.map((n: any) => n.google_rating ? (n.google_rating / 5) * 100 : 50) },
                { label: 'Value', values: nurseries.map((n: any) => n.fee_avg_monthly ? Math.max(10, 100 - ((n.fee_avg_monthly / maxFee) * 80)) : 50) },
                { label: 'Capacity', values: nurseries.map((n: any) => n.total_places ? (n.total_places / maxPlaces) * 100 : 50) },
                { label: 'Funded', values: nurseries.map((n: any) => ((n.places_funded_2yr > 0 ? 50 : 0) + (n.places_funded_3_4yr > 0 ? 50 : 0)) || 25) },
              ]
            })()}
            nurseryNames={nurseries.map((n) => n.name)}
          />
        </div>
      )}

      {/* Winner Badges */}
      {nurseries.length >= 2 && (
        <div className="mt-4 bg-white rounded-xl border border-gray-200 shadow-sm p-5 print:hidden">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Winners by category</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {(() => {
              const gradeOrder = ['Outstanding', 'Good', 'Requires Improvement', 'Inadequate']
              const categories = [
                {
                  label: 'Best Ofsted grade',
                  pick: () => {
                    let best: Nursery | null = null
                    let bestIdx = 999
                    for (const n of nurseries) {
                      const idx = gradeOrder.indexOf(n.ofsted_overall_grade || '')
                      if (idx >= 0 && idx < bestIdx) { bestIdx = idx; best = n }
                    }
                    return best ? `${best.name} (${best.ofsted_overall_grade})` : null
                  },
                },
                {
                  label: 'Best Google rating',
                  pick: () => {
                    let best: any = null
                    for (const n of nurseries) { if ((n as any).google_rating && (!best || (n as any).google_rating > best.google_rating)) best = n }
                    return best ? `${best.name} (${best.google_rating}★)` : null
                  },
                },
                {
                  label: 'Most affordable',
                  pick: () => {
                    let best: any = null
                    for (const n of nurseries) { if ((n as any).fee_avg_monthly && (!best || (n as any).fee_avg_monthly < best.fee_avg_monthly)) best = n }
                    return best ? `${best.name} (£${best.fee_avg_monthly}/mo)` : null
                  },
                },
                {
                  label: 'Most places',
                  pick: () => {
                    let best: any = null
                    for (const n of nurseries) { if ((n as any).total_places && (!best || (n as any).total_places > best.total_places)) best = n }
                    return best ? `${best.name} (${best.total_places})` : null
                  },
                },
                {
                  label: 'Best reviewed',
                  pick: () => {
                    let best: any = null
                    for (const n of nurseries) { if ((n as any).review_avg_rating && (!best || (n as any).review_avg_rating > best.review_avg_rating)) best = n }
                    return best ? `${best.name} (${best.review_avg_rating.toFixed(1)}★)` : null
                  },
                },
                {
                  label: 'Most recent inspection',
                  pick: () => {
                    let best: Nursery | null = null
                    for (const n of nurseries) { if (n.last_inspection_date && (!best || n.last_inspection_date > (best.last_inspection_date || ''))) best = n }
                    return best ? `${best.name}` : null
                  },
                },
              ]
              return categories.map((cat) => {
                const winner = cat.pick()
                if (!winner) return null
                return (
                  <div key={cat.label} className="text-xs p-2 bg-amber-50 border border-amber-200 rounded-lg">
                    <span className="mr-1">&#127942;</span>
                    <span className="font-medium">{cat.label}:</span>{' '}
                    <span className="text-gray-700">{winner}</span>
                  </div>
                )
              })
            })()}
          </div>
        </div>
      )}

      {/* AI Insight */}
      {tradeoff && (
        <div className="mt-4 bg-indigo-50 border border-indigo-200 rounded-xl p-5 print:hidden">
          <h2 className="text-sm font-semibold text-indigo-900 mb-2">AI Insight</h2>
          <p className="text-sm text-indigo-800">{tradeoff}</p>
        </div>
      )}

      {/* Enquire at all */}
      {nurseries.length >= 2 && (
        <div className="mt-4 text-center print:hidden">
          <button
            onClick={() => setShowEnquiry(true)}
            className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition"
          >
            Enquire at all {nurseries.length} nurseries
          </button>
        </div>
      )}

      {showEnquiry && (
        <EnquiryModal
          nurseries={nurseries.map((n) => ({ id: n.id, urn: n.urn, name: n.name, town: n.town }))}
          onClose={() => setShowEnquiry(false)}
        />
      )}

      {/* Legend */}
      <div className="mt-4 flex gap-4 text-xs text-gray-500 print:hidden">
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
