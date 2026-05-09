'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { API_URL, Nursery, getSubscription, type SubscriptionInfo } from '@/lib/api'

interface Analytics {
  nurseries?: Array<{
    urn: string
    view_count: number
    compare_count: number
    enquiries: { total: number; this_month: number; conversion: number }
    visits: { total: number; upcoming: number; completed: number }
  }>
}

function computeCompleteness(n: Nursery): { pct: number; missing: string[] } {
  const checks: [boolean, string][] = [
    [!!n.description, 'Description'],
    [!!((n as any).photos?.length > 0), 'Photos'],
    [!!(n as any).opening_hours, 'Opening hours'],
    [!!(n.contact_email || (n as any).contact_phone), 'Contact info'],
    [!!(n as any).website_url, 'Website'],
    [n.spots_available != null, 'Availability'],
    [n.fee_avg_monthly != null && n.fee_avg_monthly > 0, 'Fees'],
  ]
  const done = checks.filter(([ok]) => ok).length
  const missing = checks.filter(([ok]) => !ok).map(([, label]) => label)
  return { pct: Math.round((done / checks.length) * 100), missing }
}

export default function ProviderDashboard() {
  const router = useRouter()
  const [nurseries, setNurseries] = useState<Nursery[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [providerTier, setProviderTier] = useState<string>('free')
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [unansweredCount, setUnansweredCount] = useState(0)

  useEffect(() => {
    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login?next=/provider')
        return
      }
      const token = session.access_token
      try {
        const [subRes, nurseryRes, analyticsRes, enquiriesRes] = await Promise.all([
          getSubscription(token).catch(() => null),
          fetch(`${API_URL}/api/v1/provider/nurseries`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_URL}/api/v1/provider/analytics`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
          fetch(`${API_URL}/api/v1/provider/enquiries`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
        ])
        if (subRes?.provider?.tier) setProviderTier(subRes.provider.tier)
        if (!nurseryRes.ok) throw new Error('failed')
        const j = await nurseryRes.json()
        setNurseries(j.data || [])

        if (analyticsRes?.ok) {
          const a = await analyticsRes.json()
          setAnalytics(a)
        }
        if (enquiriesRes?.ok) {
          const e = await enquiriesRes.json()
          const unanswered = (e.data || []).filter((eq: any) => eq.status === 'sent' || eq.status === 'opened')
          setUnansweredCount(unanswered.length)
        }
      } catch {
        setError('Could not load your nurseries')
      }
      setLoading(false)
    }
    load()
  }, [router])

  const totalViews = analytics?.nurseries?.reduce((s, n) => s + (n.view_count || 0), 0) ?? 0
  const totalEnquiriesMonth = analytics?.nurseries?.reduce((s, n) => s + (n.enquiries?.this_month || 0), 0) ?? 0
  const responseRates = analytics?.nurseries?.filter(n => n.enquiries?.total > 0).map(n => n.enquiries.conversion) ?? []
  const avgResponseRate = responseRates.length > 0 ? Math.round(responseRates.reduce((a, b) => a + b, 0) / responseRates.length) : null
  const upcomingVisits = analytics?.nurseries?.reduce((s, n) => s + (n.visits?.upcoming || 0), 0) ?? 0

  if (loading) {
    return <div className="max-w-3xl mx-auto px-4 py-16 text-center text-gray-500">Loading...</div>
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Provider dashboard</h1>

      {providerTier === 'free' && (
        <div className="mb-6 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl flex items-center justify-between">
          <p className="text-sm text-indigo-800">
            Upgrade to Pro for featured listings and priority search placement
          </p>
          <Link
            href="/pricing"
            className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 whitespace-nowrap ml-4"
          >
            See plans &rarr;
          </Link>
        </div>
      )}

      {error && <p className="text-red-500 mb-4">{error}</p>}

      {/* Metrics cards */}
      {nurseries.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{totalViews}</p>
            <p className="text-xs text-gray-500">Profile views</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{totalEnquiriesMonth}</p>
            <p className="text-xs text-gray-500">Enquiries this month</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{avgResponseRate != null ? `${avgResponseRate}%` : '--'}</p>
            <p className="text-xs text-gray-500">Response rate</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{upcomingVisits}</p>
            <p className="text-xs text-gray-500">Upcoming visits</p>
          </div>
        </div>
      )}

      {/* Action items */}
      {(unansweredCount > 0 || nurseries.some(n => computeCompleteness(n).pct < 100)) && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm font-semibold text-amber-900 mb-2">Action needed</p>
          <ul className="space-y-1">
            {unansweredCount > 0 && (
              <li>
                <Link href="/provider/enquiries" className="text-sm text-amber-800 hover:underline">
                  {unansweredCount} unanswered {unansweredCount === 1 ? 'enquiry' : 'enquiries'}
                </Link>
              </li>
            )}
            {nurseries.filter(n => computeCompleteness(n).pct < 100).map(n => {
              const c = computeCompleteness(n)
              return (
                <li key={n.urn}>
                  <Link href={`/provider/${n.urn}/edit`} className="text-sm text-amber-800 hover:underline">
                    {n.name}: profile {c.pct}% complete — add {c.missing.slice(0, 2).join(', ')}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* Quick links */}
      <div className="flex flex-wrap gap-3 mb-6">
        <Link href="/provider/onboarding" className="text-sm px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100">
          Complete your profile
        </Link>
        <Link href="/provider/enquiries" className="text-sm px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100">
          Enquiry inbox{unansweredCount > 0 && ` (${unansweredCount})`}
        </Link>
        <Link href="/provider/analytics" className="text-sm px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100">
          Analytics
        </Link>
      </div>

      {nurseries.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center text-gray-600">
          No claimed nurseries yet — visit a nursery page and click &quot;Claim this nursery&quot;.
        </div>
      ) : (
        <ul className="space-y-3">
          {nurseries.map((n) => {
            const c = computeCompleteness(n)
            return (
              <li
                key={n.urn}
                className="bg-white border border-gray-200 rounded-lg p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-semibold">{n.name}</p>
                    <p className="text-sm text-gray-500">{n.town}</p>
                  </div>
                  <div className="flex gap-3">
                    <Link
                      href={`/provider/${n.urn}/edit`}
                      className="text-sm text-blue-600 font-medium hover:underline"
                    >
                      Edit listing
                    </Link>
                    <Link
                      href={`/provider/${n.urn}/slots`}
                      className="text-sm text-purple-600 font-medium hover:underline"
                    >
                      Visit slots
                    </Link>
                  </div>
                </div>
                {/* Profile completeness bar */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${c.pct === 100 ? 'bg-green-500' : c.pct >= 60 ? 'bg-blue-500' : 'bg-amber-500'}`}
                      style={{ width: `${c.pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 whitespace-nowrap">{c.pct}% complete</span>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
