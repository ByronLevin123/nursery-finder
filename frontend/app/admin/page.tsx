'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from '@/components/SessionProvider'
import {
  getAuthToken,
  API_URL,
  adminFetch,
  getAdminGrowthStats,
  getAdminDataQuality,
  getAdminActivity,
  AdminGrowthStats,
  AdminDataQuality,
  AdminActivityItem,
} from '@/lib/api'

interface AdminStats {
  users: { total: number; customers: number; providers: number; admins: number }
  nurseries: { total: number; claimed: number; featured?: number }
  claims: { pending: number; approved: number; rejected: number }
  reviews: { pending: number; approved: number; flagged: number; rejected?: number }
  subscriptions?: { provider_pro: number; provider_premium: number; parent_premium: number; mrr_gbp: number }
  enquiries?: { total: number; this_month: number }
  mrr: number
  enquiries_this_month: number
}

function StatCard({
  label,
  value,
  sub,
  badge,
  href,
  icon,
}: {
  label: string
  value: string | number
  sub?: string
  badge?: number
  href?: string
  icon: React.ReactNode
}) {
  const card = (
    <div className="relative bg-white border border-gray-200 rounded-xl shadow-sm p-5 hover:shadow-md transition">
      {badge != null && badge > 0 && (
        <span className="absolute top-3 right-3 px-2 py-0.5 text-xs font-bold bg-orange-100 text-orange-700 rounded-full">
          {badge}
        </span>
      )}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
          {icon}
        </div>
        <p className="text-sm font-medium text-gray-500">{label}</p>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  )
  if (href) return <Link href={href}>{card}</Link>
  return card
}

function SkeletonCard() {
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 animate-pulse">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-lg bg-gray-200" />
        <div className="h-4 w-24 bg-gray-200 rounded" />
      </div>
      <div className="h-7 w-16 bg-gray-200 rounded mb-1" />
      <div className="h-3 w-32 bg-gray-100 rounded" />
    </div>
  )
}

function GrowthCard({
  label,
  weekCount,
  monthCount,
  icon,
}: {
  label: string
  weekCount: number
  monthCount: number
  icon: React.ReactNode
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
          {icon}
        </div>
        <p className="text-sm font-medium text-gray-500">{label}</p>
      </div>
      <p className="text-2xl font-bold text-gray-900">+{weekCount}</p>
      <p className="text-xs text-gray-500 mt-1">this week / +{monthCount} this month</p>
    </div>
  )
}

