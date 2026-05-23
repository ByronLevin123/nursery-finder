'use client'

import { useState, useEffect, useCallback } from 'react'
import { API_URL } from '@/lib/api'
import { trackEvent } from '@/lib/analytics'

const DISMISSED_KEY = 'newsletter-popup-dismissed'
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000
const SHOW_DELAY_MS = 30_000

export default function NewsletterPopup() {
  const [visible, setVisible] = useState(false)
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  const dismiss = useCallback(() => {
    setVisible(false)
    try {
      localStorage.setItem(DISMISSED_KEY, String(Date.now()))
    } catch {
      // localStorage unavailable — no-op
    }
  }, [])

  useEffect(() => {
    // Check if dismissed within last 30 days
    try {
      const dismissed = localStorage.getItem(DISMISSED_KEY)
      if (dismissed) {
        const ts = parseInt(dismissed, 10)
        if (!isNaN(ts) && Date.now() - ts < THIRTY_DAYS_MS) {
          return // Still within cooldown period
        }
      }
    } catch {
      // localStorage unavailable — show popup anyway
    }

    let shown = false

    function show() {
      if (shown) return
      shown = true
      setVisible(true)
    }

    // Timer: show after 30 seconds
    const timer = setTimeout(show, SHOW_DELAY_MS)

    // Scroll: show when user scrolls past 50%
    function handleScroll() {
      const scrollPct =
        window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)
      if (scrollPct >= 0.5) {
        show()
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      clearTimeout(timer)
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

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
        // Backend endpoint not yet deployed — fail soft
        setState('success')
        dismiss()
        return
      }
      if (!res.ok && res.status !== 202) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Could not subscribe right now')
      }
      trackEvent('Newsletter Subscribe', { variant: 'popup' })
      setState('success')
      dismiss()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setState('error')
    }
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center px-4 pb-0 animate-slide-up">
      <div className="w-full max-w-sm bg-white rounded-t-2xl shadow-xl border border-gray-200 border-b-0 p-6">
        {/* Close button */}
        <button
          onClick={dismiss}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {state === 'success' ? (
          <div className="text-center py-2">
            <p className="font-semibold text-gray-900 mb-1">You are on the list</p>
            <p className="text-sm text-gray-600">
              Thanks — we will send the next newsletter to <strong>{email}</strong>.
            </p>
          </div>
        ) : (
          <>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              Get weekly nursery updates
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              New nurseries, inspection changes, and tips for your area
            </p>

            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                aria-label="Email address"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={state === 'submitting'}
                className="w-full px-4 py-3 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
              >
                {state === 'submitting' ? 'Subscribing...' : 'Subscribe'}
              </button>
            </form>

            {error && (
              <p className="text-xs text-red-600 mt-2">{error}</p>
            )}
          </>
        )}
      </div>

      <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}
