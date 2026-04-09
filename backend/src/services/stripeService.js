import Stripe from 'stripe'
import { logger } from '../logger.js'
import db from '../db.js'

let stripe = null
function getStripe() {
  if (!stripe && process.env.STRIPE_SECRET_KEY) {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-04-10' })
  }
  return stripe
}

// Price IDs from env (set after creating products in Stripe dashboard)
const PRICES = {
  provider_pro: process.env.STRIPE_PRICE_PROVIDER_PRO,
  provider_premium: process.env.STRIPE_PRICE_PROVIDER_PREMIUM,
  parent_premium: process.env.STRIPE_PRICE_PARENT_PREMIUM,
}

export async function createCheckoutSession({ userId, email, tier, type, successUrl, cancelUrl }) {
  // type = 'provider' or 'parent'
  // tier = 'pro', 'premium', or 'premium' (parent)
  const s = getStripe()
  if (!s) throw new Error('Stripe not configured')

  const priceKey = type === 'provider' ? `provider_${tier}` : `parent_${tier}`
  const priceId = PRICES[priceKey]
  if (!priceId) throw new Error(`No price configured for ${priceKey}`)

  // Find or create Stripe customer
  const table = type === 'provider' ? 'provider_subscriptions' : 'parent_subscriptions'
  const { data: existing } = await db
    .from(table)
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .maybeSingle()

  let customerId = existing?.stripe_customer_id
  if (!customerId) {
    const customer = await s.customers.create({ email, metadata: { user_id: userId, type } })
    customerId = customer.id
    // Upsert subscription row
    await db
      .from(table)
      .upsert({ user_id: userId, stripe_customer_id: customerId, tier: 'free' }, { onConflict: 'user_id' })
  }

  const session = await s.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl || `${process.env.FRONTEND_URL}/account?upgraded=1`,
    cancel_url: cancelUrl || `${process.env.FRONTEND_URL}/pricing`,
    metadata: { user_id: userId, type, tier },
  })

  return { url: session.url, sessionId: session.id }
}

export async function createPortalSession({ userId, type }) {
  const s = getStripe()
  if (!s) throw new Error('Stripe not configured')

  const table = type === 'provider' ? 'provider_subscriptions' : 'parent_subscriptions'
  const { data } = await db
    .from(table)
    .select('stripe_customer_id')
    .eq('user_id', userId)
    .maybeSingle()
  if (!data?.stripe_customer_id) throw new Error('No subscription found')

  const session = await s.billingPortal.sessions.create({
    customer: data.stripe_customer_id,
    return_url: `${process.env.FRONTEND_URL}/account`,
  })
  return { url: session.url }
}

export async function handleWebhook(rawBody, signature) {
  const s = getStripe()
  if (!s) throw new Error('Stripe not configured')

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) throw new Error('Webhook secret not configured')

  const event = s.webhooks.constructEvent(rawBody, signature, webhookSecret)
  logger.info({ type: event.type }, 'stripe: webhook received')

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object
      const { user_id, type, tier } = session.metadata
      if (!user_id) break

      // Get subscription details
      const subscription = await s.subscriptions.retrieve(session.subscription)
      const table = type === 'provider' ? 'provider_subscriptions' : 'parent_subscriptions'

      const tierLimits = { free: 5, pro: 50, premium: -1 }
      const updateData = {
        tier,
        status: subscription.status === 'active' ? 'active' : 'trialing',
        stripe_subscription_id: subscription.id,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      }
      if (type === 'provider') {
        updateData.enquiry_credits = tierLimits[tier] || 5
        updateData.enquiry_credits_used = 0
      }

      await db.from(table).update(updateData).eq('user_id', user_id)

      // Update nursery featured status for providers
      if (type === 'provider' && (tier === 'pro' || tier === 'premium')) {
        const { data: claims } = await db
          .from('nursery_claims')
          .select('urn')
          .eq('user_id', user_id)
          .eq('status', 'approved')
        if (claims?.length) {
          const urns = claims.map((c) => c.urn)
          await db.from('nurseries').update({ featured: true, provider_tier: tier }).in('urn', urns)
        }
      }

      logger.info({ user_id, type, tier }, 'stripe: subscription activated')
      break
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object
      const customerId = subscription.customer

      // Try provider first, then parent
      for (const table of ['provider_subscriptions', 'parent_subscriptions']) {
        const { data } = await db
          .from(table)
          .select('user_id')
          .eq('stripe_customer_id', customerId)
          .maybeSingle()
        if (data) {
          await db
            .from(table)
            .update({
              status: subscription.cancel_at_period_end
                ? 'cancelled'
                : subscription.status === 'active'
                  ? 'active'
                  : 'past_due',
              cancel_at_period_end: subscription.cancel_at_period_end,
              current_period_start: new Date(
                subscription.current_period_start * 1000
              ).toISOString(),
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('stripe_customer_id', customerId)
          break
        }
      }
      break
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object
      const customerId = subscription.customer

      for (const table of ['provider_subscriptions', 'parent_subscriptions']) {
        const { data } = await db
          .from(table)
          .select('user_id')
          .eq('stripe_customer_id', customerId)
          .maybeSingle()
        if (data) {
          await db
            .from(table)
            .update({
              tier: 'free',
              status: 'cancelled',
              stripe_subscription_id: null,
              cancel_at_period_end: false,
              updated_at: new Date().toISOString(),
            })
            .eq('stripe_customer_id', customerId)

          // Remove featured status if provider
          if (table === 'provider_subscriptions') {
            const { data: claims } = await db
              .from('nursery_claims')
              .select('urn')
              .eq('user_id', data.user_id)
              .eq('status', 'approved')
            if (claims?.length) {
              await db
                .from('nurseries')
                .update({ featured: false, provider_tier: 'free' })
                .in(
                  'urn',
                  claims.map((c) => c.urn)
                )
            }
          }

          logger.info({ user_id: data.user_id, table }, 'stripe: subscription cancelled')
          break
        }
      }
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object
      const customerId = invoice.customer
      for (const table of ['provider_subscriptions', 'parent_subscriptions']) {
        await db
          .from(table)
          .update({ status: 'past_due', updated_at: new Date().toISOString() })
          .eq('stripe_customer_id', customerId)
      }
      break
    }
  }

  return { received: true }
}

export async function getProviderSubscription(userId) {
  const { data } = await db
    .from('provider_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  return data || { tier: 'free', status: 'active', enquiry_credits: 5, enquiry_credits_used: 0 }
}

export async function getParentSubscription(userId) {
  const { data } = await db
    .from('parent_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  return data || { tier: 'free', status: 'active' }
}

export async function useEnquiryCredit(userId) {
  const sub = await getProviderSubscription(userId)
  if (sub.tier === 'premium') return true // unlimited
  if (sub.enquiry_credits_used >= sub.enquiry_credits) return false
  await db
    .from('provider_subscriptions')
    .update({ enquiry_credits_used: (sub.enquiry_credits_used || 0) + 1 })
    .eq('user_id', userId)
  return true
}
