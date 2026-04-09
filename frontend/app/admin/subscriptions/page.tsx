'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from '@/components/SessionProvider'
import { getAuthToken, adminFetch } from '@/lib/api'

interface AdminSubscription {
  id: string
  user_email: string
  type: 'provider' | 'parent'
  tier: string
  status: string
  current_period_end: string | null
}

interface Meta {
  total: number
  page: number
  limit: number
  pages: number
}

function TierBadge({ tier }: { tier: string }) {
  const colours: Record<string, string> = {
    free: 'bg-gray-100 text-gray-600',
    pro: 'bg-blue-100 text-blue-700',
    premium: 'bg-purple-100 text-purple-700',
  }
  return (
    <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-full capitalize ${colours[tier] || 'bg-gray-100 text-gray-600'}`}>
      {tier}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colours: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    canceled: 'bg-red-100 text-red-600',
    past_due: 'bg-amber-100 text-amber-700',
    trialing: 'bg-blue-100 text-blue-600',
  }
  return (
    <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-full ${colours[status] || 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  )
}

export default function AdminSubscriptionsPage() {
  const { role } = useSession()
  const [subscriptions, setSubscriptions] = useState<AdminSubscription[]>([])
  const [meta, setMeta] = useState<Meta>({ total: 0, page: 1, limit: 25, pages: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [summary, setSummary] = useState<{ pro: number; premium: number; mrr: number } | null>(null)

  const load = useCallback(async (p: number) => {
    setLoading(true)
    setError('')
    try {
      const token = await getAuthToken()
      if (!token) throw new Error('No auth token')
      const params = new URLSearchParams({ page: String(p), limit: '25' })
      const data = await adminFetch(`/subscriptions?${params}`, token)
      setSubscriptions(data.data || [])
      setMeta(data.meta || { total: 0, page: p, limit: 25, pages: 1 })
    } catch (e: any) {
      setError(e.message || 'Failed to load subscriptions')
    } finally {
      setLoading(false)
    }
  }, [])

  // Compute summary from stats endpoint
  useEffect(() => {
    if (role !== 'admin') return
    ;(async () => {
      try {
        const token = await getAuthToken()
        if (!token) return
        const stats = await adminFetch('/stats', token)
        const pro = (stats.subscriptions?.pro ?? 0)
        const premium = (stats.subscriptions?.premium ?? 0)
        const mrr = stats.mrr ?? 0
        setSummary({ pro, premium, mrr })
      } catch {}
    })()
  }, [role])

  useEffect(() => {
    if (role !== 'admin') return
    load(page)
  }, [role, page, load])

  if (role !== 'admin') return null

  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900 mb-4">Subscriptions</h2>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{summary.pro}</p>
            <p className="text-xs text-gray-500 font-medium">Pro subscribers</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-purple-600">{summary.premium}</p>
            <p className="text-xs text-gray-500 font-medium">Premium subscribers</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{'\u00A3'}{summary.mrr.toLocaleString()}</p>
            <p className="text-xs text-gray-500 font-medium">MRR</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-lg p-4 animate-pulse">
              <div className="h-4 w-48 bg-gray-200 rounded mb-2" />
              <div className="h-3 w-32 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      ) : subscriptions.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg font-medium">No subscriptions</p>
          <p className="text-sm">Active subscriptions will appear here.</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr className="text-left text-xs uppercase text-gray-500">
                    <th className="px-4 py-3 font-semibold">User Email</th>
                    <th className="px-4 py-3 font-semibold">Type</th>
                    <th className="px-4 py-3 font-semibold">Tier</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Period End</th>
                  </tr>
                </thead>
                <tbody>
                  {subscriptions.map((s, i) => (
                    <tr key={s.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-3 font-medium text-gray-900">{s.user_email}</td>
                      <td className="px-4 py-3 text-gray-600 capitalize">{s.type}</td>
                      <td className="px-4 py-3"><TierBadge tier={s.tier} /></td>
                      <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                      <td className="px-4 py-3 text-gray-500">
                        {s.current_period_end
                          ? new Date(s.current_period_end).toLocaleDateString('en-GB')
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
            {subscriptions.map((s) => (
              <div key={s.id} className="bg-white border border-gray-200 rounded-lg p-4">
                <p className="font-medium text-gray-900 text-sm">{s.user_email}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-gray-500 capitalize">{s.type}</span>
                  <TierBadge tier={s.tier} />
                  <StatusBadge status={s.status} />
                </div>
                {s.current_period_end && (
                  <p className="text-xs text-gray-400 mt-1">
                    Ends {new Date(s.current_period_end).toLocaleDateString('en-GB')}
                  </p>
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
