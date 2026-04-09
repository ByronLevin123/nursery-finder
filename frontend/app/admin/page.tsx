'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from '@/components/SessionProvider'
import { getAuthToken, adminFetch } from '@/lib/api'

interface AdminStats {
  users: { total: number; customers: number; providers: number; admins: number }
  nurseries: { total: number; claimed: number }
  claims: { pending: number; approved: number; rejected: number }
  reviews: { pending: number; approved: number; flagged: number; rejected: number }
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

export default function AdminOverview() {
  const { role } = useSession()
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (role !== 'admin') return
    let cancelled = false
    ;(async () => {
      try {
        const token = await getAuthToken()
        if (!token) throw new Error('No auth token')
        const data = await adminFetch('/stats', token)
        if (!cancelled) setStats(data)
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

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
        ) : stats ? (
          <>
            <StatCard
              label="Total Users"
              value={stats.users.total.toLocaleString()}
              sub={`${stats.users.customers} customers, ${stats.users.providers} providers, ${stats.users.admins} admins`}
              icon={<UsersIcon />}
            />
            <StatCard
              label="Total Nurseries"
              value={stats.nurseries.total.toLocaleString()}
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
              value={`\u00A3${stats.mrr.toLocaleString()}`}
              sub="Monthly Recurring Revenue"
              icon={<CurrencyIcon />}
            />
            <StatCard
              label="Enquiries This Month"
              value={stats.enquiries_this_month}
              icon={<EnvelopeIcon />}
            />
          </>
        ) : null}
      </div>

      {/* Quick actions */}
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Quick Actions</h3>
      <div className="flex flex-wrap gap-3">
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
      </div>
    </div>
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
