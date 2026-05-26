'use client'

import { useState, useEffect } from 'react'
import { getShortlist, removeFromShortlist, getShortlistByType, ShortlistEntry } from '@/lib/shortlist'
import { getNursery, getSchool, Nursery, School, API_URL } from '@/lib/api'
import NurseryCard from '@/components/NurseryCard'
import SchoolCard from '@/components/SchoolCard'
import OglAttribution from '@/components/OglAttribution'
import PromptModal from '@/components/PromptModal'
import Link from 'next/link'
import { useSession } from '@/components/SessionProvider'

type ActiveTab = 'all' | 'nurseries' | 'schools'

export default function ShortlistPage() {
  const [nurseries, setNurseries] = useState<Nursery[]>([])
  const [schools, setSchools] = useState<School[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [emailing, setEmailing] = useState(false)
  const [emailToast, setEmailToast] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<ActiveTab>('all')
  const { session, user } = useSession()

  useEffect(() => {
    async function loadShortlist() {
      const entries = getShortlist()
      if (entries.length === 0) {
        setLoading(false)
        return
      }

      const nurseryEntries = entries.filter(e => e.type === 'nursery')
      const schoolEntries = entries.filter(e => e.type === 'school')

      const [nurseryResults, schoolResults] = await Promise.all([
        Promise.allSettled(nurseryEntries.map(e => getNursery(e.urn))),
        Promise.allSettled(schoolEntries.map(e => getSchool(e.urn))),
      ])

      setNurseries(
        nurseryResults
          .filter((r): r is PromiseFulfilledResult<Nursery> => r.status === 'fulfilled')
          .map(r => r.value)
      )
      setSchools(
        schoolResults
          .filter((r): r is PromiseFulfilledResult<School> => r.status === 'fulfilled')
          .map(r => r.value)
      )
      setLoading(false)
    }

    loadShortlist()
  }, [])

  function handleRemoveNursery(urn: string) {
    removeFromShortlist(urn)
    setNurseries(prev => prev.filter(n => n.urn !== urn))
  }

  function handleRemoveSchool(urn: string) {
    removeFromShortlist(urn)
    setSchools(prev => prev.filter(s => s.urn !== urn))
  }

  const [showEmailPrompt, setShowEmailPrompt] = useState(false)

  async function doEmail(to: string) {
    if (!session) return
    setShowEmailPrompt(false)
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
        throw new Error((err as Record<string, string>).error || 'Failed to send email')
      }
      setEmailToast('Email sent!')
    } catch (err: unknown) {
      setEmailToast(err instanceof Error ? err.message : 'Failed to send')
    } finally {
      setEmailing(false)
      setTimeout(() => setEmailToast(null), 4000)
    }
  }

  function handleEmail() {
    setShowEmailPrompt(true)
  }

  async function handleShare() {
    const allUrns = [...nurseries.map(n => n.urn), ...schools.map(s => s.urn)]
    if (session) {
      try {
        const res = await fetch(`${API_URL}/api/v1/shortlist/share`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ urns: allUrns }),
        })
        if (res.ok) {
          const { token } = await res.json()
          const url = `${window.location.origin}/shortlist/shared/${token}`
          await navigator.clipboard.writeText(url)
          setCopied(true)
          setTimeout(() => setCopied(false), 3000)
          return
        }
      } catch {}
    }
    const url = `${window.location.origin}/shortlist?urns=${allUrns.join(',')}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const totalCount = nurseries.length + schools.length
  const hasMultipleTypes = nurseries.length > 0 && schools.length > 0

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <p className="text-gray-500">Loading shortlist...</p>
      </div>
    )
  }

  if (totalCount === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Your Shortlist</h1>
        <p className="text-gray-500 mb-6">No items saved yet. Search for nurseries or schools to add them.</p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link
            href="/search"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700"
          >
            Search nurseries &rarr;
          </Link>
          <Link
            href="/search/schools"
            className="inline-block px-6 py-3 bg-white text-blue-600 border border-blue-300 rounded-xl hover:bg-blue-50"
          >
            Search schools &rarr;
          </Link>
        </div>
      </div>
    )
  }

  const showNurseries = activeTab === 'all' || activeTab === 'nurseries'
  const showSchools = activeTab === 'all' || activeTab === 'schools'

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Your Shortlist ({totalCount})</h1>
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

      {/* Type tabs */}
      {hasMultipleTypes && (
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
              activeTab === 'all' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
            }`}
          >
            All ({totalCount})
          </button>
          <button
            onClick={() => setActiveTab('nurseries')}
            className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
              activeTab === 'nurseries' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
            }`}
          >
            Nurseries ({nurseries.length})
          </button>
          <button
            onClick={() => setActiveTab('schools')}
            className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
              activeTab === 'schools' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
            }`}
          >
            Schools ({schools.length})
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {showNurseries && nurseries.map(nursery => (
          <div key={nursery.urn} className="relative">
            <NurseryCard nursery={nursery} showDistance={false} />
            <button
              onClick={() => handleRemoveNursery(nursery.urn)}
              className="absolute top-2 right-2 text-xs text-red-500 hover:text-red-700 bg-white rounded-full px-2 py-1 border border-red-200"
            >
              Remove
            </button>
          </div>
        ))}
        {showSchools && schools.map(school => (
          <div key={school.urn} className="relative">
            <SchoolCard school={school} showDistance={false} />
            <button
              onClick={() => handleRemoveSchool(school.urn)}
              className="absolute top-2 right-2 text-xs text-red-500 hover:text-red-700 bg-white rounded-full px-2 py-1 border border-red-200"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      <OglAttribution />
      <PromptModal
        open={showEmailPrompt}
        title="Email your shortlist"
        message="We'll send a summary of your shortlisted nurseries to this address."
        placeholder="you@example.com"
        defaultValue={user?.email || ''}
        submitLabel="Send"
        validate={(v) => v.includes('@') ? null : 'Please enter a valid email'}
        onSubmit={doEmail}
        onCancel={() => setShowEmailPrompt(false)}
      />
    </div>
  )
}
