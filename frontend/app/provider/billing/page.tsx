'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSession } from '@/components/SessionProvider'
import { getAuthToken, API_URL } from '@/lib/api'

interface ProviderSubscription {
  tier: string
  status: string
  enquiry_credits: number
  enquiry_credits_used: number
  current_period_end: string | null
  cancel_at_period_end: boolean
}

const TIERS = [
  {
    id: 'free',
    name: 'Free',
    price: '0',
    features: ['Basic listing', 'Up to 3 photos', '5 enquiry credits/month'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '29',
    features: [
      'Featured listing',
      'Unlimited photos',
      '50 enquiry credits/month',
      'Priority search placement',
      'Analytics dashboard',
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    price: '79',
    features: [
      'Everything in Pro',
      'Unlimited enquiry credits',
      'Branded profile page',
      'Social media promotion',
      'Dedicated support',
    ],
  },
]

function TierBadge({ tier }: { tier: string }) {
  const colours: Record<string, string> = {
    free: 'bg-gray-100 text-gray-700',
    pro: 'bg-indigo-100 text-indigo-700',
    premium: 'bg-purple-100 text-purple-700',
  }
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${colours[tier] || colours.free}`}
    >
      {tier}
    </span>
  )
}

export default function ProviderBillingPage() {
  const router = useRouter()
  const { session, loading: sessionLoading } = useSession()
  const [subscription, setSubscription] = useState<ProviderSubscription | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    if (sessionLoading) return
    if (!session) {
      router.push('/login?next=/provider/billing')
      return
    }

    async function loadSubscription() {
      try {
        const token = await getAuthToken()
        if (!token) throw new Error('Not authenticated')
        const res = await fetch(`${API_URL}/api/v1/billing/subscription`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) throw new Error('Failed to load subscription')
        const data = await res.json()
        setSubscription(data.data?.provider || null)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      } finally {
        setLoading(false)
      }
    }
    loadSubscription()
  }, [session, sessionLoading, router])

  async function handleCheckout(tier: string) {
    setActionLoading(tier)
    try {
      const token = await getAuthToken()
      if (!token) throw new Error('Not authenticated')
      const res = await fetch(`${API_URL}/api/v1/billing/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ tier, type: 'provider' }),
      })
      if (!res.ok) throw new Error('Failed to create checkout session')
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Checkout failed')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleManageBilling() {
    setActionLoading('portal')
    try {
      const token = await getAuthToken()
      if (!token) throw new Error('Not authenticated')
      const res = await fetch(`${API_URL}/api/v1/billing/portal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })
      if (!res.ok) throw new Error('Failed to open billing portal')
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not open billing portal')
    } finally {
      setActionLoading(null)
    }
  }

  const currentTier = subscription?.tier || 'free'

  if (sessionLoading || loading) {
    return <div className="max-w-4xl mx-auto px-4 py-16 text-center text-gray-500">Loading...</div>
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Billing &amp; subscription</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your provider subscription and billing details</p>
        </div>
        <Link href="/provider" className="text-sm text-indigo-600 hover:text-indigo-800">
          &larr; Back to dashboard
        </Link>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Current plan summary */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 uppercase font-medium mb-1">Current plan</p>
            <div className="flex items-center gap-3">
              <p className="text-xl font-bold text-gray-900 capitalize">{currentTier}</p>
              <TierBadge tier={currentTier} />
            </div>
            {subscription?.current_period_end && (
              <p className="text-sm text-gray-500 mt-2">
                {subscription.cancel_at_period_end ? 'Cancels' : 'Renews'} on{' '}
                {new Date(subscription.current_period_end).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            )}
            {subscription?.cancel_at_period_end && (
              <p className="text-sm text-amber-600 mt-1">
                Your plan will downgrade to Free at the end of this period
              </p>
            )}
          </div>
          {currentTier !== 'free' && (
            <button
              onClick={handleManageBilling}
              disabled={actionLoading === 'portal'}
              className="px-4 py-2 text-sm font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 disabled:opacity-50"
            >
              {actionLoading === 'portal' ? 'Opening...' : 'Manage billing'}
            </button>
          )}
        </div>
      </div>

      {/* Enquiry credits summary */}
      {subscription && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8">
          <p className="text-xs text-gray-500 uppercase font-medium mb-3">Enquiry credits this month</p>
          <div className="flex items-end gap-2 mb-3">
            <p className="text-3xl font-bold text-gray-900">
              {currentTier === 'premium'
                ? 'Unlimited'
                : `${subscription.enquiry_credits - subscription.enquiry_credits_used}`}
            </p>
            {currentTier !== 'premium' && (
              <p className="text-sm text-gray-400 mb-1">
                of {subscription.enquiry_credits} remaining
              </p>
            )}
          </div>
          {currentTier !== 'premium' && subscription.enquiry_credits > 0 && (
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className="bg-indigo-500 h-2 rounded-full transition-all"
                style={{
                  width: `${Math.min(100, ((subscription.enquiry_credits - subscription.enquiry_credits_used) / subscription.enquiry_credits) * 100)}%`,
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Tier comparison cards */}
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Available plans</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {TIERS.map((tier) => {
          const isCurrent = tier.id === currentTier
          const isUpgrade =
            TIERS.findIndex((t) => t.id === tier.id) >
            TIERS.findIndex((t) => t.id === currentTier)
          const isDowngrade =
            TIERS.findIndex((t) => t.id === tier.id) <
            TIERS.findIndex((t) => t.id === currentTier)

          return (
            <div
              key={tier.id}
              className={`bg-white border rounded-xl p-5 flex flex-col ${
                isCurrent ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-900">{tier.name}</h3>
                {isCurrent && <TierBadge tier="current" />}
              </div>
              <p className="text-3xl font-bold text-gray-900 mb-4">
                {tier.price === '0' ? 'Free' : `\u00A3${tier.price}`}
                {tier.price !== '0' && (
                  <span className="text-sm font-normal text-gray-500">/month</span>
                )}
              </p>
              <ul className="flex-1 space-y-2 mb-5">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-gray-600">
                    <svg
                      className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>
              {isCurrent ? (
                <button
                  disabled
                  className="w-full py-2 text-sm font-medium text-gray-400 bg-gray-100 rounded-lg cursor-not-allowed"
                >
                  Current plan
                </button>
              ) : isUpgrade ? (
                <button
                  onClick={() => handleCheckout(tier.id)}
                  disabled={actionLoading === tier.id}
                  className="w-full py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {actionLoading === tier.id ? 'Processing...' : `Upgrade to ${tier.name}`}
                </button>
              ) : isDowngrade ? (
                <button
                  onClick={handleManageBilling}
                  disabled={actionLoading === 'portal'}
                  className="w-full py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  {actionLoading === 'portal' ? 'Opening...' : 'Downgrade'}
                </button>
              ) : null}
            </div>
          )
        })}
      </div>

      <p className="text-xs text-gray-400 text-center">
        All prices exclude VAT. You can cancel or change your plan at any time.
      </p>
    </div>
  )
}
