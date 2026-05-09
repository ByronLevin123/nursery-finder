'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

/**
 * Cookie consent / transparency banner.
 *
 * UK PECR + GDPR only require *consent* for non-essential cookies. NurseryMatch
 * sets only essential cookies today:
 *   - Supabase auth session (required for login)
 *   - Stripe Checkout (required for payment processing — only set on /billing flow)
 *   - Plausible analytics is cookieless and does not count
 *
 * So strictly, no consent banner is legally required. We show one anyway for
 * transparency — users have an explicit signal that cookies exist and what
 * they're for, with a link to the privacy policy. This builds trust without
 * the dark-pattern "Reject all" gymnastics that real consent banners need.
 *
 * If we ever add advertising / tracking cookies, this component must grow a
 * proper accept/reject control and gate cookie-setting behind it.
 */

const STORAGE_KEY = 'nm:cookie-notice-ack'
const STORAGE_VERSION = '1' // bump if banner copy changes materially

export default function CookieBanner() {
  // Render nothing on the server — avoids hydration mismatch since the
  // initial visibility depends on localStorage.
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      if (stored !== STORAGE_VERSION) setVisible(true)
    } catch {
      // localStorage unavailable (private mode in some browsers, etc.) —
      // show the banner per session. No-op when dismissed.
      setVisible(true)
    }
  }, [])

  function dismiss() {
    setVisible(false)
    try {
      window.localStorage.setItem(STORAGE_KEY, STORAGE_VERSION)
    } catch {
      // Ignore storage failures — re-showing on next visit is acceptable.
    }
  }

  if (!mounted || !visible) return null

  return (
    <div
      role="region"
      aria-label="Cookie notice"
      className="fixed bottom-4 left-4 right-4 z-[60] mx-auto max-w-2xl rounded-lg border border-gray-200 bg-white shadow-lg md:bottom-6 md:left-auto md:right-6 md:mx-0"
    >
      <div className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between md:gap-4 md:p-5">
        <div className="text-sm text-gray-700 leading-relaxed">
          <p className="font-semibold text-gray-900">Cookies on NurseryMatch</p>
          <p className="mt-1 text-gray-600">
            We use only essential cookies — for sign-in sessions and secure
            payment. We don&apos;t use advertising or tracking cookies, and our
            analytics (Plausible) are cookieless.{' '}
            <Link
              href="/privacy"
              className="font-medium text-blue-600 hover:text-blue-700 underline"
            >
              Privacy policy
            </Link>
            .
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={dismiss}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
