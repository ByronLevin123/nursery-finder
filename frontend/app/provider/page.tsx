'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { API_URL, Nursery, getSubscription, type SubscriptionInfo } from '@/lib/api'

export default function ProviderDashboard() {
  const router = useRouter()
  const [nurseries, setNurseries] = useState<Nursery[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [providerTier, setProviderTier] = useState<string>('free')

  useEffect(() => {
    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login?next=/provider')
        return
      }
      try {
        getSubscription(session.access_token).then((sub) => {
          if (sub?.provider?.tier) setProviderTier(sub.provider.tier)
        })
        const res = await fetch(`${API_URL}/api/v1/provider/nurseries`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (!res.ok) throw new Error('failed')
        const j = await res.json()
        setNurseries(j.data || [])
      } catch {
        setError('Could not load your nurseries')
      }
      setLoading(false)
    }
    load()
  }, [router])

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

      {/* Quick links */}
      <div className="flex flex-wrap gap-3 mb-6">
        <Link href="/provider/onboarding" className="text-sm px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100">
          Onboarding wizard
        </Link>
        <Link href="/provider/enquiries" className="text-sm px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100">
          Enquiry inbox
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
          {nurseries.map((n) => (
            <li
              key={n.urn}
              className="bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between"
            >
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
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
