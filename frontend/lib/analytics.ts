/**
 * Plausible custom events — type-safe wrappers around `window.plausible()`.
 *
 * Pageviews are auto-tracked by the Plausible script in layout.tsx. Use these
 * helpers for funnel events you want to set up as goals in the Plausible
 * dashboard (Sites → nurserymatch.com → Goals → Add goal → "Custom event").
 *
 * The matching dashboard goal names are documented in
 * docs/LAUNCH_CHECKLIST.md (Plausible setup section).
 *
 * All helpers are safe to call before Plausible has loaded, and on the
 * server (where window is undefined) — they no-op silently.
 */

declare global {
  interface Window {
    plausible?: (
      event: string,
      options?: { callback?: () => void; props?: Record<string, string | number | boolean> }
    ) => void
  }
}

export type AnalyticsEvent =
  // Acquisition
  | 'Signup'
  | 'Newsletter Subscribe'
  // Engagement
  | 'Search'
  | 'Quiz Complete'
  | 'Shortlist Add'
  | 'Compare Add'
  | 'AI Assistant Query'
  // Conversion (parent → high-intent)
  | 'Enquiry Submit'
  // Provider funnel
  | 'Provider Register'
  | 'Claim Submit'
  | 'Provider Checkout Start'
  | 'Provider Checkout Success'

export function trackEvent(
  event: AnalyticsEvent,
  props?: Record<string, string | number | boolean>
): void {
  if (typeof window === 'undefined') return
  try {
    if (typeof window.plausible === 'function') {
      window.plausible(event, props ? { props } : undefined)
    }
    // If window.plausible is undefined, the early-init stub installed in
    // layout.tsx (see <Script id="plausible-stub">) buffers calls until
    // the real script loads. Without that stub, calls before the deferred
    // script arrives would be dropped silently.
  } catch {
    // Never let analytics break user flows.
  }
}
