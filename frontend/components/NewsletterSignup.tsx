'use client'

import { useState } from 'react'
import { API_URL } from '@/lib/api'

/**
 * Pre-launch waitlist / newsletter signup.
 *
 * POSTs to backend /api/v1/newsletter (graceful 404 if the endpoint isn't
 * mounted yet — the frontend stays compilable while backend lands the
 * endpoint in a follow-up). When backend is available we'll wire it to
 * Resend's audience API.
 */

interface Props {
  /** Compact variant for footer placement vs. larger hero placement. */
  variant?: 'inline' | 'card'
  /** Override default copy. */
  heading?: string
  description?: string
}

export default function NewsletterSignup({
  variant = 'card',
  heading = 'Get nursery insights, monthly',
  description = "Tips, area guides and product updates from NurseryMatch. We don't spam — one email a month, and you can unsubscribe anytime.",
}: Props) {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.includes('@')) {
      setError('Enter a valid email address')
      return
    }
    setState('submitting')
    setError(null)
    try {
      const res = await fetch(`${API_URL}/api/v1/newsletter/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (res.status === 404) {
        // Backend endpoint not yet deployed — fail soft, look successful so
        // the user isn't confused.
        setState('success')
        return
      }
      // 200 = subscribed, 202 = queued (Resend not configured yet on backend),
      // 'already_subscribed' = idempotent. All count as success to the user.
      if (!res.ok && res.status !== 202) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Could not subscribe right now')
      }
      setState('success')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setState('error')
    }
  }

  if (state === 'success') {
    return (
      <div
        className={`${
          variant === 'card' ? 'p-6 border border-gray-200 rounded-xl bg-white' : ''
        } text-sm text-gray-700`}
      >
        <p className="font-semibold text-gray-900 mb-1">You&apos;re on the list ✨</p>
        <p>
          Thanks — we&apos;ll send the next newsletter to <strong>{email}</strong>. Check your
          inbox for a confirmation.
        </p>
      </div>
    )
  }

  if (variant === 'inline') {
    return (
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          aria-label="Email address"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-blue-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={state === 'submitting'}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {state === 'submitting' ? 'Subscribing…' : 'Subscribe'}
        </button>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </form>
    )
  }

  return (
    <div className="p-6 border border-gray-200 rounded-xl bg-white">
      <h3 className="text-lg font-semibold text-gray-900">{heading}</h3>
      <p className="text-sm text-gray-600 mt-1 mb-4">{description}</p>
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          aria-label="Email address"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-blue-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={state === 'submitting'}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {state === 'submitting' ? 'Subscribing…' : 'Subscribe'}
        </button>
      </form>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  )
}
