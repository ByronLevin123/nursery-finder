'use client'

import { useState, useEffect } from 'react'
import { getNursery, Nursery } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function ClaimPage({ params }: { params: { urn: string } }) {
  const [nursery, setNursery] = useState<Nursery | null>(null)
  const [role, setRole] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const router = useRouter()

  useEffect(() => {
    async function load() {
      // Check if logged in
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }

      try {
        const data = await getNursery(params.urn)
        setNursery(data)
      } catch {
        setError('Nursery not found')
      }
      setLoading(false)
    }
    load()
  }, [params.urn, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!role || !confirmed) return

    setLoading(true)
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
      const { data: { session } } = await supabase.auth.getSession()

      const res = await fetch(`${API_URL}/api/v1/nurseries/${params.urn}/claim`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ role }),
      })

      if (res.ok) {
        setSubmitted(true)
      } else {
        setError('Failed to submit claim. Please try again.')
      }
    } catch {
      setError('Failed to submit claim. Please try again.')
    }
    setLoading(false)
  }

  if (loading) return <div className="max-w-md mx-auto px-4 py-16 text-center text-gray-500">Loading...</div>

  if (submitted) return (
    <div className="max-w-md mx-auto px-4 py-16 text-center">
      <p className="text-2xl mb-4">✅ Claim submitted</p>
      <p className="text-gray-600">
        We'll verify your claim and get back to you. Check your email for a verification link.
      </p>
    </div>
  )

  if (!nursery) return <div className="max-w-md mx-auto px-4 py-16 text-center text-red-500">{error || 'Nursery not found'}</div>

  return (
    <div className="max-w-md mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-2">Claim this nursery</h1>
      <p className="text-gray-600 mb-6">{nursery.name}, {nursery.town}</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-sm text-gray-600 font-medium">Your role</label>
          <select
            value={role}
            onChange={e => setRole(e.target.value)}
            className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg"
            required
          >
            <option value="">Select...</option>
            <option value="owner">Owner</option>
            <option value="manager">Manager</option>
            <option value="staff">Staff member</option>
          </select>
        </div>

        <label className="flex items-start gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={e => setConfirmed(e.target.checked)}
            className="mt-1 rounded"
            required
          />
          I confirm I am authorised to manage this nursery listing on NurseryFinder.
        </label>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={!role || !confirmed || loading}
          className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50"
        >
          Submit claim
        </button>
      </form>
    </div>
  )
}
