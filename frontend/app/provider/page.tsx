'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { API_URL, Nursery } from '@/lib/api'

export default function ProviderDashboard() {
  const router = useRouter()
  const [nurseries, setNurseries] = useState<Nursery[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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
      {error && <p className="text-red-500 mb-4">{error}</p>}

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
              <Link
                href={`/provider/${n.urn}/edit`}
                className="text-sm text-blue-600 font-medium hover:underline"
              >
                Edit listing
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
