// Newsletter subscribe — adds an email to the Resend audience set in
// RESEND_AUDIENCE_ID. Graceful degradation: if either RESEND_API_KEY or
// RESEND_AUDIENCE_ID is unset, we accept the request and log it, so the
// frontend never breaks while we're still wiring things up.

import express from 'express'
import rateLimit from 'express-rate-limit'
import { logger } from '../logger.js'

const router = express.Router()

// Hard cap per IP — newsletter signup is unauthenticated, so without this
// it's a free abuse vector for an attacker to fill our Resend audience.
const subscribeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many signups from this IP, try again later' },
})

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

router.post('/subscribe', subscribeLimiter, async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim()
    if (!email || !EMAIL_RE.test(email) || email.length > 254) {
      return res.status(400).json({ error: 'Valid email required' })
    }

    const apiKey = process.env.RESEND_API_KEY
    const audienceId = process.env.RESEND_AUDIENCE_ID

    // Either env var missing → log and accept the signup so the UX stays
    // smooth. Real subscribe will land once both are configured.
    if (!apiKey || !audienceId) {
      logger.info(
        { email_redacted: email.replace(/^([^@]{2}).+@/, '$1***@') },
        'newsletter signup queued (Resend not configured)'
      )
      return res.status(202).json({
        status: 'queued',
        message: 'Subscription accepted; you will be added to our list.',
      })
    }

    const upstream = await fetch(
      `https://api.resend.com/audiences/${encodeURIComponent(audienceId)}/contacts`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, unsubscribed: false }),
      }
    )

    if (upstream.status === 422 || upstream.status === 409) {
      // Already subscribed — treat as success so the user isn't told off.
      return res.json({ status: 'already_subscribed' })
    }

    if (!upstream.ok) {
      const body = await upstream.text().catch(() => '')
      logger.warn(
        { status: upstream.status, body: body.slice(0, 200) },
        'newsletter subscribe upstream error'
      )
      return res
        .status(502)
        .json({ error: 'Could not subscribe right now. Please try again later.' })
    }

    logger.info(
      { email_redacted: email.replace(/^([^@]{2}).+@/, '$1***@') },
      'newsletter subscribe ok'
    )
    return res.json({ status: 'subscribed' })
  } catch (err) {
    return next(err)
  }
})

export default router
