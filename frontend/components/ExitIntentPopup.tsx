'use client'

import { useEffect, useState, useCallback } from 'react'

/**
 * ExitIntentPopup — shows a modal when the user's mouse leaves the viewport
 * (desktop only). Encourages the user to take the nursery quiz before leaving.
 *
 * Rules:
 * - Only triggers on desktop (mouseleave on documentElement)
 * - Only shows once per session (sessionStorage)
 * - Only shows after 5 seconds on page (no annoying instant bouncers)
 * - Clean dismiss button + overlay click to close
 */

const SESSION_KEY = 'nm:exit-intent-shown'

export default function ExitIntentPopup() {
  const [visible, setVisible] = useState(false)
  const [ready, setReady] = useState(false)

  // Wait 5 seconds before arming the popup
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 5000)
    return () => clearTimeout(timer)
  }, [])

  const handleMouseLeave = useCallback(
    (e: MouseEvent) => {
      // Only trigger when mouse exits through the top of the viewport
      if (e.clientY > 0) return
      if (!ready) return

      try {
        if (sessionStorage.getItem(SESSION_KEY)) return
      } catch {
        // sessionStorage unavailable — allow showing
      }

      setVisible(true)

      try {
        sessionStorage.setItem(SESSION_KEY, '1')
      } catch {
        // Ignore storage failures
      }
    },
    [ready]
  )

  useEffect(() => {
    // Only attach on desktop — check for fine pointer (mouse)
    const isDesktop = window.matchMedia('(pointer: fine)').matches
    if (!isDesktop) return

    document.documentElement.addEventListener('mouseleave', handleMouseLeave)
    return () => {
      document.documentElement.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [handleMouseLeave])

  function dismiss() {
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 px-4"
      onClick={dismiss}
      role="dialog"
      aria-modal="true"
      aria-label="Before you go"
    >
      <div
        className="relative bg-white rounded-xl shadow-2xl max-w-md w-full p-8 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={dismiss}
          className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
          aria-label="Close"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="text-4xl mb-4" aria-hidden>
          <span role="img" aria-label="waving hand">&#128075;</span>
        </div>

        <h2 className="text-2xl font-bold text-gray-900 mb-2">Before you go...</h2>

        <p className="text-gray-600 mb-6 leading-relaxed">
          Take the 2-minute quiz to find your perfect nursery. We&apos;ll match
          you based on location, budget, and what matters most to your family.
        </p>

        <a
          href="/quiz"
          className="inline-block w-full px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition shadow-lg mb-3"
        >
          Take the quiz
        </a>

        <button
          onClick={dismiss}
          className="text-sm text-gray-500 hover:text-gray-700 transition"
        >
          No thanks, I&apos;ll keep browsing
        </button>
      </div>
    </div>
  )
}
