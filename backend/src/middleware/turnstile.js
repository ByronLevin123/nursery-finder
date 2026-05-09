// Cloudflare Turnstile verification middleware.
//
// Graceful degradation: when TURNSTILE_SECRET_KEY is unset, the middleware
// is a no-op pass-through. This matches the frontend TurnstileWidget which
// also no-ops when the public site key is missing. So enabling spam
// protection is purely a config flip in both environments.
//
// When the secret IS set, the middleware reads `turnstile_token` from the
// request body, posts it to Cloudflare's siteverify endpoint, and rejects
// requests that don't pass.

import { logger } from '../logger.js'

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
const VERIFY_TIMEOUT_MS = 5000

export async function verifyTurnstile(req, res, next) {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) return next() // pass-through when unconfigured

  const token = req.body?.turnstile_token
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Missing Turnstile token' })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS)

  try {
    const params = new URLSearchParams({
      secret,
      response: token,
    })
    if (req.ip) params.append('remoteip', req.ip)

    const result = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      signal: controller.signal,
    })
    const data = await result.json()
    if (!data.success) {
      logger.warn(
        { codes: data['error-codes'], hostname: data.hostname },
        'turnstile verification failed'
      )
      return res.status(400).json({ error: 'Spam check failed. Please try again.' })
    }
    return next()
  } catch (err) {
    // Cloudflare timeout or unreachable — fail open to avoid breaking the
    // app on a third-party outage. Log loudly so it shows up in monitoring.
    logger.error({ err: err?.message }, 'turnstile verification call failed; falling open')
    return next()
  } finally {
    clearTimeout(timeout)
  }
}
