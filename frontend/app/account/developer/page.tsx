'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from '@/components/SessionProvider'
import { useRouter } from 'next/navigation'
import { API_URL } from '@/lib/api'
import Link from 'next/link'

interface ApiKey {
  id: string
  key_prefix: string
  label: string
  last_used_at: string | null
  created_at: string
  revoked_at: string | null
}

interface UsageRow {
  date: string
  request_count: number
}

interface Account {
  id: string
  company_name: string
  website_url: string | null
  use_case: string | null
  tier: string
  status: string
  created_at: string
}

export default function DeveloperDashboard() {
  const { session, loading: sessionLoading } = useSession()
  const router = useRouter()
  const [account, setAccount] = useState<Account | null>(null)
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [usage, setUsage] = useState<UsageRow[]>([])
  const [loading, setLoading] = useState(true)
  const [noAccount, setNoAccount] = useState(false)
  const [newKey, setNewKey] = useState<string | null>(null)
  const [error, setError] = useState('')

  // Registration form
  const [companyName, setCompanyName] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [useCase, setUseCase] = useState('')
  const [registering, setRegistering] = useState(false)

  const fetchAccount = useCallback(async () => {
    if (!session) return
    try {
      const res = await fetch(`${API_URL}/api/v1/developer/account`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.status === 404) {
        setNoAccount(true)
        setLoading(false)
        return
      }
      if (!res.ok) throw new Error('Failed to load account')
      const data = await res.json()
      setAccount(data.account)
      setKeys(data.keys || [])
      setUsage(data.usage || [])
      setNoAccount(false)
    } catch {
      setError('Failed to load developer account')
    } finally {
      setLoading(false)
    }
  }, [session])

  useEffect(() => {
    if (sessionLoading) return
    if (!session) {
      router.push('/login?redirect=/account/developer')
      return
    }
    fetchAccount()
  }, [session, sessionLoading, router, fetchAccount])

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (!session || !companyName.trim()) return
    setRegistering(true)
    setError('')
    try {
      const res = await fetch(`${API_URL}/api/v1/developer/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          company_name: companyName.trim(),
          website_url: websiteUrl.trim() || null,
          use_case: useCase.trim() || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Registration failed')
      }
      const data = await res.json()
      setNewKey(data.api_key)
      await fetchAccount()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setRegistering(false)
    }
  }

  async function handleGenerateKey() {
    if (!session) return
    setError('')
    try {
      const res = await fetch(`${API_URL}/api/v1/developer/keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ label: 'API Key' }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to generate key')
      }
      const data = await res.json()
      setNewKey(data.api_key)
      await fetchAccount()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate key')
    }
  }

  async function handleRevokeKey(keyId: string) {
    if (!session || !confirm('Revoke this API key? This cannot be undone.')) return
    try {
      const res = await fetch(`${API_URL}/api/v1/developer/keys/${keyId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) throw new Error('Failed to revoke key')
      await fetchAccount()
    } catch {
      setError('Failed to revoke key')
    }
  }

  if (sessionLoading || loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <p className="text-gray-500 text-center">Loading…</p>
      </div>
    )
  }

  // Registration form
  if (noAccount) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Create developer account</h1>
        <p className="text-gray-600 mb-6">
          Get an API key to integrate NurseryMatch data into your application.
        </p>

        {newKey && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl">
            <p className="text-sm font-semibold text-green-800 mb-1">Your API key (save it now):</p>
            <code className="text-sm bg-white px-3 py-2 rounded border block break-all">
              {newKey}
            </code>
            <p className="text-xs text-green-700 mt-2">
              This key will not be shown again. Store it securely.
            </p>
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Company name *
            </label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              placeholder="e.g. Acme Properties"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Website (optional)
            </label>
            <input
              type="url"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              placeholder="https://example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              How will you use the API? (optional)
            </label>
            <textarea
              value={useCase}
              onChange={(e) => setUseCase(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              placeholder="e.g. Show nursery data on our property listing pages"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={registering || !companyName.trim()}
            className="w-full py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50 transition"
          >
            {registering ? 'Creating…' : 'Create account & get API key'}
          </button>
        </form>
      </div>
    )
  }

  // Dashboard
  const activeKeys = keys.filter((k) => !k.revoked_at)
  const totalRequests30d = usage.reduce((sum, r) => sum + r.request_count, 0)

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Developer Dashboard</h1>
          <p className="text-sm text-gray-500">
            {account?.company_name} · {account?.tier.toUpperCase()} tier
          </p>
        </div>
        <Link
          href="/developers"
          className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
        >
          API docs
        </Link>
      </div>

      {/* New key banner */}
      {newKey && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl">
          <p className="text-sm font-semibold text-green-800 mb-1">
            New API key (save it now):
          </p>
          <code className="text-sm bg-white px-3 py-2 rounded border block break-all">
            {newKey}
          </code>
          <p className="text-xs text-green-700 mt-2">
            This key will not be shown again.
          </p>
          <button
            onClick={() => setNewKey(null)}
            className="mt-2 text-xs text-green-700 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Usage summary */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="p-4 bg-gray-50 rounded-xl text-center">
          <p className="text-2xl font-bold text-gray-900">{totalRequests30d.toLocaleString()}</p>
          <p className="text-xs text-gray-500">Requests (30 days)</p>
        </div>
        <div className="p-4 bg-gray-50 rounded-xl text-center">
          <p className="text-2xl font-bold text-gray-900">{activeKeys.length}</p>
          <p className="text-xs text-gray-500">Active keys</p>
        </div>
        <div className="p-4 bg-gray-50 rounded-xl text-center">
          <p className="text-2xl font-bold text-indigo-600 capitalize">{account?.tier}</p>
          <p className="text-xs text-gray-500">Tier</p>
        </div>
      </div>

      {/* API keys */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900">API Keys</h2>
          <button
            onClick={handleGenerateKey}
            disabled={activeKeys.length >= 5}
            className="px-4 py-1.5 text-sm bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition"
          >
            Generate new key
          </button>
        </div>
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          {keys.length === 0 ? (
            <p className="p-4 text-sm text-gray-500 text-center">No API keys yet.</p>
          ) : (
            keys.map((key) => (
              <div
                key={key.id}
                className={`flex items-center justify-between p-4 border-b last:border-b-0 ${
                  key.revoked_at ? 'opacity-50 bg-gray-50' : ''
                }`}
              >
                <div>
                  <code className="text-sm font-mono text-gray-800">
                    {key.key_prefix}{'••••••••••••'}
                  </code>
                  <p className="text-xs text-gray-500 mt-1">
                    {key.label} · Created{' '}
                    {new Date(key.created_at).toLocaleDateString()}
                    {key.last_used_at &&
                      ` · Last used ${new Date(key.last_used_at).toLocaleDateString()}`}
                    {key.revoked_at && ' · Revoked'}
                  </p>
                </div>
                {!key.revoked_at && (
                  <button
                    onClick={() => handleRevokeKey(key.id)}
                    className="text-xs text-red-600 hover:text-red-700 font-medium"
                  >
                    Revoke
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Quick start */}
      <div className="p-6 bg-gray-50 rounded-xl">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Quick start</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs">
{`<!-- Drop this into any page -->
<div data-nursery-widget
     data-postcode="SW11 1AA"
     data-api-key="YOUR_KEY">
</div>
<script src="https://nurserymatch.com/embed.js" defer></script>`}
        </pre>
        <p className="text-xs text-gray-500 mt-3">
          Replace YOUR_KEY with one of your API keys above.{' '}
          <Link href="/developers" className="text-indigo-600 hover:underline">
            Full documentation
          </Link>
        </p>
      </div>
    </div>
  )
}
