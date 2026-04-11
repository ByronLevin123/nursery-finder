'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from '@/components/SessionProvider'
import { getAuthToken, API_URL } from '@/lib/api'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface ReportSummary {
  views: number
  enquiries: number
  compares: number
  shortlists: number
}

interface TimeseriesPoint {
  date: string
  views: number
  enquiries: number
  compares: number
  shortlists: number
}

interface ReportData {
  summary: ReportSummary
  timeseries: TimeseriesPoint[]
  conversion_rate: number
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <p className="text-xs text-gray-500 uppercase font-medium mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

function groupByWeek(timeseries: TimeseriesPoint[]): { week: string; views: number }[] {
  const weeks: Record<string, number> = {}
  for (const point of timeseries) {
    const d = new Date(point.date)
    const weekStart = new Date(d)
    weekStart.setDate(d.getDate() - d.getDay())
    const key = weekStart.toISOString().slice(0, 10)
    weeks[key] = (weeks[key] || 0) + point.views
  }
  return Object.entries(weeks)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, views]) => ({ week, views }))
}

export default function ProviderReportsPage() {
  const router = useRouter()
  const { session, loading: sessionLoading } = useSession()
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [range, setRange] = useState<30 | 90>(30)
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (sessionLoading) return
    if (!session) {
      router.push('/login?next=/provider/reports')
      return
    }

    async function load() {
      try {
        setLoading(true)
        const res = await fetch(`${API_URL}/api/v1/provider/reports?range=${range}`, {
          headers: { Authorization: `Bearer ${session!.access_token}` },
        })
        if (!res.ok) throw new Error('Failed to load reports')
        const json = await res.json()
        setData(json)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [session, sessionLoading, router, range])

  async function handleExport() {
    try {
      const token = await getAuthToken()
      if (!token) return
      window.open(`${API_URL}/api/v1/provider/reports/export?range=${range}&token=${token}`)
    } catch {
      // silent fail on export
    }
  }

  if (sessionLoading || loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded-lg" />
            ))}
          </div>
          <div className="h-64 bg-gray-200 rounded-lg" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">{error}</div>
      </div>
    )
  }

  if (!data) return null

  const weeklyViews = groupByWeek(data.timeseries)

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <div className="flex items-center gap-3">
          <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
            <button
              onClick={() => setRange(30)}
              className={`px-3 py-1.5 text-sm font-medium ${
                range === 30
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              30 days
            </button>
            <button
              onClick={() => setRange(90)}
              className={`px-3 py-1.5 text-sm font-medium ${
                range === 90
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              90 days
            </button>
          </div>
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17v3a2 2 0 002 2h14a2 2 0 002-2v-3" />
            </svg>
            Export CSV
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Views" value={data.summary.views.toLocaleString()} />
        <StatCard label="Total Enquiries" value={data.summary.enquiries.toLocaleString()} />
        <StatCard label="Total Compares" value={data.summary.compares.toLocaleString()} />
        <StatCard
          label="Conversion Rate"
          value={`${data.conversion_rate.toFixed(1)}%`}
          sub="Enquiries / Views"
        />
      </div>

      {/* Enquiry Trends Line Chart */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Enquiry Trends</h2>
        {isClient && data.timeseries.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data.timeseries}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                tickFormatter={(d: string) => {
                  const date = new Date(d)
                  return `${date.getDate()}/${date.getMonth() + 1}`
                }}
              />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip
                labelFormatter={(d) => new Date(String(d)).toLocaleDateString('en-GB')}
              />
              <Line
                type="monotone"
                dataKey="enquiries"
                stroke="#4f46e5"
                strokeWidth={2}
                dot={false}
                name="Enquiries"
              />
              <Line
                type="monotone"
                dataKey="compares"
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
                name="Compares"
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[300px] flex items-center justify-center text-gray-400 text-sm">
            No data available for this period
          </div>
        )}
      </div>

      {/* Profile Views Bar Chart */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Profile Views by Week</h2>
        {isClient && weeklyViews.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={weeklyViews}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="week"
                tick={{ fontSize: 12 }}
                tickFormatter={(d: string) => {
                  const date = new Date(d)
                  return `${date.getDate()}/${date.getMonth() + 1}`
                }}
              />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip
                labelFormatter={(d) => `Week of ${new Date(String(d)).toLocaleDateString('en-GB')}`}
              />
              <Bar dataKey="views" fill="#4f46e5" radius={[4, 4, 0, 0]} name="Views" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[300px] flex items-center justify-center text-gray-400 text-sm">
            No data available for this period
          </div>
        )}
      </div>
    </div>
  )
}
