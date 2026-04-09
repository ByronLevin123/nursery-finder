// Enquiry message threads — nested under /api/v1/enquiries/:enquiryId/messages

import express from 'express'
import db from '../db.js'
import { requireAuth } from '../middleware/supabaseAuth.js'
import { notifyNewMessage } from '../services/notificationService.js'
import { logger } from '../logger.js'

const router = express.Router()

// Verify the caller is a participant of the enquiry.
// Returns { enquiry, role } or null.
async function verifyParticipant(enquiryId, userId) {
  if (!db) return null

  const { data: enquiry, error } = await db
    .from('enquiries')
    .select('*, nurseries(id, name, urn, claimed_by_user_id)')
    .eq('id', enquiryId)
    .maybeSingle()
  if (error || !enquiry) return null

  // Parent check
  if (enquiry.user_id === userId) {
    return { enquiry, role: 'parent' }
  }

  // Provider check — user owns the nursery
  if (enquiry.nurseries?.claimed_by_user_id === userId) {
    return { enquiry, role: 'provider' }
  }

  // Provider check — user has an approved claim
  const { data: claim } = await db
    .from('nursery_claims')
    .select('id')
    .eq('nursery_id', enquiry.nursery_id)
    .eq('user_id', userId)
    .eq('status', 'approved')
    .maybeSingle()

  if (claim) {
    return { enquiry, role: 'provider' }
  }

  return null
}

// GET /api/v1/enquiries/:enquiryId/messages
router.get('/:enquiryId/messages', requireAuth, async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })

    const result = await verifyParticipant(req.params.enquiryId, req.user.id)
    if (!result) {
      return res.status(403).json({ error: 'You are not a participant of this enquiry' })
    }

    const { data: messages, error } = await db
      .from('enquiry_messages')
      .select('*')
      .eq('enquiry_id', req.params.enquiryId)
      .order('created_at', { ascending: true })

    if (error) throw error
    return res.json({ data: messages || [] })
  } catch (err) {
    next(err)
  }
})

// POST /api/v1/enquiries/:enquiryId/messages
router.post('/:enquiryId/messages', requireAuth, async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })

    const { body: messageBody } = req.body
    if (!messageBody || typeof messageBody !== 'string' || messageBody.trim().length === 0) {
      return res.status(400).json({ error: 'Message body is required' })
    }
    if (messageBody.length > 5000) {
      return res.status(400).json({ error: 'Message body must be under 5000 characters' })
    }

    const result = await verifyParticipant(req.params.enquiryId, req.user.id)
    if (!result) {
      return res.status(403).json({ error: 'You are not a participant of this enquiry' })
    }

    const { enquiry, role } = result

    const { data: message, error } = await db
      .from('enquiry_messages')
      .insert({
        enquiry_id: req.params.enquiryId,
        sender_id: req.user.id,
        sender_role: role,
        body: messageBody.trim(),
      })
      .select()
      .single()

    if (error) throw error

    logger.info(
      { userId: req.user.id, enquiryId: req.params.enquiryId, role },
      'message sent in enquiry thread'
    )

    // Notify the other party
    const recipientId = role === 'parent' ? enquiry.nurseries?.claimed_by_user_id : enquiry.user_id

    if (recipientId) {
      // Fire-and-forget — don't block the response
      notifyNewMessage(req.params.enquiryId, message, recipientId).catch((err) => {
        logger.warn({ err: err?.message }, 'notifyNewMessage failed')
      })
    }

    return res.status(201).json(message)
  } catch (err) {
    next(err)
  }
})

// PATCH /api/v1/enquiries/:enquiryId/messages/read — mark all messages as read for current user
router.patch('/:enquiryId/messages/read', requireAuth, async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })

    const result = await verifyParticipant(req.params.enquiryId, req.user.id)
    if (!result) {
      return res.status(403).json({ error: 'You are not a participant of this enquiry' })
    }

    // Mark messages NOT sent by current user as read
    const { error } = await db
      .from('enquiry_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('enquiry_id', req.params.enquiryId)
      .neq('sender_id', req.user.id)
      .is('read_at', null)

    if (error) throw error

    logger.info({ userId: req.user.id, enquiryId: req.params.enquiryId }, 'messages marked as read')
    return res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

export default router
