// Lightweight accessibility smoke test using axe-core.
// Catches the most common WCAG 2.1 AA violations on key UI components
// (label-association, color contrast, missing roles, etc.) at PR time.
//
// This isn't a full audit — for that, run axe in the browser DevTools
// against the deployed site. CI here is the bare-minimum guardrail.

import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import OglAttribution from '@/components/OglAttribution'
import CookieBanner from '@/components/CookieBanner'
import NewsletterSignup from '@/components/NewsletterSignup'

expect.extend(toHaveNoViolations)

describe('a11y smoke', () => {
  it('OglAttribution has no violations', async () => {
    const { container } = render(<OglAttribution />)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('CookieBanner has no violations', async () => {
    // Ensure banner shows by clearing the dismiss flag on the test JSDOM.
    try {
      window.localStorage.removeItem('nm:cookie-notice-ack')
    } catch {
      // jsdom localStorage should be available, but be defensive.
    }
    const { container } = render(<CookieBanner />)
    // Wait a tick so the useEffect that toggles visibility runs.
    await new Promise((r) => setTimeout(r, 0))
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('NewsletterSignup has no violations', async () => {
    const { container } = render(<NewsletterSignup />)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})
