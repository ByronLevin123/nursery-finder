'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useSession } from '@/components/SessionProvider'
import { getAuthToken, adminFetch } from '@/lib/api'

interface ActivityRow {
  id: number
  user_id: string | null
  email: string | null
  display_name: string | null
  event: string
  target_urn: string | null
  metadata: Record<string, unknown>
  ip_hash: string | null
  created_at: string
}

interface Meta {
  total: number
  page: number
  limit: number
  pages: number
}

const EVENT_TYPES = [
  'search',
  'view',
  'compare',
  'enquiry',
  'booking',
  'waitlist_join',
  'review',
  'signup',
  'login',
]

const EVENT_COLORS: Record<string, string> = {
  search: 'bg-blue-100 text-blue-700',
  view: 'bg-gray-100 text-gray-700',
  compare: 'bg-purple-100 text-purple-700',
  enquiry: 'bg-green-100 text-green-700',
  booking: 'bg-emerald-100 text-emerald-700',
  waitlist_join: 'bg-amber-100 text-amber-700',
  review: 'bg-yellow-100 text-yellow-700',
  signup: 'bg-indigo-100 text-indigo-700',
  login: 'bg-slate-100 text-slate-700',
}

export default function AdminActivityPage() {
  const { role } = useSession()
  const [rows, setRows] = useState<ActivityRow[]>([])
  const [meta, setMeta] = useState<Meta>({ total: 0, page: 1, limit: 25, pages: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [eventFilter, setEventFilter] = useState('')
  const [userIdFilter, setUserIdFilter] = useState('')
  const [page, setPage] = useState(1)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(
    async (s: string, ev: string, uid: string, p: number) => {
      setLoading(true)
      setError('')
      try {
        const token = await getAuthToken()
        if (!token) throw new Error('No auth token')
        const params = new URLSearchParams({ page: String(p), limit: '25' })
        if (s) params.set('search', s)
        if (ev) params.set('event', ev)
        if (uid) params.set('user_id', uid)
        const data = await adminFetch(`/activity-log?${params}`, token)
        setRows(data.data || [])
        setMeta(data.meta || { total: 0, page: p, limit: 25, pages: 1 })
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load activity')
      } finally {
        setLoading(false)
      }
    },
    []
  )

  useEffect(() => {
    if (role !== 'admin') return
    load(search, eventFilter, userIdFilter, page)
  }, [role, eventFilter, userIdFilter, page]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (role !== 'admin') return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setPage(1)
      load(search, eventFilter, userIdFilter, 1)
    }, 400)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [search]) // eslint-disable-line react-hooks/exhaustive-deps

  function filterByUser(userId: string) {
    setUserIdFilter(userId)
    setPage(1)
  }

  function clearUserFilter() {
    setUserIdFilter('')
    setPage(1)
  }

  if (role !== 'admin') return null

  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900 mb-4">User Activity Log</h2>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="text"
          placeholder="Search by email or nursery URN..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
        <select
          value={eventFilter}
          onChange={(e) => {
            setEventFilter(e.target.value)
            setPage(1)
          }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All events</option>
          {EVENT_TYPES.map((ev) => (
            <option key={ev} value={ev}>
              {ev}
            </option>
          ))}
        </select>
      </div>

      {userIdFilter && (
        <div className="mb-4 flex items-center gap-2 text-sm">
          <span className="text-gray-500">Filtered to user:</span>
          <code className="bg-gray-100 px-2 py-0.5 rounded text-xs">{userIdFilter}</code>
          <button
            onClick={clearUserFilter}
            className="text-indigo-600 hover:underline text-xs"
          >
            Clear filter
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="bg-white border border-gray-200 rounded-lg p-4 animate-pulse"
            >
              <div className="h-4 w-48 bg-gray-200 rounded mb-2" />
              <div className="h-3 w-32 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg font-medium">No activity found</p>
          <p className="text-sm">Activity will appear here as users interact with the platform.</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr className="text-left text-xs uppercase text-gray-500">
                    <th className="px-4 py-3 font-semibold">Time</th>
                    <th className="px-4 py-3 font-semibold">User</th>
                    <th className="px-4 py-3 font-semibold">Event</th>
                    <th className="px-4 py-3 font-semibold">Target</th>
                    <th className="px-4 py-3 font-semibold">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                        {new Date(r.created_at).toLocaleString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-4 py-3">
                        {r.user_id ? (
                          <button
                            onClick={() => filterByUser(r.user_id!)}
                            className="text-indigo-600 hover:underline text-xs"
                            title="Filter to this user"
                          >
                            {r.email || r.display_name || r.user_id.slice(0, 8)}
                          </button>
                        ) : (
                          <span className="text-gray-400 text-xs">anonymous</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${EVENT_COLORS[r.event] || 'bg-gray-100 text-gray-700'}`}
                        >
                          {r.event}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs font-mono">
                        {r.target_urn || '--'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs max-w-[200px] truncate">
                        {r.metadata && Object.keys(r.metadata).length > 0
                          ? JSON.stringify(r.metadata)
                          : '--'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {rows.map((r) => (
              <div key={r.id} className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${EVENT_COLORS[r.event] || 'bg-gray-100 text-gray-700'}`}
                  >
                    {r.event}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(r.created_at).toLocaleString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                {r.user_id && (
                  <button
                    onClick={() => filterByUser(r.user_id!)}
                    className="text-indigo-600 hover:underline text-xs"
                  >
                    {r.email || r.display_name || r.user_id.slice(0, 8)}
                  </button>
                )}
                {r.target_urn && (
                  <p className="text-xs text-gray-500 font-mono mt-1">{r.target_urn}</p>
                )}
              </div>
            ))}
          </div>

          {/* Pagination */}
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
        </>
      )}
    </div>
  )
}
