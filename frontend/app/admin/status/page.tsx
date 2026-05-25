'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from '@/components/SessionProvider'
import { getAuthToken, API_URL } from '@/lib/api'

interface ServiceStatus {
  name: string
  category: string
  status: 'ok' | 'error' | 'unconfigured'
  latency_ms: number
  error?: string
  message?: string
  detail?: string
}

interface StatusResponse {
  timestamp: string
  summary: { total: number; ok: number; unconfigured: number; errors: number }
  services: ServiceStatus[]
}

const CATEGORY_LABELS: Record<string, string> = {
  core: 'Core Infrastructure',
  data: 'Data Sources',
  ai: 'AI Services',
  security: 'Security',
  monitoring: 'Monitoring',
  analytics: 'Analytics',
}

const CATEGORY_ORDER = ['core', 'data', 'ai', 'security', 'monitoring', 'analytics']

export default function AdminStatusPage() {
  const { role } = useSession()
  const [data, setData] = useState<StatusResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [countdown, setCountdown] = useState(60)

  const fetchStatus = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const token = await getAuthToken()
      if (!token) throw new Error('Not authenticated')
      const res = await fetch(`${API_URL}/api/v1/admin/status`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(`Failed: ${res.status}`)
      const json = await res.json()
      setData(json)
      setCountdown(60)
    } catch (err: any) {
      setError(err.message || 'Failed to fetch status')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (role !== 'admin') return
    fetchStatus()
  }, [role, fetchStatus])

  useEffect(() => {
    if (role !== 'admin') return
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchStatus()
          return 60
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [role, fetchStatus])

  if (role !== 'admin') return null

  const grouped = data
    ? CATEGORY_ORDER.reduce<Record<string, ServiceStatus[]>>((acc, cat) => {
        const services = data.services.filter((s) => s.category === cat)
        if (services.length > 0) acc[cat] = services
        return acc
      }, {})
    : {}

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Service Status</h2>
          {data && (
            <p className="text-xs text-gray-500 mt-1">
              Last checked: {new Date(data.timestamp).toLocaleTimeString()}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">Refresh in {countdown}s</span>
          <button
            onClick={fetchStatus}
            disabled={loading}
            className="px-3 py-1.5 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
          >
            {loading ? 'Checking...' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {data && (
        <div className={`mb-6 p-4 rounded-xl border ${
          data.summary.errors === 0
            ? 'bg-green-50 border-green-200'
            : data.summary.errors <= 2
              ? 'bg-amber-50 border-amber-200'
              : 'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${
              data.summary.errors === 0 ? 'bg-green-500' : data.summary.errors <= 2 ? 'bg-amber-500' : 'bg-red-500'
            }`} />
            <span className="font-semibold text-gray-900">
              {data.summary.errors === 0
                ? 'All systems operational'
                : `${data.summary.errors} service${data.summary.errors > 1 ? 's' : ''} down`}
            </span>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            {data.summary.ok} operational, {data.summary.unconfigured} unconfigured, {data.summary.errors} errors
          </p>
        </div>
      )}

      {Object.entries(grouped).map(([category, services]) => (
        <div key={category} className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
            {CATEGORY_LABELS[category] || category}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {services.map((s) => (
              <ServiceCard key={s.name} service={s} />
            ))}
          </div>
        </div>
      ))}

      {!data && !loading && !error && (
        <div className="text-center text-gray-400 py-12">Loading status...</div>
      )}
    </div>
  )
}

function ServiceCard({ service }: { service: ServiceStatus }) {
  const statusColors = {
    ok: 'bg-green-500',
    error: 'bg-red-500',
    unconfigured: 'bg-gray-400',
  }

  const bgColors = {
    ok: 'bg-white',
    error: 'bg-red-50',
    unconfigured: 'bg-gray-50',
  }

  return (
    <div className={`border border-gray-200 rounded-lg p-4 ${bgColors[service.status]}`}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${statusColors[service.status]}`} />
          <span className="text-sm font-medium text-gray-900">{service.name}</span>
        </div>
        {service.status === 'ok' && (
          <span className="text-xs text-gray-400">{service.latency_ms}ms</span>
        )}
      </div>
      {service.error && (
        <p className="text-xs text-red-600 mt-1 truncate" title={service.error}>{service.error}</p>
      )}
      {service.message && (
        <p className="text-xs text-gray-500 mt-1">{service.message}</p>
      )}
      {service.detail && service.status === 'ok' && (
        <p className="text-xs text-gray-500 mt-1">{service.detail}</p>
      )}
    </div>
  )
}
