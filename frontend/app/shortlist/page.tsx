'use client'

import { useState, useEffect } from 'react'
import { getShortlist, removeFromShortlist } from '@/lib/shortlist'
import { getNursery, Nursery } from '@/lib/api'
import NurseryCard from '@/components/NurseryCard'
import OglAttribution from '@/components/OglAttribution'
import Link from 'next/link'
import { useSession } from '@/components/SessionProvider'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export default function ShortlistPage() {
  const [nurseries, setNurseries] = useState<Nursery[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [emailing, setEmailing] = useState(false)
  const [emailToast, setEmailToast] = useState<string | null>(null)
  const { session, user } = useSession()

  useEffect(() => {
    async function loadShortlist() {
      const urns = getShortlist()
      if (urns.length === 0) {
        setLoading(false)
        return
      }

      const results = await Promise.allSettled(
        urns.map(urn => getNursery(urn))
      )

      const loaded = results
        .filter((r): r is PromiseFulfilledResult<Nursery> => r.status === 'fulfilled')
        .map(r => r.value)

      setNurseries(loaded)
      setLoading(false)
    }

    loadShortlist()
  }, [])

  function handleRemove(urn: string) {
    removeFromShortlist(urn)
    setNurseries(prev => prev.filter(n => n.urn !== urn))
  }

  async function handleEmail() {
    if (!session) return
    const defaultEmail = user?.email || ''
    const to = window.prompt('Send shortlist to which email?', defaultEmail)
    if (!to) return
    setEmailing(true)
    setEmailToast(null)
    try {
      const res = await fetch(`${API_URL}/api/v1/email/shortlist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ to, urns: nurseries.map(n => n.urn) }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to send email')
      }
      setEmailToast('Email sent!')
    } catch (err: any) {
      setEmailToast(err.message || 'Failed to send')
    } finally {
      setEmailing(false)
      setTimeout(() => setEmailToast(null), 4000)
    }
  }

  function handleShare() {
    const urns = nurseries.map(n => n.urn).join(',')
    const url = `${window.location.origin}/shortlist?urns=${urns}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <p className="text-gray-500">Loading shortlist...</p>
      </div>
    )
  }

  if (nurseries.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Your Shortlist</h1>
        <p className="text-gray-500 mb-6">No nurseries saved yet. Search for nurseries to add them.</p>
        <Link
          href="/search"
          className="inline-block px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700"
        >
          Search nurseries →
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Your Shortlist ({nurseries.length})</h1>
        <div className="flex flex-wrap gap-2">
          {session ? (
            <button
              onClick={handleEmail}
              disabled={emailing}
              className="px-4 py-2 text-sm border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 disabled:opacity-50"
            >
              {emailing ? 'Sending…' : 'Email this shortlist'}
            </button>
          ) : (
            <Link
              href="/login?next=/shortlist"
              className="px-4 py-2 text-sm border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50"
            >
              Sign in to email shortlist
            </Link>
          )}
          <button
            onClick={handleShare}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            {copied ? '✓ Copied!' : 'Share link'}
          </button>
        </div>
      </div>
      {emailToast && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
          {emailToast}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {nurseries.map(nursery => (
          <div key={nursery.urn} className="relative">
            <NurseryCard nursery={nursery} showDistance={false} />
            <button
              onClick={() => handleRemove(nursery.urn)}
              className="absolute top-2 right-2 text-xs text-red-500 hover:text-red-700 bg-white rounded-full px-2 py-1 border border-red-200"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      <OglAttribution />
    </div>
  )
}
