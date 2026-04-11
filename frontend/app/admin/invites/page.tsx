'use client'

import { useEffect, useState } from 'react'
import { useSession } from '@/components/SessionProvider'
import { getAuthToken, adminFetch, API_URL } from '@/lib/api'
import ConfirmModal from '@/components/ConfirmModal'

interface InviteStats {
  total_invited: number
  opened: number
  clicked: number
  claimed: number
  conversion_rate: number
}

interface PreviewNursery {
  urn: string
  name: string
  email: string
  town: string | null
  postcode: string | null
  local_authority: string | null
  region: string | null
  ofsted_overall_grade: string | null
}

export default function AdminInvitesPage() {
  const { role } = useSession()
  const [stats, setStats] = useState<InviteStats | null>(null)
  const [preview, setPreview] = useState<PreviewNursery[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [region, setRegion] = useState('')
  const [localAuthority, setLocalAuthority] = useState('')
  const [limit, setLimit] = useState(50)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<{ sent: number; failed: number; skipped: number } | null>(null)
  const [error, setError] = useState('')

  // Load stats on mount
  useEffect(() => {
    if (role !== 'admin') return
    let cancelled = false
    ;(async () => {
      try {
        const token = await getAuthToken()
        if (!token) return
        const data = await adminFetch('/provider-invites/stats', token)
        if (!cancelled) setStats(data)
      } catch {
        // Stats may fail if table doesn't exist yet
      }
    })()
    return () => { cancelled = true }
  }, [role])

  async function handlePreview() {
    setLoading(true)
    setError('')
    setSendResult(null)
    try {
      const token = await getAuthToken()
      if (!token) throw new Error('No auth token')
      const body: any = { limit }
      if (region.trim()) body.region = region.trim()
      if (localAuthority.trim()) body.local_authority = localAuthority.trim()

      const res = await fetch(
        `${API_URL}/api/v1/admin/provider-invites/preview`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        }
      )
      if (!res.ok) throw new Error(`Preview failed: ${res.status}`)
      const data = await res.json()
      setPreview(data.data || [])
      setSelected(new Set((data.data || []).map((n: PreviewNursery) => n.urn)))
    } catch (err: any) {
      setError(err.message || 'Preview failed')
    } finally {
      setLoading(false)
    }
  }

  const [showSendConfirm, setShowSendConfirm] = useState(false)

  async function handleSend() {
    if (selected.size === 0) return
    setShowSendConfirm(true)
  }

  async function doSend() {
    setShowSendConfirm(false)
    setSending(true)
    setError('')
    setSendResult(null)
    try {
      const token = await getAuthToken()
      if (!token) throw new Error('No auth token')
      const res = await fetch(
        `${API_URL}/api/v1/admin/provider-invites/send`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ urns: Array.from(selected) }),
        }
      )
      if (!res.ok) throw new Error(`Send failed: ${res.status}`)
      const result = await res.json()
      setSendResult(result)
      // Refresh stats
      const statsData = await adminFetch('/provider-invites/stats', token)
      setStats(statsData)
      // Clear preview
      setPreview([])
      setSelected(new Set())
    } catch (err: any) {
      setError(err.message || 'Send failed')
    } finally {
      setSending(false)
    }
  }

  function toggleSelect(urn: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(urn)) next.delete(urn)
      else next.add(urn)
      return next
    })
  }

  function toggleAll() {
    if (selected.size === preview.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(preview.map((n) => n.urn)))
    }
  }

  if (role !== 'admin') return null

  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900 mb-4">Provider Invites</h2>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          <StatCard label="Total Sent" value={stats.total_invited} />
          <StatCard label="Opened" value={stats.opened} />
          <StatCard label="Clicked" value={stats.clicked} />
          <StatCard label="Claimed" value={stats.claimed} />
          <StatCard label="Conversion" value={`${stats.conversion_rate}%`} />
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {sendResult && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
          Invites sent: {sendResult.sent} | Failed: {sendResult.failed} | Skipped: {sendResult.skipped}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Filter unclaimed nurseries</h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Region</label>
            <input
              type="text"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="e.g. London"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Local Authority</label>
            <input
              type="text"
              value={localAuthority}
              onChange={(e) => setLocalAuthority(e.target.value)}
              placeholder="e.g. Camden"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Limit</label>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
              <option value={500}>500</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={handlePreview}
              disabled={loading}
              className="w-full px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Preview'}
            </button>
          </div>
        </div>
      </div>

      {/* Preview results */}
      {preview.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-6">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={selected.size === preview.length}
                onChange={toggleAll}
                className="rounded border-gray-300"
              />
              <span className="text-sm font-medium text-gray-700">
                {selected.size} of {preview.length} selected
              </span>
            </div>
            <button
              onClick={handleSend}
              disabled={sending || selected.size === 0}
              className="px-4 py-1.5 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition disabled:opacity-50"
            >
              {sending ? 'Sending...' : `Send ${selected.size} invites`}
            </button>
          </div>
          <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
            {preview.map((n) => (
              <div key={n.urn} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition">
                <input
                  type="checkbox"
                  checked={selected.has(n.urn)}
                  onChange={() => toggleSelect(n.urn)}
                  className="rounded border-gray-300"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{n.name}</p>
                  <p className="text-xs text-gray-400 truncate">
                    {n.email} {n.town ? `| ${n.town}` : ''} {n.postcode ? `| ${n.postcode}` : ''}
                  </p>
                </div>
                <div className="flex-shrink-0">
                  {n.ofsted_overall_grade && (
                    <span
                      className={`px-2 py-0.5 text-xs font-semibold rounded ${
                        n.ofsted_overall_grade === 'Outstanding'
                          ? 'bg-emerald-100 text-emerald-700'
                          : n.ofsted_overall_grade === 'Good'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {n.ofsted_overall_grade}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <ConfirmModal
        open={showSendConfirm}
        title="Send invite emails?"
        message={`Are you sure you want to send invite emails to ${selected.size} nurseries? This cannot be undone.`}
        confirmLabel="Send invites"
        variant="danger"
        onConfirm={doSend}
        onCancel={() => setShowSendConfirm(false)}
      />
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-xl font-bold text-gray-900">{value}</p>
    </div>
  )
}
