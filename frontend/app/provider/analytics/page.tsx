'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from '@/components/SessionProvider'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface NurseryStat {
  urn: string
  name: string
  view_count: number
  compare_count: number
  enquiries: { total: number; this_month: number; conversion: number }
  visits: { total: number; upcoming: number; completed: number }
  survey_avg: { overall: number | null; staff: number | null; facilities: number | null; count: number }
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

export default function ProviderAnalyticsPage() {
  const router = useRouter()
  const { session, loading: sessionLoading } = useSession()
  const [stats, setStats] = useState<NurseryStat[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (sessionLoading) return
    if (!session) { router.push('/login?next=/provider/analytics'); return }

    async function load() {
      try {
        const res = await fetch(`${API_URL}/api/v1/provider/analytics`, {
          headers: { Authorization: `Bearer ${session!.access_token}` },
        })
        if (!res.ok) throw new Error('Failed to load analytics')
        const data = await res.json()
        setStats(data.data || [])
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [session, sessionLoading, router])

  if (sessionLoading || loading) {
    return <div className="max-w-4xl mx-auto px-4 py-16 text-center text-gray-500">Loading...</div>
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Provider Analytics</h1>
      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 mb-4">{error}</div>}

      {stats.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">No nurseries to show analytics for.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {stats.map((n) => (
            <div key={n.urn} className="border border-gray-200 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">{n.name}</h2>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <StatCard label="Profile views" value={n.view_count} />
                <StatCard label="Comparisons" value={n.compare_count} />
                <StatCard label="Enquiries" value={n.enquiries.total} sub={`${n.enquiries.this_month} this month`} />
                <StatCard label="Response rate" value={`${n.enquiries.conversion}%`} sub="responded / total" />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <StatCard label="Visit bookings" value={n.visits.total} />
                <StatCard label="Upcoming visits" value={n.visits.upcoming} />
                <StatCard label="Completed visits" value={n.visits.completed} />
                <StatCard
                  label="Survey avg"
                  value={n.survey_avg.overall != null ? `${n.survey_avg.overall}/5` : '-'}
                  sub={n.survey_avg.count > 0 ? `${n.survey_avg.count} responses` : 'No surveys yet'}
                />
              </div>

              {n.survey_avg.count > 0 && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-2">Survey breakdown</p>
                  <div className="flex gap-6 text-sm">
                    <span>Overall: <strong>{n.survey_avg.overall ?? '-'}</strong>/5</span>
                    <span>Staff: <strong>{n.survey_avg.staff ?? '-'}</strong>/5</span>
                    <span>Facilities: <strong>{n.survey_avg.facilities ?? '-'}</strong>/5</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