function DataQualityCard({
  label,
  count,
  severity,
  description,
}: {
  label: string
  count: number
  severity: 'red' | 'amber'
  description: string
}) {
  const isRed = severity === 'red'
  return (
    <div
      className={`border rounded-xl p-4 ${
        isRed
          ? 'bg-red-50 border-red-200'
          : 'bg-amber-50 border-amber-200'
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <p className={`text-sm font-semibold ${isRed ? 'text-red-800' : 'text-amber-800'}`}>
          {label}
        </p>
        <span
          className={`text-lg font-bold ${isRed ? 'text-red-700' : 'text-amber-700'}`}
        >
          {(count ?? 0).toLocaleString()}
        </span>
      </div>
      <p className={`text-xs ${isRed ? 'text-red-600' : 'text-amber-600'}`}>{description}</p>
    </div>
  )
}

function ActivityFeed({ items }: { items: AdminActivityItem[] }) {
  function typeIcon(type: string) {
    if (type === 'review') return <StarIcon />
    if (type === 'claim') return <ClipboardIcon />
    return <UsersIcon />
  }
  function typeBg(type: string) {
    if (type === 'review') return 'bg-yellow-50 text-yellow-600'
    if (type === 'claim') return 'bg-indigo-50 text-indigo-600'
    return 'bg-emerald-50 text-emerald-600'
  }
  function formatDate(dateStr: string) {
    const d = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return 'just now'
    if (diffMin < 60) return `${diffMin}m ago`
    const diffHr = Math.floor(diffMin / 60)
    if (diffHr < 24) return `${diffHr}h ago`
    const diffDay = Math.floor(diffHr / 24)
    if (diffDay < 7) return `${diffDay}d ago`
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }

  if (items.length === 0) {
    return <p className="text-sm text-gray-500">No recent activity.</p>
  }

  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={`${item.type}-${i}`} className="flex items-start gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${typeBg(item.type)}`}>
            {typeIcon(item.type)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-800 leading-snug">{item.description}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-gray-400">{formatDate(item.date)}</span>
              {item.status && (
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                  item.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                  item.status === 'published' || item.status === 'approved' ? 'bg-green-100 text-green-700' :
                  item.status === 'flagged' ? 'bg-red-100 text-red-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {item.status}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function AdminOverview() {
  const { role } = useSession()
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [growth, setGrowth] = useState<AdminGrowthStats | null>(null)
  const [quality, setQuality] = useState<AdminDataQuality | null>(null)
  const [activity, setActivity] = useState<AdminActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (role !== 'admin') return
    let cancelled = false
    ;(async () => {
      try {
        const token = await getAuthToken()
        if (!token) throw new Error('No auth token')
        const [statsData, growthData, qualityData, activityData] = await Promise.all([
          adminFetch('/stats', token),
          getAdminGrowthStats(token).catch(() => null),
          getAdminDataQuality(token).catch(() => null),
          getAdminActivity(token, 50).catch(() => []),
        ])
        if (!cancelled) {
          // Map API response to expected shape — fill in derived top-level fields
          const mapped = {
            ...statsData,
            mrr: statsData?.subscriptions?.mrr_gbp ?? statsData?.mrr ?? 0,
            enquiries_this_month: statsData?.enquiries?.this_month ?? statsData?.enquiries_this_month ?? 0,
          }
          setStats(mapped)
          setGrowth(growthData)
          setQuality(qualityData)
          setActivity(activityData)
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Failed to load stats')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [role])

  if (role !== 'admin') return null

  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900 mb-4">Overview</h2>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Growth stat cards */}
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Growth This Week</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : growth ? (
          <>
            <GrowthCard
              label="New Nurseries"
              weekCount={growth.nurseries.this_week}
              monthCount={growth.nurseries.this_month}
              icon={<BuildingIcon />}
            />
            <GrowthCard
              label="New Signups"
              weekCount={growth.users.this_week}
              monthCount={growth.users.this_month}
              icon={<UsersIcon />}
            />
            <GrowthCard
              label="New Reviews"
              weekCount={growth.reviews.this_week}
              monthCount={growth.reviews.this_month}
              icon={<StarIcon />}
            />
            <GrowthCard
              label="New Claims"
              weekCount={growth.claims.this_week}
              monthCount={growth.claims.this_month}
              icon={<ClipboardIcon />}
            />
          </>
        ) : null}
      </div>

      {/* Data quality warnings */}
      {quality && (quality.nurseries_no_location > 0 || quality.nurseries_no_grade > 0 || quality.nurseries_stale_inspection > 0 || quality.reviews_pending_moderation > 0) && (
        <>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Data Quality Warnings</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            {quality.nurseries_no_location > 0 && (
              <DataQualityCard
                label="No Location"
                count={quality.nurseries_no_location}
                severity="red"
                description="Nurseries missing lat/lng — will not appear in map search"
              />
            )}
            {quality.nurseries_no_grade > 0 && (
              <DataQualityCard
                label="No Ofsted Grade"
                count={quality.nurseries_no_grade}
                severity="amber"
                description="Nurseries without an Ofsted overall grade"
              />
            )}
            {quality.nurseries_stale_inspection > 0 && (
              <DataQualityCard
                label="Stale Inspections"
                count={quality.nurseries_stale_inspection}
                severity="amber"
                description="Last inspected more than 4 years ago"
              />
            )}
            {quality.reviews_pending_moderation > 0 && (
              <DataQualityCard
                label="Reviews Pending"
                count={quality.reviews_pending_moderation}
                severity="red"
                description="Reviews awaiting moderation"
              />
            )}
          </div>
        </>
      )}

      {/* Existing stat cards */}
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Platform Totals</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
        ) : stats ? (
          <>
            <StatCard
              label="Total Users"
              value={(stats.users.total ?? 0).toLocaleString()}
              sub={`${stats.users.customers} customers, ${stats.users.providers} providers, ${stats.users.admins} admins`}
              icon={<UsersIcon />}
            />
            <StatCard
              label="Total Nurseries"
              value={(stats.nurseries.total ?? 0).toLocaleString()}
              sub={`${stats.nurseries.claimed} claimed`}
              icon={<BuildingIcon />}
            />
            <StatCard
              label="Pending Claims"
              value={stats.claims.pending}
              badge={stats.claims.pending}
              href="/admin/claims"
              icon={<ClipboardIcon />}
            />
            <StatCard
              label="Pending Reviews"
              value={stats.reviews.pending}
              badge={stats.reviews.pending}
              href="/admin/reviews"
              icon={<StarIcon />}
            />
            <StatCard
              label="MRR"
              value={`\u00A3${(stats.mrr ?? 0).toLocaleString()}`}
              sub="Monthly Recurring Revenue"
              icon={<CurrencyIcon />}
            />
            <StatCard
              label="Enquiries This Month"
              value={stats.enquiries_this_month}
              icon={<EnvelopeIcon />}
            />
            <StatCard
              label="Claim Rate"
              value={
                stats.nurseries.total > 0
                  ? `${((stats.nurseries.claimed / stats.nurseries.total) * 100).toFixed(1)}%`
                  : '0%'
              }
              sub={`${stats.nurseries.claimed} claimed of ${(stats.nurseries.total ?? 0).toLocaleString()}`}
              href="/admin/invites"
              icon={<ClipboardIcon />}
            />
          </>
        ) : null}
      </div>

      {/* Recent activity feed */}
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Recent Activity</h3>
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 mb-8 max-h-[500px] overflow-y-auto">
        {loading ? (
          <div className="space-y-3 animate-pulse">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-200 flex-shrink-0" />
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-1" />
                  <div className="h-3 bg-gray-100 rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <ActivityFeed items={activity} />
        )}
      </div>

      {/* Quick actions */}
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Quick Actions</h3>
      <div className="flex flex-wrap gap-3 mb-8">
        <Link
          href="/admin/claims"
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition"
        >
          Review Claims
        </Link>
        <Link
          href="/admin/reviews"
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition"
        >
          Moderate Reviews
        </Link>
        <Link
          href="/admin/invites"
          className="px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition"
        >
          Provider Invites
        </Link>
      </div>

      {/* Data ingest panel */}
      <IngestPanel />
    </div>
  )
}

const INGEST_STEPS = [
  { id: 'ofsted', label: 'Ofsted Import', desc: 'Download and import the full Ofsted CSV (~27k nurseries)', path: '/api/v1/ingest/ofsted' },
  { id: 'geocode', label: 'Geocode Nurseries', desc: 'Geocode up to 2000 nurseries via Postcodes.io', path: '/api/v1/ingest/geocode?limit=2000' },
  { id: 'aggregate', label: 'Aggregate Areas', desc: 'Recompute nursery stats per postcode district', path: '/api/v1/ingest/aggregate-areas' },
  { id: 'family', label: 'Family Scores', desc: 'Recompute family scores for all districts', path: '/api/v1/ingest/family-scores' },
  { id: 'crime', label: 'Crime Data', desc: 'Import police crime data', path: '/api/v1/ingest/crime' },
  { id: 'imd', label: 'IMD Data', desc: 'Import deprivation index data', path: '/api/v1/ingest/imd' },
  { id: 'schools', label: 'Schools', desc: 'Import school data from CSV', path: '/api/v1/ingest/schools' },
  { id: 'snapshot', label: 'Snapshot Reports', desc: 'Capture today\'s metrics for the reports timeseries', path: '/api/v1/admin/reports/snapshot' },
]

function IngestPanel() {
  const [running, setRunning] = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, { ok: boolean; data?: any; error?: string }>>({})

  async function runStep(step: typeof INGEST_STEPS[0]) {
    const token = await getAuthToken()
    if (!token) return
    setRunning(step.id)
    setResults((prev) => ({ ...prev, [step.id]: undefined as any }))
    try {
      const res = await fetch(`${API_URL}${step.path}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `Failed (${res.status})`)
      setResults((prev) => ({ ...prev, [step.id]: { ok: true, data } }))
    } catch (err: unknown) {
      setResults((prev) => ({ ...prev, [step.id]: { ok: false, error: err instanceof Error ? err.message : 'Failed' } }))
    } finally {
      setRunning(null)
    }
  }

  return (
    <>
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Data Ingest</h3>
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 mb-8">
        <p className="text-xs text-gray-500 mb-4">Run data pipelines manually. Ofsted import can take 10-30 minutes. Run steps in order for first-time setup.</p>
        <div className="space-y-3">
          {INGEST_STEPS.map((step) => {
            const result = results[step.id]
            return (
              <div key={step.id} className="flex items-center justify-between gap-4 py-2 border-b border-gray-100 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{step.label}</p>
                  <p className="text-xs text-gray-500 truncate">{step.desc}</p>
                  {result?.ok && (
                    <p className="text-xs text-green-600 mt-1">
                      Done: {JSON.stringify(result.data).slice(0, 120)}
                    </p>
                  )}
                  {result && !result.ok && (
                    <p className="text-xs text-red-600 mt-1">{result.error}</p>
                  )}
                </div>
                <button
                  onClick={() => runStep(step)}
                  disabled={running !== null}
                  className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition ${
                    running === step.id
                      ? 'bg-amber-100 text-amber-700 cursor-wait'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50'
                  }`}
                >
                  {running === step.id ? 'Running...' : 'Run'}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

/* Inline SVG icons (heroicons mini) */
function UsersIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path d="M7 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM14.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM1.615 16.428a1.224 1.224 0 0 1-.569-1.175 6.002 6.002 0 0 1 11.908 0c.058.467-.172.92-.57 1.174A9.953 9.953 0 0 1 7 18a9.953 9.953 0 0 1-5.385-1.572ZM14.5 16h-.106c.07-.297.088-.611.048-.933a7.47 7.47 0 0 0-1.588-3.755 4.502 4.502 0 0 1 5.874 2.636.818.818 0 0 1-.36.98A7.465 7.465 0 0 1 14.5 16Z" />
    </svg>
  )
}
function BuildingIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path fillRule="evenodd" d="M4 16.5v-13h-.25a.75.75 0 0 1 0-1.5h12.5a.75.75 0 0 1 0 1.5H16v13h.25a.75.75 0 0 1 0 1.5H3.75a.75.75 0 0 1 0-1.5H4Zm3-11a.75.75 0 0 1 .75-.75h.5a.75.75 0 0 1 0 1.5h-.5A.75.75 0 0 1 7 5.5Zm.75 2.25a.75.75 0 0 0 0 1.5h.5a.75.75 0 0 0 0-1.5h-.5ZM7 11a.75.75 0 0 1 .75-.75h.5a.75.75 0 0 1 0 1.5h-.5A.75.75 0 0 1 7 11Zm4-5.5a.75.75 0 0 1 .75-.75h.5a.75.75 0 0 1 0 1.5h-.5A.75.75 0 0 1 11 5.5Zm.75 2.25a.75.75 0 0 0 0 1.5h.5a.75.75 0 0 0 0-1.5h-.5ZM11 11a.75.75 0 0 1 .75-.75h.5a.75.75 0 0 1 0 1.5h-.5A.75.75 0 0 1 11 11Zm-2 3.25a.75.75 0 0 0-1.5 0V17h1.5v-2.75Z" clipRule="evenodd" />
    </svg>
  )
}
function ClipboardIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path fillRule="evenodd" d="M15.988 3.012A2.25 2.25 0 0 1 18 5.25v6.5A2.25 2.25 0 0 1 15.75 14H13.5V7A2.5 2.5 0 0 0 11 4.5H8.128a2.252 2.252 0 0 1 1.884-1.488A2.25 2.25 0 0 1 12.25 1h1.5a2.25 2.25 0 0 1 2.238 2.012ZM11.5 3.25a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 .75.75v.25h-3v-.25Z" clipRule="evenodd" />
      <path fillRule="evenodd" d="M2 7a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V7Zm2 3.25a.75.75 0 0 1 .75-.75h4.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1-.75-.75Zm0 3.5a.75.75 0 0 1 .75-.75h4.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1-.75-.75Z" clipRule="evenodd" />
    </svg>
  )
}
function StarIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path fillRule="evenodd" d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401Z" clipRule="evenodd" />
    </svg>
  )
}
function CurrencyIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.732 6.232a2.5 2.5 0 0 1 3.536 0 .75.75 0 1 0 1.06-1.06A4 4 0 0 0 6.5 8H6a.75.75 0 0 0 0 1.5h.25v1H6a.75.75 0 0 0 0 1.5h.5a4 4 0 0 0 6.828 2.328.75.75 0 1 0-1.06-1.06 2.5 2.5 0 0 1-3.536 0A2.502 2.502 0 0 1 7.058 12H9a.75.75 0 0 0 0-1.5H7v-1h2A.75.75 0 0 0 9 8H7.058a2.5 2.5 0 0 1 1.674-1.768Z" clipRule="evenodd" />
    </svg>
  )
}
function EnvelopeIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path d="M3 4a2 2 0 0 0-2 2v1.161l8.441 4.221a1.25 1.25 0 0 0 1.118 0L19 7.162V6a2 2 0 0 0-2-2H3Z" />
      <path d="m19 8.839-7.77 3.885a2.75 2.75 0 0 1-2.46 0L1 8.839V14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.839Z" />
    </svg>
  )
}
