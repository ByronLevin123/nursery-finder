'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from '@/components/SessionProvider'
import { getAuthToken, createCheckout, getSubscription, type SubscriptionInfo } from '@/lib/api'
import OglAttribution from '@/components/OglAttribution'

/*
  NOTE: To add a Pricing link in the navbar, add the following to Nav.tsx:
  <Link href="/pricing" className="...">Pricing</Link>
  (Not modifying Nav.tsx here as another agent recently changed it.)
*/

// ---------- tier data (static, matches backend seed) ----------

const PARENT_TIERS = [
  {
    tier: 'free',
    name: 'Free',
    monthlyPrice: 0,
    features: [
      { text: '3 shortlist slots', included: true },
      { text: '3 side-by-side compares', included: true },
      { text: 'Basic search', included: true },
      { text: 'Area data', included: true },
      { text: 'Unlimited shortlist & compare', included: false },
      { text: 'Advanced filters', included: false },
      { text: 'Priority support', included: false },
      { text: 'AI recommendations', included: false },
    ],
  },
  {
    tier: 'premium',
    name: 'Premium',
    monthlyPrice: 4.99,
    features: [
      { text: '3 shortlist slots', included: true },
      { text: '3 side-by-side compares', included: true },
      { text: 'Basic search', included: true },
      { text: 'Area data', included: true },
      { text: 'Unlimited shortlist & compare', included: true },
      { text: 'Advanced filters', included: true },
      { text: 'Priority support', included: true },
      { text: 'AI recommendations', included: true },
    ],
  },
]

const PROVIDER_TIERS = [
  {
    tier: 'free',
    name: 'Free',
    monthlyPrice: 0,
    popular: false,
    features: [
      { text: 'Basic listing', included: true },
      { text: '5 enquiry views / month', included: true },
      { text: 'Basic profile', included: true },
      { text: 'Featured listing', included: false },
      { text: 'Priority search placement', included: false },
      { text: '50 enquiry views / month', included: false },
      { text: 'Advanced analytics', included: false },
      { text: 'Unlimited enquiries', included: false },
      { text: 'Custom branding', included: false },
      { text: 'Dedicated support', included: false },
    ],
  },
  {
    tier: 'pro',
    name: 'Pro',
    monthlyPrice: 29,
    popular: true,
    features: [
      { text: 'Basic listing', included: true },
      { text: '5 enquiry views / month', included: true },
      { text: 'Basic profile', included: true },
      { text: 'Featured listing', included: true },
      { text: 'Priority search placement', included: true },
      { text: '50 enquiry views / month', included: true },
      { text: 'Advanced analytics', included: true },
      { text: 'Unlimited enquiries', included: false },
      { text: 'Custom branding', included: false },
      { text: 'Dedicated support', included: false },
    ],
  },
  {
    tier: 'premium',
    name: 'Premium',
    monthlyPrice: 79,
    popular: false,
    features: [
      { text: 'Basic listing', included: true },
      { text: '5 enquiry views / month', included: true },
      { text: 'Basic profile', included: true },
      { text: 'Featured listing', included: true },
      { text: 'Priority search placement', included: true },
      { text: 'Unlimited enquiries', included: true },
      { text: 'Advanced analytics', included: true },
      { text: 'Unlimited enquiries', included: true },
      { text: 'Custom branding', included: true },
      { text: 'Dedicated support', included: true },
    ],
  },
]

function annualPrice(monthly: number) {
  // 2 months free on annual
  return +(monthly * 10).toFixed(2)
}

