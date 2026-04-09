// Visit booking routes — slot management, booking, surveys.

import express from 'express'
import db from '../db.js'
import { requireAuth } from '../middleware/supabaseAuth.js'
import { logger } from '../logger.js'
import { sendEmail, isEmailAvailable, escapeHtml } from '../services/emailService.js'

const router = express.Router()

// Helper: look up nursery by URN
async function nurseryByUrn(urn) {
  if (!db) return null
  const { data } = await db
    .from('nurseries')
    .select('id, urn, name, claimed_by_user_id, contact_email, email')
    .eq('urn', urn)
    .maybeSingle()
  return data
}

// GET /api/v1/visits/slots/:urn — public, available slots for a nursery
router.get('/slots/:urn', async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })
    const nursery = await nurseryByUrn(req.params.urn)
    if (!nursery) return res.status(404).json({ error: 'Nursery not found' })

    const today = new Date().toISOString().split('T')[0]
    const { data, error } = await db
      .from('visit_slots')
      .select('*')
      .eq('nursery_id', nursery.id)
      .gte('slot_date', today)
      .order('slot_date', { ascending: true })
      .order('slot_time', { ascending: true })

    if (error) throw error
    // Only return slots with remaining capacity
    const available = (data || []).filter((s) => s.booked < s.capacity)
    return res.json({ data: available })
  } catch (err) {
    next(err)
  }
})

// POST /api/v1/visits/book — book a slot (auth required)
router.post('/book', requireAuth, async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })

    const { slot_id, nursery_id, notes } = req.body
    if (!slot_id) return res.status(400).json({ error: 'slot_id is required' })
    if (!nursery_id) return res.status(400).json({ error: 'nursery_id is required' })

    // Check slot exists and has capacity
    const { data: slot, error: slotErr } = await db
      .from('visit_slots')
      .select('*')
      .eq('id', slot_id)
      .maybeSingle()
    if (slotErr) throw slotErr
    if (!slot) return res.status(404).json({ error: 'Slot not found' })
    if (slot.booked >= slot.capacity) {
      return res.status(409).json({ error: 'Slot is fully booked' })
    }

    // Increment booked count
    const { error: updateErr } = await db
      .from('visit_slots')
      .update({ booked: slot.booked + 1 })
      .eq('id', slot_id)
    if (updateErr) throw updateErr

    // Create booking
    const { data: booking, error: bookErr } = await db
      .from('visit_bookings')
      .insert({
        slot_id,
        user_id: req.user.id,
        nursery_id,
        notes: notes || null,
        status: 'confirmed',
      })
      .select()
      .single()
    if (bookErr) throw bookErr

    logger.info({ userId: req.user.id, slotId: slot_id, bookingId: booking.id }, 'visit booked')

    // Send confirmation emails (non-blocking)
    if (isEmailAvailable()) {
      try {
        const { data: nursery } = await db
          .from('nurseries')
          .select('name, contact_email, email')
          .eq('id', nursery_id)
          .maybeSingle()

        // Email to parent
        await sendEmail({
          to: req.user.email,
          subject: `Visit confirmed — ${nursery?.name || 'Nursery'}`,
          html: `<p>Your visit to <strong>${escapeHtml(nursery?.name)}</strong> is confirmed.</p>
<p><strong>Date:</strong> ${escapeHtml(slot.slot_date)}</p>
<p><strong>Time:</strong> ${escapeHtml(slot.slot_time)}</p>
<p><strong>Duration:</strong> ${slot.duration_min} minutes</p>
${notes ? `<p><strong>Notes:</strong> ${escapeHtml(notes)}</p>` : ''}`,
          text: `Visit confirmed for ${nursery?.name}\nDate: ${slot.slot_date}\nTime: ${slot.slot_time}`,
        })

        // Email to nursery
        const nurseryEmail = nursery?.contact_email || nursery?.email
        if (nurseryEmail) {
          await sendEmail({
            to: nurseryEmail,
            subject: `New visit booking — ${nursery?.name || 'Nursery'}`,
            html: `<p>A parent has booked a visit at <strong>${escapeHtml(nursery?.name)}</strong>.</p>
<p><strong>Date:</strong> ${escapeHtml(slot.slot_date)}</p>
<p><strong>Time:</strong> ${escapeHtml(slot.slot_time)}</p>
${notes ? `<p><strong>Notes:</strong> ${escapeHtml(notes)}</p>` : ''}`,
            text: `New visit booking at ${nursery?.name}\nDate: ${slot.slot_date}\nTime: ${slot.slot_time}`,
            replyTo: req.user.email,
          })
        }
      } catch (emailErr) {
        logger.warn({ err: emailErr.message }, 'visit confirmation email failed')
      }
    }

    return res.status(201).json(booking)
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/visits/mine — user's bookings
router.get('/mine', requireAuth, async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })

    const { data, error } = await db
      .from('visit_bookings')
      .select('*, visit_slots(*), nurseries(name, urn, town)')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })

    if (error) throw error
    return res.json({ data: data || [] })
  } catch (err) {
    next(err)
  }
})

// DELETE /api/v1/visits/:id — cancel a booking
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })

    const { data: booking, error: bErr } = await db
      .from('visit_bookings')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .maybeSingle()
    if (bErr) throw bErr
    if (!booking) return res.status(404).json({ error: 'Booking not found' })
    if (booking.status === 'cancelled') {
      return res.status(400).json({ error: 'Already cancelled' })
    }

    // Update status
    const { error: uErr } = await db
      .from('visit_bookings')
      .update({ status: 'cancelled' })
      .eq('id', req.params.id)
    if (uErr) throw uErr

    // Decrement booked count on slot
    if (booking.slot_id) {
      const { data: slot } = await db
        .from('visit_slots')
        .select('booked')
        .eq('id', booking.slot_id)
        .maybeSingle()
      if (slot && slot.booked > 0) {
        await db
          .from('visit_slots')
          .update({ booked: slot.booked - 1 })
          .eq('id', booking.slot_id)
      }
    }

    logger.info({ userId: req.user.id, bookingId: req.params.id }, 'visit cancelled')
    return res.json({ status: 'cancelled' })
  } catch (err) {
    next(err)
  }
})

// POST /api/v1/visits/:id/survey — submit post-visit survey
router.post('/:id/survey', requireAuth, async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })

    const { data: booking, error: bErr } = await db
      .from('visit_bookings')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .maybeSingle()
    if (bErr) throw bErr
    if (!booking) return res.status(404).json({ error: 'Booking not found' })

    const { overall_impression, staff_friendliness, facilities_quality, would_apply, feedback } =
      req.body

    if (
      overall_impression != null &&
      (typeof overall_impression !== 'number' || overall_impression < 1 || overall_impression > 5)
    ) {
      return res.status(400).json({ error: 'overall_impression must be 1-5' })
    }

    const { data: survey, error: sErr } = await db
      .from('visit_surveys')
      .insert({
        booking_id: booking.id,
        user_id: req.user.id,
        nursery_id: booking.nursery_id,
        overall_impression: overall_impression || null,
        staff_friendliness: staff_friendliness || null,
        facilities_quality: facilities_quality || null,
        would_apply: would_apply != null ? would_apply : null,
        feedback: feedback || null,
      })
      .select()
      .single()
    if (sErr) throw sErr

    // Mark booking as completed if not already
    if (booking.status !== 'completed') {
      await db.from('visit_bookings').update({ status: 'completed' }).eq('id', booking.id)
    }

    logger.info({ userId: req.user.id, bookingId: booking.id }, 'visit survey submitted')
    return res.status(201).json(survey)
  } catch (err) {
    next(err)
  }
})

export default router
