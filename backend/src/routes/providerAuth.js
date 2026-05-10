// Provider registration + combined claim flow
// POST /api/v1/provider-auth/register — creates account + claim in one step

import express from 'express'
import rateLimit from 'express-rate-limit'
import { createClient } from '@supabase/supabase-js'
import db from '../db.js'
import { logger } from '../logger.js'
import { isBusinessEmail } from '../utils/emailValidation.js'

const router = express.Router()

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many registration attempts, please try again later' },
})

// Service-role client for creating users
let adminAuth = null
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
  adminAuth = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

// POST /register — provider sign-up + nursery claim
router.post('/register', registerLimiter, async (req, res, next) => {
  try {
    if (!db || !adminAuth) {
      return res.status(503).json({ error: 'Service not configured' })
    }

    const { email, name, phone, password, role_at_nursery, urn, evidence_notes } = req.body

    // Validate required fields
    if (!email || !name || !urn) {
      return res.status(400).json({ error: 'email, name and urn are required' })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' })
    }

    // Require business email for providers
    if (!isBusinessEmail(email)) {
      return res.status(400).json({
        error:
          'Please use a business email address. Personal email domains (Gmail, Hotmail, Yahoo, etc.) are not accepted for provider accounts.',
      })
    }

    // Validate password
    if (!password || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' })
    }
    if (password.length > 72) {
      return res.status(400).json({ error: 'Password must be at most 72 characters' })
    }

    // Check nursery exists
    const { data: nursery, error: nErr } = await db
      .from('nurseries')
      .select('urn, name, claimed_by_user_id')
      .eq('urn', urn)
      .maybeSingle()

    if (nErr) throw nErr
    if (!nursery) {
      return res.status(404).json({ error: 'Nursery not found with that URN' })
    }

    // Check if nursery is already claimed
    if (nursery.claimed_by_user_id) {
      return res
        .status(409)
        .json({ error: 'This nursery has already been claimed by another provider' })
    }

    // Check for existing pending claim
    const { data: existingClaim } = await db
      .from('nursery_claims')
      .select('id, status')
      .eq('urn', urn)
      .in('status', ['pending', 'approved'])
      .maybeSingle()

    if (existingClaim) {
      return res.status(409).json({
        error:
          existingClaim.status === 'approved'
            ? 'This nursery has already been claimed'
            : 'There is already a pending claim for this nursery',
      })
    }

    // Try to find existing user or create new one
    let userId = null
    let isNewUser = false

    // Check if user already exists (targeted lookup instead of listing all users)
    const { data: existingProfile } = await db
      .from('user_profiles')
      .select('id, role')
      .eq('email', email.toLowerCase())
      .maybeSingle()

    if (existingProfile) {
      if (existingProfile.role === 'provider') {
        return res.status(409).json({
          error:
            'An account with this email already exists as a provider. Please sign in and use the claim flow.',
        })
      }
      return res.status(409).json({
        error:
          'An account with this email already exists. Please sign in at /login and claim your nursery from there.',
      })
    }

    // Create new user with email + password
    const { data: newUser, error: createErr } = await adminAuth.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: { full_name: name, phone, role_at_nursery },
    })

    if (createErr) {
      logger.error({ err: createErr.message, email }, 'providerAuth: user creation failed')
      return res.status(400).json({ error: 'Failed to create account: ' + createErr.message })
    }

    userId = newUser.user.id
    isNewUser = true

    // Upsert user profile
    const profileData = {
      id: userId,
      email,
      full_name: name,
      phone: phone || null,
      role: 'customer', // Will be promoted to 'provider' on claim approval
      updated_at: new Date().toISOString(),
    }

    if (isNewUser) {
      profileData.created_at = new Date().toISOString()
    }

    await db.from('user_profiles').upsert(profileData, { onConflict: 'id' })

    // Create nursery claim
    const { data: claim, error: claimErr } = await db
      .from('nursery_claims')
      .insert({
        user_id: userId,
        urn,
        claimer_name: name,
        claimer_email: email,
        claimer_phone: phone || null,
        claimer_role: role_at_nursery || null,
        status: 'pending',
        evidence_notes: evidence_notes || `Role: ${role_at_nursery || 'Not specified'}.`,
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (claimErr) {
      logger.error({ err: claimErr.message, userId, urn }, 'providerAuth: claim creation failed')
      return res.status(500).json({ error: 'Failed to create claim' })
    }

    // Generate email confirmation link
    const { error: confirmErr } = await adminAuth.auth.admin.generateLink({
      type: 'signup',
      email,
      password,
      options: {
        redirectTo: `${process.env.FRONTEND_URL || 'https://nurserymatch.com'}/login?confirmed=true`,
      },
    })

    if (confirmErr) {
      logger.warn({ err: confirmErr.message, email }, 'providerAuth: confirmation email failed')
      // Don't fail the registration — claim is still created
    }

    logger.info(
      { userId, urn, claimId: claim.id, isNewUser },
      'providerAuth: registration + claim created'
    )

    res.status(201).json({
      success: true,
      claim_id: claim.id,
      is_new_user: isNewUser,
      message:
        'Registration successful. Check your email to verify your account. Once verified, sign in with your email and password. Your claim will be reviewed within 24 hours.',
    })
  } catch (err) {
    logger.error({ err: err.message }, 'providerAuth: registration failed')
    next(err)
  }
})

export default router