function Check() {
  return (
    <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
}

function Cross() {
  return (
    <svg className="w-5 h-5 text-gray-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

export default function PricingPage() {
  const router = useRouter()
  const { session, user, role } = useSession()
  const [annual, setAnnual] = useState(false)
  const [sub, setSub] = useState<SubscriptionInfo | null>(null)
  const [loading, setLoading] = useState<string | null>(null)

  useEffect(() => {
    if (!session) return
    getAuthToken().then((token) => {
      if (token) getSubscription(token).then(setSub)
    })
  }, [session])

  const currentProviderTier = sub?.provider?.tier || 'free'
  const currentParentTier = sub?.parent?.tier || 'free'

  async function handleUpgrade(tier: string, type: 'provider' | 'parent') {
    if (!session) {
      router.push('/login?next=/pricing')
      return
    }
    setLoading(`${type}-${tier}`)
    try {
      const token = await getAuthToken()
      if (!token) {
        router.push('/login?next=/pricing')
        return
      }
      const url = await createCheckout(token, tier, type)
      if (url) {
        window.location.href = url
      }
    } finally {
      setLoading(null)
    }
  }

  function isCurrentTier(tier: string, type: 'provider' | 'parent') {
    if (type === 'provider') return currentProviderTier === tier
    return currentParentTier === tier
  }

  function ctaLabel(tier: string, type: 'provider' | 'parent') {
    if (isCurrentTier(tier, type)) return 'Current plan'
    if (tier === 'free') return 'Get started'
    return `Upgrade to ${tier.charAt(0).toUpperCase() + tier.slice(1)}`
  }

  function formatPrice(monthly: number) {
    if (monthly === 0) return '0'
    if (annual) {
      const ap = annualPrice(monthly)
      const perMonth = +(ap / 12).toFixed(2)
      return perMonth.toFixed(2)
    }
    return monthly.toFixed(2)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 via-purple-50 to-white">
      {/* Hero */}
      <section className="pt-16 pb-8 px-4 text-center">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 tracking-tight mb-4">
          Simple, transparent pricing
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-8">
          Whether you are a parent searching for the perfect nursery or a provider looking to reach more families, we have a plan for you.
        </p>

        {/* Annual toggle */}
        <div className="flex items-center justify-center gap-3 mb-12">
          <span className={`text-sm font-medium ${!annual ? 'text-gray-900' : 'text-gray-500'}`}>Monthly</span>
          <button
            onClick={() => setAnnual(!annual)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${annual ? 'bg-indigo-600' : 'bg-gray-300'}`}
            role="switch"
            aria-checked={annual}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${annual ? 'translate-x-6' : 'translate-x-1'}`}
            />
          </button>
          <span className={`text-sm font-medium ${annual ? 'text-gray-900' : 'text-gray-500'}`}>
            Annual
            <span className="ml-1.5 inline-block px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
              2 months free
            </span>
          </span>
        </div>
      </section>

      {/* ---- For Parents ---- */}
      <section className="px-4 pb-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 text-center mb-8">For Parents</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {PARENT_TIERS.map((t) => {
              const isCurrent = isCurrentTier(t.tier, 'parent')
              return (
                <div
                  key={t.tier}
                  className={`relative bg-white rounded-2xl border p-8 shadow-sm hover:shadow-md transition ${
                    t.tier === 'premium' ? 'border-indigo-300 ring-2 ring-indigo-100' : 'border-gray-200'
                  }`}
                >
                  {t.tier === 'premium' && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-indigo-600 text-white text-xs font-semibold rounded-full">
                      Recommended
                    </span>
                  )}
                  <h3 className="text-xl font-bold text-gray-900 mb-1">{t.name}</h3>
                  <div className="mb-6">
                    <span className="text-4xl font-bold text-gray-900">
                      {t.monthlyPrice === 0 ? 'Free' : `\u00A3${formatPrice(t.monthlyPrice)}`}
                    </span>
                    {t.monthlyPrice > 0 && (
                      <span className="text-gray-500 text-sm ml-1">/ month</span>
                    )}
                    {annual && t.monthlyPrice > 0 && (
                      <p className="text-xs text-gray-400 mt-1">
                        Billed as {'\u00A3'}{annualPrice(t.monthlyPrice).toFixed(2)} / year
                      </p>
                    )}
                  </div>
                  <ul className="space-y-3 mb-8">
                    {t.features.map((f, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        {f.included ? <Check /> : <Cross />}
                        <span className={f.included ? 'text-gray-700' : 'text-gray-400'}>{f.text}</span>
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => !isCurrent && t.tier !== 'free' && handleUpgrade(t.tier, 'parent')}
                    disabled={isCurrent || loading === `parent-${t.tier}`}
                    className={`w-full py-3 rounded-xl font-semibold text-sm transition ${
                      isCurrent
                        ? 'bg-gray-100 text-gray-500 cursor-default'
                        : t.tier === 'premium'
                        ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {loading === `parent-${t.tier}` ? 'Redirecting...' : ctaLabel(t.tier, 'parent')}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ---- For Providers ---- */}
      <section className="px-4 pb-20">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 text-center mb-8">For Nursery Providers</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PROVIDER_TIERS.map((t) => {
              const isCurrent = isCurrentTier(t.tier, 'provider')
              return (
                <div
                  key={t.tier}
                  className={`relative bg-white rounded-2xl border p-8 shadow-sm hover:shadow-md transition ${
                    t.popular ? 'border-indigo-300 ring-2 ring-indigo-100 scale-[1.02]' : 'border-gray-200'
                  }`}
                >
                  {t.popular && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-indigo-600 text-white text-xs font-semibold rounded-full">
                      Most popular
                    </span>
                  )}
                  {isCurrent && (
                    <span className="absolute top-4 right-4 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                      Current
                    </span>
                  )}
                  <h3 className="text-xl font-bold text-gray-900 mb-1">{t.name}</h3>
                  <div className="mb-6">
                    <span className="text-4xl font-bold text-gray-900">
                      {t.monthlyPrice === 0 ? 'Free' : `\u00A3${formatPrice(t.monthlyPrice)}`}
                    </span>
                    {t.monthlyPrice > 0 && (
                      <span className="text-gray-500 text-sm ml-1">/ month</span>
                    )}
                    {annual && t.monthlyPrice > 0 && (
                      <p className="text-xs text-gray-400 mt-1">
                        Billed as {'\u00A3'}{annualPrice(t.monthlyPrice).toFixed(2)} / year
                      </p>
                    )}
                  </div>
                  <ul className="space-y-3 mb-8">
                    {t.features.map((f, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        {f.included ? <Check /> : <Cross />}
                        <span className={f.included ? 'text-gray-700' : 'text-gray-400'}>{f.text}</span>
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => !isCurrent && t.tier !== 'free' && handleUpgrade(t.tier, 'provider')}
                    disabled={isCurrent || loading === `provider-${t.tier}`}
                    className={`w-full py-3 rounded-xl font-semibold text-sm transition ${
                      isCurrent
                        ? 'bg-gray-100 text-gray-500 cursor-default'
                        : t.popular
                        ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                        : t.tier === 'premium'
                        ? 'bg-purple-600 text-white hover:bg-purple-700'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {loading === `provider-${t.tier}` ? 'Redirecting...' : ctaLabel(t.tier, 'provider')}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-4 pb-16">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">Frequently asked questions</h2>
          <div className="space-y-4">
            {[
              {
                q: 'Can I cancel at any time?',
                a: 'Yes. Cancel any time from your account page. You keep access until the end of your billing period.',
              },
              {
                q: 'What payment methods do you accept?',
                a: 'We accept all major credit and debit cards via Stripe. Your payment details are never stored on our servers.',
              },
              {
                q: 'Do you offer refunds?',
                a: 'If you are unhappy within the first 14 days, contact us for a full refund.',
              },
              {
                q: 'What happens when I hit my enquiry credit limit?',
                a: 'You will still receive enquiries but will not be able to view new contact details until your credits reset at the start of the next billing period, or you upgrade.',
              },
            ].map((faq) => (
              <details key={faq.q} className="bg-white border border-gray-200 rounded-xl p-5 group">
                <summary className="font-medium text-gray-900 cursor-pointer list-none flex items-center justify-between">
                  {faq.q}
                  <svg
                    className="w-5 h-5 text-gray-400 group-open:rotate-180 transition-transform"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <p className="mt-3 text-sm text-gray-600 leading-relaxed">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <OglAttribution />
      </div>
    </div>
  )
}
