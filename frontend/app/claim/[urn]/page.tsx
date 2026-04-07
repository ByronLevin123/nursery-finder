'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getNursery, Nursery, API_URL } from '@/lib/api'
import { supabase } from '@/lib/supabase'

interface ExistingClaim {
  id: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  admin_notes?: string | null
}

const ROLES = ['Owner', 'Manager', 'Marketing', 'Other']

export default function ClaimPage({ params }: { params: { urn: string } }) {
  const router = useRouter()
  const [nursery, setNursery] = useState<Nursery | null>(null)
  const [existing, setExisting] = useState<ExistingClaim | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [evidence, setEvidence] = useState('')

  useEffect(() => {
    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) {
        router.push(`/login?next=/claim/${params.urn}`)
        return
      }
      setEmail(session.user.email || '')
      try {
        const n = await getNursery(params.urn)
        setNursery(n)
      } catch {
        setError('Nursery not found')
        setLoading(false)
        return
      }
      try {
        const res = await fetch(`${API_URL}/api/v1/claims/mine`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (res.ok) {
          const j = await res.json()
          const mine = (j.data || []).find((c: ExistingClaim & { urn: string }) => c.urn === params.urn)
          if (mine) setExisting(mine)
        }
      } catch {
        // non-fatal
      }
      setLoading(false)
    }
    load()
  }, [params.urn, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) {
        router.push(`/login?next=/claim/${params.urn}`)
        return
      }
      const res = await fetch(`${API_URL}/api/v1/claims`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          urn: params.urn,
          claimer_name: name,
          claimer_role: role || undefined,
          claimer_email: email,
          claimer_phone: phone || undefined,
          evidence_notes: evidence || undefined,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError(j.error || 'Failed to submit claim')
      } else {
        setSubmitted(true)
      }
    } catch {
      setError('Failed to submit claim')
    }
    setSubmitting(false)
  }

  if (loading) {
    return <div className="max-w-md mx-auto px-4 py-16 text-center text-gray-500">Loading...</div>
  }

  if (!nursery) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center text-red-500">
        {error || 'Nursery not found'}
      </div>
    )
  }

  if (existing) {
    const colour =
      existing.status === 'approved'
        ? 'text-green-700'
        : existing.status === 'rejected'
          ? 'text-red-700'
          : 'text-amber-700'
    return (
      <div className="max-w-md mx-auto px-4 py-16">
        <h1 className="text-2xl font-bold mb-2">Your claim for {nursery.name}</h1>
        <p className={`text-lg font-semibold ${colour}`}>Status: {existing.status}</p>
        {existing.admin_notes && (
          <p className="mt-2 text-sm text-gray-600">Admin notes: {existing.admin_notes}</p>
        )}
        <p className="mt-6 text-sm text-gray-500">
          Submitted {new Date(existing.created_at).toLocaleDateString('en-GB')}
        </p>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <p className="text-2xl mb-4">Claim submitted</p>
        <p className="text-gray-600">We&apos;ll review within 2 working days.</p>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-2">Claim {nursery.name}</h1>
      <p className="text-gray-600 mb-6">{nursery.town}</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700">Full name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option value="">Select...</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">Phone (optional)</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">
            How can we verify you represent this nursery?
          </label>
          <textarea
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
            rows={4}
            className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg"
            placeholder="e.g. work email, role at the nursery, link to staff page"
          />
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={submitting || !name || !email}
          className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? 'Submitting...' : 'Submit claim'}
        </button>
      </form>
    </div>
  )
}
