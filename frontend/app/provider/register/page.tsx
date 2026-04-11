'use client'

import { useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { API_URL } from '@/lib/api'

interface NurseryResult {
  urn: string
  name: string
  town: string | null
  postcode: string | null
  ofsted_overall_grade: string | null
}

const ROLES = ['Owner', 'Manager', 'Administrator', 'Staff Member']

const GRADE_COLORS: Record<string, string> = {
  Outstanding: 'bg-green-100 text-green-800',
  Good: 'bg-blue-100 text-blue-800',
  'Requires improvement': 'bg-yellow-100 text-yellow-800',
  Inadequate: 'bg-red-100 text-red-800',
}

export default function ProviderRegisterPage() {
  const [step, setStep] = useState(1)

  // Step 1 — Your details
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState('')

  // Step 2 — Find your nursery
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<NurseryResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedNursery, setSelectedNursery] = useState<NurseryResult | null>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // Step 3 — Claim details
  const [evidenceNotes, setEvidenceNotes] = useState('')
  const [confirmed, setConfirmed] = useState(false)

  // Submission
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const searchNurseries = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (q.trim().length < 2) {
      setSearchResults([])
      return
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`${API_URL}/api/v1/nurseries/search?q=${encodeURIComponent(q)}&limit=5`)
        if (res.ok) {
          const data = await res.json()
          setSearchResults(data.nurseries || data.data || data || [])
        }
      } catch {
        // ignore search errors
      } finally {
        setSearching(false)
      }
    }, 300)
  }, [])

  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    setSelectedNursery(null)
    searchNurseries(value)
  }

  const selectNursery = (nursery: NurseryResult) => {
    setSelectedNursery(nursery)
    setSearchResults([])
    setSearchQuery(nursery.name)
  }

  const canAdvance = (): boolean => {
    if (step === 1) return name.trim() !== '' && email.trim() !== '' && role !== ''
    if (step === 2) return selectedNursery !== null
    if (step === 3) return evidenceNotes.trim().length >= 10 && confirmed
    return false
  }

  const handleSubmit = async () => {
    if (!selectedNursery) return
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(`${API_URL}/api/v1/provider-auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim(),
          phone: phone.trim(),
          role_at_nursery: role,
          urn: selectedNursery.urn,
          evidence_notes: evidenceNotes.trim(),
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error || `Registration failed (${res.status})`)
      }
      setStep(4)
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const next = () => {
    if (step === 3) {
      handleSubmit()
    } else {
      setStep(step + 1)
    }
  }

  const back = () => {
    if (step > 1) setStep(step - 1)
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="text-2xl font-bold text-indigo-600 hover:text-indigo-500">
            CompareTheNursery
          </Link>
          <h1 className="mt-4 text-3xl font-bold text-gray-900">Register as a Provider</h1>
          <p className="mt-2 text-gray-600">Claim your nursery listing and manage your profile</p>
        </div>

        {/* Progress bar */}
        {step < 4 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      s < step
                        ? 'bg-indigo-600 text-white'
                        : s === step
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {s < step ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      s
                    )}
                  </div>
                  {s < 3 && (
                    <div className={`w-16 sm:w-24 h-1 mx-2 ${s < step ? 'bg-indigo-600' : 'bg-gray-200'}`} />
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>Your details</span>
              <span>Find nursery</span>
              <span>Confirm</span>
            </div>
          </div>
        )}

        {/* Step 1: Your details */}
        {step === 1 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Your details</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Full name <span className="text-red-500">*</span>
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Smith"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition"
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email address <span className="text-red-500">*</span>
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jane@nursery.co.uk"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition"
                />
              </div>
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                  Phone number
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="07700 900000"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition"
                />
              </div>
              <div>
                <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
                  Your role at the nursery <span className="text-red-500">*</span>
                </label>
                <select
                  id="role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition"
                >
                  <option value="">Select a role...</option>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Find your nursery */}
        {step === 2 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Find your nursery</h2>
            <p className="text-sm text-gray-500 mb-6">Search by nursery name or postcode</p>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="e.g. Bright Sparks or SW1A 1AA"
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition"
              />
              {searching && (
                <div className="absolute right-3 top-3">
                  <div className="w-5 h-5 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
                </div>
              )}
            </div>

            {/* Search results */}
            {searchResults.length > 0 && !selectedNursery && (
              <div className="mt-3 space-y-2">
                {searchResults.map((n) => (
                  <button
                    key={n.urn}
                    onClick={() => selectNursery(n)}
                    className="w-full text-left bg-gray-50 hover:bg-indigo-50 border border-gray-200 hover:border-indigo-300 rounded-lg p-4 transition"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{n.name}</p>
                        <p className="text-sm text-gray-500 mt-0.5">
                          {[n.town, n.postcode].filter(Boolean).join(', ')}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">URN: {n.urn}</p>
                      </div>
                      {n.ofsted_overall_grade && (
                        <span
                          className={`text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap ${
                            GRADE_COLORS[n.ofsted_overall_grade] || 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {n.ofsted_overall_grade}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Selected nursery */}
            {selectedNursery && (
              <div className="mt-4 bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-indigo-900">{selectedNursery.name}</p>
                    <p className="text-sm text-indigo-700 mt-0.5">
                      {[selectedNursery.town, selectedNursery.postcode].filter(Boolean).join(', ')}
                    </p>
                    <p className="text-xs text-indigo-500 mt-0.5">URN: {selectedNursery.urn}</p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedNursery(null)
                      setSearchQuery('')
                    }}
                    className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                  >
                    Change
                  </button>
                </div>
              </div>
            )}

            {searchQuery.trim().length >= 2 && searchResults.length === 0 && !searching && !selectedNursery && (
              <p className="mt-3 text-sm text-gray-500">No nurseries found. Try a different name or postcode.</p>
            )}
          </div>
        )}

        {/* Step 3: Claim details */}
        {step === 3 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Confirm your claim</h2>
            <p className="text-sm text-gray-500 mb-6">
              Claiming <span className="font-medium text-gray-700">{selectedNursery?.name}</span>
            </p>
            <div className="space-y-4">
              <div>
                <label htmlFor="evidence" className="block text-sm font-medium text-gray-700 mb-1">
                  Evidence notes <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  Briefly describe how you can prove you work at this nursery (e.g. your job title, how long you have worked there, or other details that can help us verify your claim).
                </p>
                <textarea
                  id="evidence"
                  rows={4}
                  value={evidenceNotes}
                  onChange={(e) => setEvidenceNotes(e.target.value)}
                  placeholder="I am the owner of this nursery and have been running it since 2018..."
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition resize-none"
                />
                {evidenceNotes.trim().length > 0 && evidenceNotes.trim().length < 10 && (
                  <p className="text-xs text-red-500 mt-1">Please provide at least 10 characters.</p>
                )}
              </div>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700">
                  I confirm I work at this nursery and the information I have provided is accurate.
                </span>
              </label>
            </div>
          </div>
        )}

        {/* Step 4: Success */}
        {step === 4 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Registration submitted</h2>
            <p className="text-gray-600 mb-6">
              Check your email for a magic link. Your claim will be reviewed within 24 hours.
            </p>
            <p className="text-sm text-gray-500 mb-8">
              We sent a confirmation to <span className="font-medium text-gray-700">{email}</span>
            </p>
            <Link
              href="/"
              className="inline-block rounded-lg bg-indigo-600 px-6 py-2.5 text-white font-medium hover:bg-indigo-700 transition"
            >
              Back to home
            </Link>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Navigation buttons */}
        {step < 4 && (
          <div className="mt-6 flex items-center justify-between">
            <button
              onClick={back}
              disabled={step === 1}
              className={`rounded-lg px-5 py-2.5 text-sm font-medium transition ${
                step === 1
                  ? 'text-gray-300 cursor-not-allowed'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Back
            </button>
            <button
              onClick={next}
              disabled={!canAdvance() || submitting}
              className={`rounded-lg px-6 py-2.5 text-sm font-medium text-white transition ${
                canAdvance() && !submitting
                  ? 'bg-indigo-600 hover:bg-indigo-700'
                  : 'bg-indigo-300 cursor-not-allowed'
              }`}
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Submitting...
                </span>
              ) : step === 3 ? (
                'Submit registration'
              ) : (
                'Continue'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
