'use client'

import { useEffect, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useSession } from '@/components/SessionProvider'
import { getAuthToken, adminFetch, API_URL } from '@/lib/api'

// Dynamically import recharts components (SSR disabled)
const RechartsCharts = dynamic(() => import('./ReportsCharts'), { ssr: false })

type Range = '30' | '90' | '180'

interface LatestStats {
  total_users: number
  new_users: number
  total_providers: number
  total_nurseries: number
  claimed_nurseries: number
  active_subscriptions: number
  mrr_gbp: number
  total_enquiries: number
  new_enquiries: number
}

interface TimeseriesPoint {
  date: string
  total_users: number
  mrr_gbp: number
  new_users?: number
}

interface ClaimPipeline {
  pending: number
  approved: number
  paying: number
}

interface ReportsData {
  latest: LatestStats
  timeseries: TimeseriesPoint[]
  claim_pipeline: ClaimPipeline
}

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 hover:shadow-md transition">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
          {icon}
        </div>
        <p className="text-sm font-medium text-gray-500">{label}</p>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  )
}

function PipelineCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`rounded-xl border-2 ${color} p-5 text-center`}>
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-sm font-medium mt-1">{label}</p>
    </div>
  )
}

export default function AdminReportsPage() {
  const { role } = useSession()
  const [data, setData] = useState<ReportsData | null>(null)
  const [range, setRange] = useState<Range>('90')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchReports = useCallback(async (r: Range) => {
    try {
      setLoading(true)
      setError(null)
      const token = await getAuthToken()
      if (!token) throw new Error('Not authenticated')
      const result = await adminFetch(`/reports?range=${r}`, token)
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reports')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (role === 'admin') {
      fetchReports(range)
    }
  }, [role, range, fetchReports])

  if (role !== 'admin') return null

  const handleExportCSV = async () => {
    try {
      const token = await getAuthToken()
      if (!token) return
      const res = await fetch(`${API_URL}/api/v1/admin/reports/export?range=${range}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `reports-${range}d-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch {
      alert('Failed to export CSV')
    }
  }

  const rangeOptions: { label: string; value: Range }[] = [
    { label: '30 days', value: '30' },
    { label: '90 days', value: '90' },
    { label: '180 days', value: '180' },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Platform Reports</h1>
          <p className="text-sm text-gray-500 mt-1">Overview of key business metrics</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Range selector */}
          <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1">
            {rangeOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setRange(opt.value)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition ${
                  range === opt.value
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {/* Export CSV */}
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export CSV
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
          {error}
        </div>
      )}

      {data && !loading && (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <StatCard
              label="Total Users"
              value={(data.latest?.total_users ?? 0).toLocaleString()}
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              }
            />
            <StatCard
              label="Total Providers"
              value={(data.latest?.total_providers ?? 0).toLocaleString()}
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              }
            />
            <StatCard
              label="MRR"
              value={`\u00A3${(data.latest?.mrr_gbp ?? 0).toLocaleString()}`}
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
            <StatCard
              label="Active Subscriptions"
              value={(data.latest?.active_subscriptions ?? 0).toLocaleString()}
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
            <StatCard
              label="Claimed Nurseries"
              value={(data.latest?.claimed_nurseries ?? 0).toLocaleString()}
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
              }
            />
          </div>

          {/* Charts */}
          <RechartsCharts timeseries={data.timeseries} />

          {/* Claim Pipeline */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Claim Pipeline</h2>
            <div className="grid grid-cols-3 gap-4">
              <PipelineCard
                label="Pending"
                value={data.claim_pipeline?.pending ?? 0}
                color="border-yellow-300 bg-yellow-50 text-yellow-800"
              />
              <PipelineCard
                label="Approved"
                value={data.claim_pipeline?.approved ?? 0}
                color="border-blue-300 bg-blue-50 text-blue-800"
              />
              <PipelineCard
                label="Paying"
                value={data.claim_pipeline?.paying ?? 0}
                color="border-green-300 bg-green-50 text-green-800"
              />
            </div>
            {/* Funnel connectors */}
            <div className="flex items-center justify-center gap-2 mt-3 text-xs text-gray-400">
              <span>Pending</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span>Approved</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span>Paying</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
