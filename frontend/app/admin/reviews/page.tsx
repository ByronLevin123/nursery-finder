'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useSession } from '@/components/SessionProvider'
import { getAuthToken, adminFetch } from '@/lib/api'

interface AdminReview {
  id: string
  urn: string
  nursery_name: string | null
  author_display_name: string | null
  rating: number
  title: string
  body: string
  status: string
  created_at: string
}

interface Meta {
  total: number
  page: number
  limit: number
  pages: number
}

const STATUS_TABS = ['pending', 'approved', 'flagged', 'rejected'] as const

function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-amber-500 text-sm" aria-label={`${rating} out of 5 stars`}>
      {'★'.repeat(rating)}
      {'☆'.repeat(5 - rating)}
    </span>
  )
}

export default function AdminReviewsPage() {
  const { role } = useSession()
  const [reviews, setReviews] = useState<AdminReview[]>([])
  const [meta, setMeta] = useState<Meta>({ total: 0, page: 1, limit: 25, pages: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [status, setStatus] = useState<string>('pending')
  const [page, setPage] = useState(1)
  const [pendingCount, setPendingCount] = useState(0)

  const load = useCallback(async (s: string, p: number) => {
    setLoading(true)
    setError('')
    try {
      const token = await getAuthToken()
      if (!token) throw new Error('No auth token')
      const params = new URLSearchParams({ status: s, page: String(p), limit: '25' })
      const data = await adminFetch(`/reviews?${params}`, token)
      setReviews(data.data || [])
      setMeta(data.meta || { total: 0, page: p, limit: 25, pages: 1 })
      if (s === 'pending') setPendingCount(data.meta?.total || 0)
    } catch (e: any) {
      setError(e.message || 'Failed to load reviews')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (role !== 'admin') return
    ;(async () => {
      try {
        const token = await getAuthToken()
        if (!token) return
        const data = await adminFetch('/reviews?status=pending&limit=1', token)
        setPendingCount(data.meta?.total || 0)
      } catch {}
    })()
  }, [role])

  useEffect(() => {
    if (role !== 'admin') return
    load(status, page)
  }, [role, status, page, load])

  async function handleAction(reviewId: string, newStatus: 'approved' | 'flagged' | 'rejected') {
    try {
      const token = await getAuthToken()
      if (!token) throw new Error('No auth token')
      await adminFetch(`/reviews/${reviewId}`, token, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      })
      load(status, page)
      if (status === 'pending') setPendingCount((c) => Math.max(0, c - 1))
    } catch (e: any) {
      setError(e.message || `Failed to ${newStatus} review`)
    }
  }

  if (role !== 'admin') return null

  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900 mb-4">Reviews</h2>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Status tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => { setStatus(tab); setPage(1) }}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition ${
              status === tab
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab}
            {tab === 'pending' && pendingCount > 0 && (
              <span className="ml-2 px-1.5 py-0.5 text-xs font-bold bg-orange-100 text-orange-700 rounded-full">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-lg p-4 animate-pulse">
              <div className="h-4 w-48 bg-gray-200 rounded mb-2" />
              <div className="h-3 w-64 bg-gray-100 rounded mb-2" />
              <div className="h-3 w-full bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg font-medium">No {status} reviews</p>
          <p className="text-sm">
            {status === 'pending' ? 'All reviews are moderated!' : `No reviews with status "${status}".`}
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {reviews.map((r) => (
              <div key={r.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-2">
                  <div>
                    <Link
                      href={`/nursery/${r.urn}`}
                      className="font-semibold text-indigo-600 hover:underline"
                    >
                      {r.nursery_name || r.urn}
                    </Link>
                    <p className="text-sm text-gray-600">
                      by {r.author_display_name || 'Anonymous'}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap">
                    {new Date(r.created_at).toLocaleDateString('en-GB')}
                  </span>
                </div>

                <div className="mb-2">
                  <Stars rating={r.rating} />
                  <span className="ml-2 text-sm font-medium text-gray-900">{r.title}</span>
                </div>

                <p className="text-sm text-gray-700 mb-3 line-clamp-3">{r.body}</p>

                {(status === 'pending' || status === 'flagged') && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAction(r.id, 'approved')}
                      className="px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 transition"
                    >
                      Approve
                    </button>
                    {status !== 'flagged' && (
                      <button
                        onClick={() => handleAction(r.id, 'flagged')}
                        className="px-3 py-1.5 bg-amber-500 text-white text-xs font-semibold rounded-lg hover:bg-amber-600 transition"
                      >
                        Flag
                      </button>
                    )}
                    <button
                      onClick={() => handleAction(r.id, 'rejected')}
                      className="px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 transition"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          <Pagination meta={meta} page={page} setPage={setPage} />
        </>
      )}
    </div>
  )
}

function Pagination({
  meta,
  page,
  setPage,
}: {
  meta: Meta
  page: number
  setPage: (p: number) => void
}) {
  if (meta.pages <= 1) return null
  return (
    <div className="flex items-center justify-between mt-4 text-sm">
      <p className="text-gray-500">
        Page {meta.page} of {meta.pages} ({meta.total} total)
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => setPage(page - 1)}
          disabled={page <= 1}
          className="px-3 py-1 border border-gray-300 rounded-lg text-gray-700 disabled:opacity-40 hover:bg-gray-50 transition"
        >
          Prev
        </button>
        <button
          onClick={() => setPage(page + 1)}
          disabled={page >= meta.pages}
          className="px-3 py-1 border border-gray-300 rounded-lg text-gray-700 disabled:opacity-40 hover:bg-gray-50 transition"
        >
          Next
        </button>
      </div>
    </div>
  )
}
