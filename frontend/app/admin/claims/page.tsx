'use client'

import { useState } from 'react'
import { API_URL } from '@/lib/api'

interface AdminClaim {
  id: string
  urn: string
  claimer_name: string
  claimer_email: string
  claimer_role: string | null
  evidence_notes: string | null
  status: string
  created_at: string
  nurseries?: { name: string; town: string } | null
}

export default function AdminClaimsPage() {
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [authed, setAuthed] = useState(false)
  const [claims, setClaims] = useState<AdminClaim[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function header() {
    return 'Basic ' + btoa(`${user}:${pass}`)
  }

  async function load() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_URL}/api/v1/claims?status=pending`, {
        headers: { Authorization: header() },
      })
      if (res.status === 401) {
        setError('Invalid admin credentials')
        setAuthed(false)
        setLoading(false)
        return
      }
      if (!res.ok) throw new Error('failed')
      const j = await res.json()
      setClaims(j.data || [])
      setAuthed(true)
    } catch {
      setError('Failed to load claims')
    }
    setLoading(false)
  }

  async function act(id: string, action: 'approve' | 'reject') {
    const adminNotes =
      action === 'reject' ? prompt('Reason for rejection (optional):') || '' : ''
    try {
      const res = await fetch(`${API_URL}/api/v1/claims/${id}/${action}`, {
        method: 'POST',
        headers: {
          Authorization: header(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ admin_notes: adminNotes }),
      })
      if (!res.ok) {
        setError(`Failed to ${action}`)
        return
      }
      await load()
    } catch {
      setError(`Failed to ${action}`)
    }
  }

  if (!authed) {
    return (
      <div className="max-w-md mx-auto px-4 py-16">
        <h1 className="text-2xl font-bold mb-4">Admin claims</h1>
        <p className="text-sm text-gray-600 mb-4">
          Enter ADMIN_USER and ADMIN_PASS. Credentials are sent as HTTP Basic auth and not
          persisted.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            load()
          }}
          className="space-y-3"
        >
          <input
            type="text"
            placeholder="Admin user"
            value={user}
            onChange={(e) => setUser(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
          <input
            type="password"
            placeholder="Admin password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
          <button
            type="submit"
            className="w-full py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
          >
            Sign in
          </button>
          {error && <p className="text-red-500 text-sm">{error}</p>}
        </form>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Pending claims</h1>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : claims.length === 0 ? (
        <p className="text-gray-500">No pending claims.</p>
      ) : (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs uppercase text-gray-500">
              <th className="py-2 pr-3">Nursery</th>
              <th className="py-2 pr-3">Claimer</th>
              <th className="py-2 pr-3">Role</th>
              <th className="py-2 pr-3">Evidence</th>
              <th className="py-2 pr-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {claims.map((c) => (
              <tr key={c.id} className="border-b border-gray-100 align-top">
                <td className="py-3 pr-3">
                  <p className="font-medium">{c.nurseries?.name || c.urn}</p>
                  <p className="text-xs text-gray-500">{c.nurseries?.town}</p>
                </td>
                <td className="py-3 pr-3">
                  <p>{c.claimer_name}</p>
                  <p className="text-xs text-gray-500">{c.claimer_email}</p>
                </td>
                <td className="py-3 pr-3">{c.claimer_role || '—'}</td>
                <td className="py-3 pr-3 max-w-xs">
                  <p className="text-xs text-gray-600 whitespace-pre-wrap">
                    {c.evidence_notes || '—'}
                  </p>
                </td>
                <td className="py-3 pr-3 space-x-2">
                  <button
                    onClick={() => act(c.id, 'approve')}
                    className="px-3 py-1 bg-green-600 text-white rounded text-xs font-semibold hover:bg-green-700"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => act(c.id, 'reject')}
                    className="px-3 py-1 bg-red-600 text-white rounded text-xs font-semibold hover:bg-red-700"
                  >
                    Reject
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
