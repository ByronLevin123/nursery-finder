/**
 * Plausible custom events + Google Ads conversion tracking.
 *
 * Pageviews are auto-tracked by the Plausible script in layout.tsx. Use these
 * helpers for funnel events you want to set up as goals in the Plausible
 * dashboard (Sites > nurserymatch.com > Goals > Add goal > "Custom event").
 *
 * Google Ads conversions are fired alongside Plausible events when
 * NEXT_PUBLIC_GOOGLE_ADS_ID is set. Map conversion labels in
 * GTAG_CONVERSION_MAP below.
 */

declare global {
  interface Window {
    plausible?: (
      event: string,
      options?: { callback?: () => void; props?: Record<string, string | number | boolean> }
    ) => void
    gtag?: (...args: any[]) => void
    dataLayer?: any[]
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
  // Conversion (parent > high-intent)
  | 'Enquiry Submit'
  // Provider funnel
  | 'Provider Register'
  | 'Claim Submit'
  | 'Provider Checkout Start'
  | 'Provider Checkout Success'

const GTAG_CONVERSION_MAP: Partial<Record<AnalyticsEvent, string>> = {
  'Signup': 'signup',
  'Enquiry Submit': 'enquiry',
  'Claim Submit': 'claim',
  'Provider Checkout Success': 'purchase',
  'Provider Register': 'provider_register',
  'Search': 'search',
  'Quiz Complete': 'quiz_complete',
}

export function trackEvent(
  event: AnalyticsEvent,
  props?: Record<string, string | number | boolean>
): void {
  if (typeof window === 'undefined') return
  try {
    if (typeof window.plausible === 'function') {
      window.plausible(event, props ? { props } : undefined)
    }

    const conversionLabel = GTAG_CONVERSION_MAP[event]
    if (conversionLabel && typeof window.gtag === 'function') {
      window.gtag('event', 'conversion', {
        send_to: `${process.env.NEXT_PUBLIC_GOOGLE_ADS_ID}/${conversionLabel}`,
        ...(props || {}),
      })
    }
  } catch {
    // Never let analytics break user flows.
  }
}
