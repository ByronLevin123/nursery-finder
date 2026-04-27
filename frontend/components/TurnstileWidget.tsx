'use client'

import { useEffect, useRef, useState } from 'react'

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement | string,
        opts: {
          sitekey: string
          callback?: (token: string) => void
          'error-callback'?: (err: unknown) => void
          'expired-callback'?: () => void
          theme?: 'light' | 'dark' | 'auto'
          size?: 'normal' | 'compact'
        }
      ) => string
      reset: (widgetId?: string) => void
      remove: (widgetId?: string) => void
    }
    onTurnstileReady?: () => void
  }
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileReady'

interface Props {
  /** Called when a token is issued. Pass through to your form submit handler. */
  onToken: (token: string) => void
  /** Called when the token expires (~5 min). The widget auto-resets. */
  onExpired?: () => void
}

/**
 * Cloudflare Turnstile spam-protection widget.
 *
 * Graceful degradation: if NEXT_PUBLIC_TURNSTILE_SITE_KEY is not set, this
 * component renders nothing AND immediately calls onToken with an empty
 * string. The backend's verifyTurnstile middleware mirrors this — when no
 * secret is configured, it skips verification. So the form works in dev /
 * preview without Turnstile signup, and lights up automatically once both
 * keys are configured in their respective dashboards.
 */
export default function TurnstileWidget({ onToken, onExpired }: Props) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)
  const [scriptLoaded, setScriptLoaded] = useState(false)

  // No site key configured — degrade gracefully. Tell the parent we have
  // a "valid" token so submission isn't blocked. Backend short-circuits too.
  useEffect(() => {
    if (!siteKey) onToken('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey])

  useEffect(() => {
    if (!siteKey) return
    if (typeof window === 'undefined') return

    // Idempotent script injection. Cloudflare's loader supports onload via
    // window.onTurnstileReady, which fires once the global `turnstile` is
    // ready. If the script is already on the page, just check the global.
    if (window.turnstile) {
      setScriptLoaded(true)
      return
    }

    const existing = document.querySelector(`script[src^="https://challenges.cloudflare.com/turnstile"]`)
    if (existing) {
      window.onTurnstileReady = () => setScriptLoaded(true)
      return
    }

    window.onTurnstileReady = () => setScriptLoaded(true)
    const s = document.createElement('script')
    s.src = SCRIPT_SRC
    s.async = true
    s.defer = true
    document.head.appendChild(s)
  }, [siteKey])

  useEffect(() => {
    if (!scriptLoaded || !siteKey || !containerRef.current || !window.turnstile) return
    if (widgetIdRef.current) return // already rendered

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      callback: (token) => onToken(token),
      'expired-callback': () => {
        if (onExpired) onExpired()
        // Pass empty token while the user re-completes the challenge.
        onToken('')
      },
      'error-callback': () => onToken(''),
      theme: 'light',
      size: 'normal',
    })

    return () => {
      // Cleanup on unmount.
      try {
        if (widgetIdRef.current && window.turnstile) {
          window.turnstile.remove(widgetIdRef.current)
        }
      } catch {
        // no-op — Cloudflare API throws if widget already cleaned up
      }
      widgetIdRef.current = null
    }
  }, [scriptLoaded, siteKey, onToken, onExpired])

  if (!siteKey) return null

  return (
    <div
      ref={containerRef}
      className="my-3"
      data-testid="turnstile-widget"
    />
  )
}
