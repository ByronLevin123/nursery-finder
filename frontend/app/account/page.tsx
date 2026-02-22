'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface SavedSearch {
  id: string
  postcode: string
  radius_km: number
  grade_filter: string | null
  funded_2yr: boolean
  funded_3yr: boolean
  alert_on_new: boolean
  name: string | null
}

export default function AccountPage() {
  const [email, setEmail] = useState('')
  const [searches, setSearches] = useState<SavedSearch[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }

      setEmail(session.user.email || '')

      const { data } = await supabase
        .from('saved_searches')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })

      setSearches(data || [])
      setLoading(false)
    }
    load()
  }, [router])

  async function deleteSearch(id: string) {
    await supabase.from('saved_searches').delete().eq('id', id)
    setSearches(prev => prev.filter(s => s.id !== id))
  }

  async function toggleAlert(id: string, current: boolean) {
    await supabase.from('saved_searches').update({ alert_on_new: !current }).eq('id', id)
    setSearches(prev => prev.map(s => s.id === id ? { ...s, alert_on_new: !current } : s))
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) return <div className="max-w-md mx-auto px-4 py-16 text-center text-gray-500">Loading...</div>

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Your Account</h1>
          <p className="text-gray-500 text-sm">{email}</p>
        </div>
        <button
          onClick={handleSignOut}
          className="text-sm text-red-500 hover:text-red-700"
        >
          Sign out
        </button>
      </div>

      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Saved Searches</h2>
        {searches.length === 0 ? (
          <p className="text-gray-500 text-sm">No saved searches yet. When you search for nurseries, you can save your search here.</p>
        ) : (
          <div className="space-y-3">
            {searches.map(search => (
              <div key={search.id} className="bg-white border border-gray-200 rounded-lg p-4 flex justify-between items-center">
                <div>
                  <p className="font-medium text-gray-900">
                    {search.name || search.postcode} — {search.radius_km}km
                  </p>
                  <p className="text-xs text-gray-500">
                    {search.grade_filter && `${search.grade_filter} only`}
                    {search.funded_2yr && ' · 2yr funded'}
                    {search.funded_3yr && ' · 3-4yr funded'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleAlert(search.id, search.alert_on_new)}
                    className={`text-xs px-2 py-1 rounded-full ${
                      search.alert_on_new
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {search.alert_on_new ? '🔔 Alerts on' : '🔕 Alerts off'}
                  </button>
                  <Link
                    href={`/search?postcode=${search.postcode}`}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Run
                  </Link>
                  <button
                    onClick={() => deleteSearch(search.id)}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Links</h2>
        <div className="flex gap-4">
          <Link href="/shortlist" className="text-sm text-blue-600 hover:underline">Your Shortlist</Link>
          <Link href="/search" className="text-sm text-blue-600 hover:underline">Search Nurseries</Link>
        </div>
      </div>
    </div>
  )
}
