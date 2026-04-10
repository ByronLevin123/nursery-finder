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
  admin_note: string | null
  moderated_at: string | null
  created_at: string
}

interface Meta {
  total: number
  page: number
  limit: number
  pages: number
}

const STATUS_TABS = [
  { key: '', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'flagged', label: 'Flagged' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
] as const

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  published: 'bg-green-100 text-green-800',
  flagged: 'bg-amber-100 text-amber-800',
  rejected: 'bg-red-100 text-red-800',
  spam: 'bg-gray-100 text-gray-600',
}

function statusLabel(s: string) {
  if (s === 'published') return 'approved'
  return s
}

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
  const [statusFilter, setStatusFilter] = useState<string>('pending')
  const [page, setPage] = useState(1)
  const [pendingCount, setPendingCount] = useState(0)
  const [flaggedCount, setFlaggedCount] = useState(0)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({})

  const load = useCallback(async (s: string, p: number) => {
    setLoading(true)
    setError('')
    try {
      const token = await getAuthToken()
      if (!token) throw new Error('No auth token')
      const params = new URLSearchParams({ page: String(p), limit: '25' })
      // For "All" tab, map to the backend's status values; for "approved" map to "published"
      if (s === 'approved') {
        params.set('status', 'published')
      } else if (s) {
        params.set('status', s)
      }
      const data = await adminFetch(`/reviews?${params}`, token)
      setReviews(data.data || [])
      setMeta(data.meta || { total: 0, page: p, limit: 25, pages: 1 })
    } catch (e: any) {
      setError(e.message || 'Failed to load reviews')
    } finally {
      setLoading(false)
    }
  }, [])

  // Load pending + flagged counts on mount
  useEffect(() => {
    if (role !== 'admin') return
    ;(async () => {
      try {
        const token = await getAuthToken()
        if (!token) return
        const [pendingData, flaggedData] = await Promise.all([
          adminFetch('/reviews?status=pending&limit=1', token),
          adminFetch('/reviews?status=flagged&limit=1', token),
        ])
        setPendingCount(pendingData.meta?.total || 0)
        setFlaggedCount(flaggedData.meta?.total || 0)
      } catch {}
    })()
  }, [role])

  useEffect(() => {
    if (role !== 'admin') return
    load(statusFilter, page)
  }, [role, statusFilter, page, load])

  async function handleAction(reviewId: string, newStatus: 'approved' | 'flagged' | 'rejected') {
    const note = adminNotes[reviewId]
    try {
      const token = await getAuthToken()
      if (!token) throw new Error('No auth token')
      const body: Record<string, string> = { status: newStatus }
      if (note !== undefined && note.trim()) {
        body.admin_note = note.trim()
      }
      await adminFetch(`/reviews/${reviewId}`, token, {
        method: 'PATCH',
        body: JSON.stringify(body),
      })
      setAdminNotes((prev) => {
        const next = { ...prev }
        delete next[reviewId]
        return next
      })
      // Refresh counts
      if (newStatus === 'approved' || newStatus === 'rejected') {
        setPendingCount((c) => Math.max(0, c - 1))
      }
      if (newStatus === 'flagged') {
        setFlaggedCount((c) => c + 1)
      }
      load(statusFilter, page)
    } catch (e: any) {
      setError(e.message || `Failed to ${newStatus} review`)
    }
  }

  if (role !== 'admin') return null

  const isExpanded = (id: string) => expandedId === id
  const toggleExpand = (id: string) => setExpandedId(expandedId === id ? null : id)

  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900 mb-4">Review Moderation</h2>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Status tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-200 overflow-x-auto">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setStatusFilter(tab.key)
              setPage(1)
              setExpandedId(null)
            }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition whitespace-nowrap ${
              statusFilter === tab.key
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
            {tab.key === 'pending' && pendingCount > 0 && (
              <span className="ml-2 px-1.5 py-0.5 text-xs font-bold bg-orange-100 text-orange-700 rounded-full">
                {pendingCount}
              </span>
            )}
            {tab.key === 'flagged' && flaggedCount > 0 && (
              <span className="ml-2 px-1.5 py-0.5 text-xs font-bold bg-amber-100 text-amber-700 rounded-full">
                {flaggedCount}
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
          <p className="text-lg font-medium">
            {statusFilter ? `No ${statusFilter} reviews` : 'No reviews'}
          </p>
          <p className="text-sm">
            {statusFilter === 'pending'
              ? 'All reviews are moderated!'
              : statusFilter
                ? `No reviews with status "${statusFilter}".`
                : 'No reviews found.'}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop table view */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <th className="py-3 pr-3">Nursery</th>
                  <th className="py-3 pr-3">Reviewer</th>
                  <th className="py-3 pr-3">Rating</th>
                  <th className="py-3 pr-3 max-w-xs">Review</th>
                  <th className="py-3 pr-3">Date</th>
                  <th className="py-3 pr-3">Status</th>
                  <th className="py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {reviews.map((r) => (
                  <tr key={r.id} className="group">
                    <td className="py-3 pr-3">
                      <Link
                        href={`/nursery/${r.urn}`}
                        className="font-medium text-indigo-600 hover:underline"
                      >
                        {r.nursery_name || r.urn}
                      </Link>
                    </td>
                    <td className="py-3 pr-3 text-gray-600">
                      {r.author_display_name || 'Anonymous'}
                    </td>
                    <td className="py-3 pr-3">
                      <Stars rating={r.rating} />
                    </td>
                    <td className="py-3 pr-3 max-w-xs">
                      <button
                        onClick={() => toggleExpand(r.id)}
                        className="text-left hover:text-indigo-600 transition"
                      >
                        <span className="font-medium text-gray-900">{r.title}</span>
                        <p className={`text-gray-600 mt-0.5 ${isExpanded(r.id) ? '' : 'line-clamp-2'}`}>
                          {r.body}
                        </p>
                        <span className="text-xs text-indigo-500 mt-1 inline-block">
                          {isExpanded(r.id) ? 'Show less' : 'Show more'}
                        </span>
                      </button>
                      {isExpanded(r.id) && r.admin_note && (
                        <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-600">
                          <span className="font-semibold">Admin note:</span> {r.admin_note}
                        </div>
                      )}
                    </td>
                    <td className="py-3 pr-3 text-gray-500 whitespace-nowrap">
                      {new Date(r.created_at).toLocaleDateString('en-GB')}
                    </td>
                    <td className="py-3 pr-3">
                      <span
                        className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-full capitalize ${
                          STATUS_BADGE[r.status] || 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {statusLabel(r.status)}
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="flex gap-1">
                        {(r.status === 'pending' || r.status === 'flagged') && (
                          <button
                            onClick={() => handleAction(r.id, 'approved')}
                            className="px-2 py-1 bg-green-600 text-white text-xs font-semibold rounded hover:bg-green-700 transition"
                          >
                            Approve
                          </button>
                        )}
                        {r.status !== 'flagged' && r.status !== 'rejected' && (
                          <button
                            onClick={() => handleAction(r.id, 'flagged')}
                            className="px-2 py-1 bg-amber-500 text-white text-xs font-semibold rounded hover:bg-amber-600 transition"
                          >
                            Flag
                          </button>
                        )}
                        {r.status !== 'rejected' && (
                          <button
                            onClick={() => handleAction(r.id, 'rejected')}
                            className="px-2 py-1 bg-red-600 text-white text-xs font-semibold rounded hover:bg-red-700 transition"
                          >
                            Reject
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card view */}
          <div className="lg:hidden space-y-3">
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
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 text-xs font-semibold rounded-full capitalize ${
                        STATUS_BADGE[r.status] || 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {statusLabel(r.status)}
                    </span>
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      {new Date(r.created_at).toLocaleDateString('en-GB')}
                    </span>
                  </div>
                </div>

                <div className="mb-2">
                  <Stars rating={r.rating} />
                  <span className="ml-2 text-sm font-medium text-gray-900">{r.title}</span>
                </div>

                <button
                  onClick={() => toggleExpand(r.id)}
                  className="text-left w-full"
                >
                  <p className={`text-sm text-gray-700 mb-1 ${isExpanded(r.id) ? '' : 'line-clamp-3'}`}>
                    {r.body}
                  </p>
                  <span className="text-xs text-indigo-500">
                    {isExpanded(r.id) ? 'Show less' : 'Show more'}
                  </span>
                </button>

                {isExpanded(r.id) && r.admin_note && (
                  <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-600">
                    <span className="font-semibold">Admin note:</span> {r.admin_note}
                  </div>
                )}

                {isExpanded(r.id) && (
                  <div className="mt-3 space-y-2">
                    <textarea
                      placeholder="Admin note (optional)"
                      value={adminNotes[r.id] || ''}
                      onChange={(e) =>
                        setAdminNotes((prev) => ({ ...prev, [r.id]: e.target.value }))
                      }
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                )}

                <div className="flex gap-2 mt-3">
                  {(r.status === 'pending' || r.status === 'flagged') && (
                    <button
                      onClick={() => handleAction(r.id, 'approved')}
                      className="px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 transition"
                    >
                      Approve
                    </button>
                  )}
                  {r.status !== 'flagged' && r.status !== 'rejected' && (
                    <button
                      onClick={() => handleAction(r.id, 'flagged')}
                      className="px-3 py-1.5 bg-amber-500 text-white text-xs font-semibold rounded-lg hover:bg-amber-600 transition"
                    >
                      Flag
                    </button>
                  )}
                  {r.status !== 'rejected' && (
                    <button
                      onClick={() => handleAction(r.id, 'rejected')}
                      className="px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 transition"
                    >
                      Reject
                    </button>
                  )}
                </div>
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
