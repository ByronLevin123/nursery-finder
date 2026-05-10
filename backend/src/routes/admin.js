// Admin dashboard API — stats, user management, claims, reviews, enquiries, subscriptions.
// ALL routes require requireRole('admin').

import express from 'express'
import db from '../db.js'
import { requireRole } from '../middleware/supabaseAuth.js'
import { logger } from '../logger.js'
import { escapeLike } from '../utils.js'

const router = express.Router()

// Every route on this router requires admin role
router.use(requireRole('admin'))

// ---------------------------------------------------------------------------
// Helper: parse pagination params
// ---------------------------------------------------------------------------
function paginate(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20))
  const offset = (page - 1) * limit
  return { page, limit, offset }
}

function paginationMeta(total, page, limit) {
  return { total, page, limit, pages: Math.ceil(total / limit) || 1 }
}

// ---------------------------------------------------------------------------
// GET /stats — dashboard summary numbers
// ---------------------------------------------------------------------------
router.get('/stats', async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })

    // Run all count queries in parallel
    const [
      usersTotal,
      usersCustomers,
      usersProviders,
      usersAdmins,
      nurseriesTotal,
      nurseriesClaimed,
      nurseriesFeatured,
      claimsPending,
      claimsApproved,
      claimsRejected,
      reviewsPending,
      reviewsApproved,
      reviewsFlagged,
      providerPro,
      providerPremium,
      parentPremium,
      enquiriesTotal,
      enquiriesThisMonth,
      visitsTotal,
      visitsThisMonth,
    ] = await Promise.all([
      db.from('user_profiles').select('id', { count: 'exact', head: true }),
      db.from('user_profiles').select('id', { count: 'exact', head: true }).eq('role', 'customer'),
      db.from('user_profiles').select('id', { count: 'exact', head: true }).eq('role', 'provider'),
      db.from('user_profiles').select('id', { count: 'exact', head: true }).eq('role', 'admin'),
      db.from('nurseries').select('id', { count: 'exact', head: true }),
      db
        .from('nurseries')
        .select('id', { count: 'exact', head: true })
        .not('claimed_by_user_id', 'is', null),
      db.from('nurseries').select('id', { count: 'exact', head: true }).eq('featured', true),
      db
        .from('nursery_claims')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending'),
      db
        .from('nursery_claims')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'approved'),
      db
        .from('nursery_claims')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'rejected'),
      db
        .from('nursery_reviews')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending'),
      db
        .from('nursery_reviews')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'published'),
      db
        .from('nursery_reviews')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'flagged'),
      db
        .from('provider_subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('tier', 'pro')
        .eq('status', 'active'),
      db
        .from('provider_subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('tier', 'premium')
        .eq('status', 'active'),
      db
        .from('parent_subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('tier', 'premium')
        .eq('status', 'active'),
      db.from('enquiries').select('id', { count: 'exact', head: true }),
      db
        .from('enquiries')
        .select('id', { count: 'exact', head: true })
        .gte('sent_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
      db.from('visit_bookings').select('id', { count: 'exact', head: true }),
      db
        .from('visit_bookings')
        .select('id', { count: 'exact', head: true })
        .gte(
          'created_at',
          new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
        ),
    ])

    const proCount = providerPro.count ?? 0
    const premiumCount = providerPremium.count ?? 0
    const parentPremCount = parentPremium.count ?? 0
    const mrr_gbp = proCount * 29 + premiumCount * 79 + parentPremCount * 4.99

    const stats = {
      users: {
        total: usersTotal.count ?? 0,
        customers: usersCustomers.count ?? 0,
        providers: usersProviders.count ?? 0,
        admins: usersAdmins.count ?? 0,
      },
      nurseries: {
        total: nurseriesTotal.count ?? 0,
        claimed: nurseriesClaimed.count ?? 0,
        featured: nurseriesFeatured.count ?? 0,
      },
      claims: {
        pending: claimsPending.count ?? 0,
        approved: claimsApproved.count ?? 0,
        rejected: claimsRejected.count ?? 0,
      },
      reviews: {
        pending: reviewsPending.count ?? 0,
        approved: reviewsApproved.count ?? 0,
        flagged: reviewsFlagged.count ?? 0,
      },
      subscriptions: {
        provider_pro: proCount,
        provider_premium: premiumCount,
        parent_premium: parentPremCount,
        mrr_gbp: Math.round(mrr_gbp * 100) / 100,
      },
      enquiries: {
        total: enquiriesTotal.count ?? 0,
        this_month: enquiriesThisMonth.count ?? 0,
      },
      visits: {
        total_booked: visitsTotal.count ?? 0,
        this_month: visitsThisMonth.count ?? 0,
      },
    }

    logger.info('admin stats fetched')
    return res.json(stats)
  } catch (err) {
    logger.error({ err: err?.message }, 'admin stats failed')
    next(err)
  }
})

// ---------------------------------------------------------------------------
// GET /users — paginated user list
// ---------------------------------------------------------------------------
router.get('/users', async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })
    const { page, limit, offset } = paginate(req.query)
    const { role, search } = req.query

    let query = db
      .from('user_profiles')
      .select('id, display_name, role, created_at', { count: 'exact' })

    if (role) {
      query = query.eq('role', role)
    }
    if (search) {
      // Search by display_name (email is not in user_profiles — see note below)
      query = query.ilike('display_name', `%${escapeLike(search)}%`)
    }

    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1)

    const { data, error, count } = await query
    if (error) throw error

    // NOTE: auth.users is not directly queryable via the Supabase client data API.
    // Email is available on req.user from the JWT but not joinable here.
    // We return the user_profiles fields; email lookup would require Supabase Admin API
    // or a database view. The frontend can display display_name + role.

    logger.info({ page, limit, role, search }, 'admin users list')
    return res.json({
      data: data || [],
      meta: paginationMeta(count ?? 0, page, limit),
    })
  } catch (err) {
    logger.error({ err: err?.message }, 'admin users list failed')
    next(err)
  }
})

// ---------------------------------------------------------------------------
// PATCH /users/:id/role — update user role
// ---------------------------------------------------------------------------
router.patch('/users/:id/role', async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })
    const { id } = req.params
    const { role } = req.body || {}
    const validRoles = ['customer', 'provider', 'admin']
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: `role must be one of: ${validRoles.join(', ')}` })
    }

    const { data, error } = await db
      .from('user_profiles')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id, display_name, role, updated_at')
      .single()
    if (error) throw error
    if (!data) return res.status(404).json({ error: 'User not found' })

    logger.info({ userId: id, newRole: role, by: req.user.id }, 'admin updated user role')
    return res.json(data)
  } catch (err) {
    logger.error({ err: err?.message }, 'admin update user role failed')
    next(err)
  }
})

// ---------------------------------------------------------------------------
// GET /claims — paginated claims list with nursery name
// ---------------------------------------------------------------------------
router.get('/claims', async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })
    const { page, limit, offset } = paginate(req.query)
    const { status } = req.query

    let query = db
      .from('nursery_claims')
      .select(
        'id, urn, claimer_name, claimer_email, claimer_role, evidence_notes, status, created_at',
        { count: 'exact' }
      )

    if (status) {
      query = query.eq('status', status)
    }

    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1)

    const { data, error, count } = await query
    if (error) throw error

    // Look up nursery names for each claim's URN
    const urns = [...new Set((data || []).map((r) => r.urn).filter(Boolean))]
    let nurseryNames = {}
    if (urns.length > 0) {
      const { data: nurseries } = await db.from('nurseries').select('urn, name').in('urn', urns)
      if (nurseries) {
        nurseryNames = Object.fromEntries(nurseries.map((n) => [n.urn, n.name]))
      }
    }

    const rows = (data || []).map((row) => ({
      id: row.id,
      urn: row.urn,
      nursery_name: nurseryNames[row.urn] ?? null,
      claimer_name: row.claimer_name,
      claimer_email: row.claimer_email,
      claimer_role: row.claimer_role,
      evidence_notes: row.evidence_notes,
      status: row.status,
      created_at: row.created_at,
    }))

    logger.info({ page, limit, status }, 'admin claims list')
    return res.json({
      data: rows,
      meta: paginationMeta(count ?? 0, page, limit),
    })
  } catch (err) {
    logger.error({ err: err?.message }, 'admin claims list failed')
    next(err)
  }
})

// ---------------------------------------------------------------------------
// PATCH /claims/:id — approve or reject a claim
// ---------------------------------------------------------------------------
router.patch('/claims/:id', async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })
    const { id } = req.params
    const { status, admin_notes } = req.body || {}

    const validStatuses = ['approved', 'rejected']
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` })
    }

    // Fetch the claim first
    const { data: claim, error: claimErr } = await db
      .from('nursery_claims')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (claimErr) throw claimErr
    if (!claim) return res.status(404).json({ error: 'Claim not found' })

    const now = new Date().toISOString()
    const updateFields = {
      status,
      admin_notes: admin_notes || claim.admin_notes || null,
    }

    if (status === 'approved') {
      updateFields.approved_by = req.user.id
      updateFields.approved_at = now
    }

    const { data: updated, error: updateErr } = await db
      .from('nursery_claims')
      .update(updateFields)
      .eq('id', id)
      .select()
      .single()
    if (updateErr) throw updateErr

    // If approved: update nursery claimed_by fields + promote user to provider
    if (status === 'approved') {
      const { error: nErr } = await db
        .from('nurseries')
        .update({ claimed_by_user_id: claim.user_id, claimed_at: now })
        .eq('urn', claim.urn)
      if (nErr) {
        logger.warn({ err: nErr.message, claimId: id }, 'failed to update nursery claimed_by')
      }

      const { error: roleErr } = await db
        .from('user_profiles')
        .update({ role: 'provider', updated_at: now })
        .eq('id', claim.user_id)
      if (roleErr) {
        logger.warn({ err: roleErr.message, claimId: id }, 'failed to promote user to provider')
      }
    }

    logger.info({ claimId: id, status, by: req.user.id }, `admin claim ${status}`)
    return res.json(updated)
  } catch (err) {
    logger.error({ err: err?.message }, 'admin claim update failed')
    next(err)
  }
})

// ---------------------------------------------------------------------------
// GET /reviews — paginated review moderation list
// ---------------------------------------------------------------------------
router.get('/reviews', async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })
    const { page, limit, offset } = paginate(req.query)
    const { status } = req.query

    let query = db
      .from('nursery_reviews')
      .select(
        'id, urn, author_display_name, rating, title, body, status, admin_note, moderated_at, created_at, nurseries!nursery_reviews_urn_fkey(name)',
        { count: 'exact' }
      )

    if (status) {
      query = query.eq('status', status)
    }

    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1)

    const { data, error, count } = await query
    if (error) {
      // If the foreign key join fails, fall back to a simpler query without join
      logger.warn({ err: error.message }, 'reviews join failed, falling back to simple query')
      let fallbackQuery = db
        .from('nursery_reviews')
        .select(
          'id, urn, author_display_name, rating, title, body, status, admin_note, moderated_at, created_at',
          {
            count: 'exact',
          }
        )
      if (status) {
        fallbackQuery = fallbackQuery.eq('status', status)
      }
      fallbackQuery = fallbackQuery
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      const { data: fbData, error: fbError, count: fbCount } = await fallbackQuery
      if (fbError) throw fbError

      const rows = (fbData || []).map((row) => ({
        ...row,
        nursery_name: null,
      }))
      return res.json({
        data: rows,
        meta: paginationMeta(fbCount ?? 0, page, limit),
      })
    }

    const rows = (data || []).map((row) => {
      const nurseries = row['nurseries!nursery_reviews_urn_fkey'] || row.nurseries
      return {
        id: row.id,
        urn: row.urn,
        nursery_name: nurseries?.name ?? null,
        author_display_name: row.author_display_name,
        rating: row.rating,
        title: row.title,
        body: row.body,
        status: row.status,
        admin_note: row.admin_note ?? null,
        moderated_at: row.moderated_at ?? null,
        created_at: row.created_at,
      }
    })

    logger.info({ page, limit, status }, 'admin reviews list')
    return res.json({
      data: rows,
      meta: paginationMeta(count ?? 0, page, limit),
    })
  } catch (err) {
    logger.error({ err: err?.message }, 'admin reviews list failed')
    next(err)
  }
})

// ---------------------------------------------------------------------------
// PATCH /reviews/:id — moderate a review
// ---------------------------------------------------------------------------
router.patch('/reviews/:id', async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })
    const { id } = req.params
    const { status, admin_note } = req.body || {}

    const validStatuses = ['approved', 'rejected', 'flagged']
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` })
    }

    const now = new Date().toISOString()
    const updateFields = { status, moderated_at: now }

    // Map 'approved' to 'published' which is the actual DB status value for live reviews
    if (status === 'approved') {
      updateFields.status = 'published'
    }

    if (admin_note !== undefined) {
      updateFields.admin_note = admin_note || null
    }

    if (status === 'flagged') {
      updateFields.flagged_at = now
      updateFields.flagged_by = req.user.id
    }

    const { data, error } = await db
      .from('nursery_reviews')
      .update(updateFields)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    if (!data) return res.status(404).json({ error: 'Review not found' })

    logger.info({ reviewId: id, status, by: req.user.id }, `admin review ${status}`)
    return res.json(data)
  } catch (err) {
    logger.error({ err: err?.message }, 'admin review update failed')
    next(err)
  }
})

// ---------------------------------------------------------------------------
// GET /enquiries — paginated enquiry list with filters
// ---------------------------------------------------------------------------
router.get('/enquiries', async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })
    const { page, limit, offset } = paginate(req.query)
    const { status, nursery_id, claimed, from, to } = req.query

    let query = db
      .from('enquiries')
      .select(
        'id, user_id, nursery_id, child_name, child_dob, preferred_start, session_preference, message, status, requires_admin_review, sent_at, responded_at',
        { count: 'exact' }
      )

    if (status) query = query.eq('status', status)
    if (nursery_id) query = query.eq('nursery_id', nursery_id)
    if (from) query = query.gte('sent_at', from)
    if (to) query = query.lte('sent_at', to)
    if (claimed === 'true') query = query.eq('requires_admin_review', false)
    if (claimed === 'false') query = query.eq('requires_admin_review', true)

    query = query.order('sent_at', { ascending: false }).range(offset, offset + limit - 1)

    const { data, error, count } = await query
    if (error) throw error

    // Look up nursery names + claimed status
    const nurseryIds = [...new Set((data || []).map((r) => r.nursery_id).filter(Boolean))]
    let nurseryMap = {}
    if (nurseryIds.length > 0) {
      const { data: nurseries } = await db
        .from('nurseries')
        .select('id, name, urn, claimed_by_user_id')
        .in('id', nurseryIds)
      if (nurseries) {
        nurseryMap = Object.fromEntries(nurseries.map((n) => [n.id, n]))
      }
    }

    // Look up parent display names
    const userIds = [...new Set((data || []).map((r) => r.user_id).filter(Boolean))]
    let userMap = {}
    if (userIds.length > 0) {
      const { data: profiles } = await db
        .from('user_profiles')
        .select('id, display_name')
        .in('id', userIds)
      if (profiles) {
        userMap = Object.fromEntries(profiles.map((p) => [p.id, p.display_name]))
      }
    }

    const rows = (data || []).map((row) => {
      const nursery = nurseryMap[row.nursery_id] || {}
      return {
        id: row.id,
        user_id: row.user_id,
        parent_name: userMap[row.user_id] ?? null,
        nursery_id: row.nursery_id,
        nursery_name: nursery.name ?? null,
        nursery_urn: nursery.urn ?? null,
        nursery_claimed: !!nursery.claimed_by_user_id,
        child_name: row.child_name,
        message: row.message,
        status: row.status,
        requires_admin_review: row.requires_admin_review ?? false,
        sent_at: row.sent_at,
        responded_at: row.responded_at,
      }
    })

    logger.info({ page, limit, status, claimed }, 'admin enquiries list')
    return res.json({
      data: rows,
      meta: paginationMeta(count ?? 0, page, limit),
    })
  } catch (err) {
    logger.error({ err: err?.message }, 'admin enquiries list failed')
    next(err)
  }
})

// ---------------------------------------------------------------------------
// GET /bookings — paginated visit bookings list with filters
// ---------------------------------------------------------------------------
router.get('/bookings', async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })
    const { page, limit, offset } = paginate(req.query)
    const { status, nursery_id, from, to } = req.query

    let query = db
      .from('visit_bookings')
      .select('id, user_id, nursery_id, slot_date, slot_time, status, notes, created_at', {
        count: 'exact',
      })

    if (status) query = query.eq('status', status)
    if (nursery_id) query = query.eq('nursery_id', nursery_id)
    if (from) query = query.gte('slot_date', from)
    if (to) query = query.lte('slot_date', to)

    query = query.order('slot_date', { ascending: false }).range(offset, offset + limit - 1)

    const { data, error, count } = await query
    if (error) throw error

    // Look up nursery names
    const nurseryIds = [...new Set((data || []).map((r) => r.nursery_id).filter(Boolean))]
    let nurseryMap = {}
    if (nurseryIds.length > 0) {
      const { data: nurseries } = await db
        .from('nurseries')
        .select('id, name, urn')
        .in('id', nurseryIds)
      if (nurseries) {
        nurseryMap = Object.fromEntries(nurseries.map((n) => [n.id, n]))
      }
    }

    // Look up parent display names
    const userIds = [...new Set((data || []).map((r) => r.user_id).filter(Boolean))]
    let userMap = {}
    if (userIds.length > 0) {
      const { data: profiles } = await db
        .from('user_profiles')
        .select('id, display_name')
        .in('id', userIds)
      if (profiles) {
        userMap = Object.fromEntries(profiles.map((p) => [p.id, p.display_name]))
      }
    }

    const rows = (data || []).map((row) => {
      const nursery = nurseryMap[row.nursery_id] || {}
      return {
        id: row.id,
        user_id: row.user_id,
        parent_name: userMap[row.user_id] ?? null,
        nursery_id: row.nursery_id,
        nursery_name: nursery.name ?? null,
        nursery_urn: nursery.urn ?? null,
        slot_date: row.slot_date,
        slot_time: row.slot_time,
        status: row.status,
        notes: row.notes,
        created_at: row.created_at,
      }
    })

    logger.info({ page, limit, status }, 'admin bookings list')
    return res.json({
      data: rows,
      meta: paginationMeta(count ?? 0, page, limit),
    })
  } catch (err) {
    logger.error({ err: err?.message }, 'admin bookings list failed')
    next(err)
  }
})

// ---------------------------------------------------------------------------
// GET /subscriptions — paginated provider subscription list
// ---------------------------------------------------------------------------
router.get('/subscriptions', async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })
    const { page, limit, offset } = paginate(req.query)

    const { data, error, count } = await db
      .from('provider_subscriptions')
      .select('id, user_id, tier, status, current_period_end, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error

    // Look up display names for each subscription's user
    const userIds = [...new Set((data || []).map((r) => r.user_id).filter(Boolean))]
    let displayNames = {}
    if (userIds.length > 0) {
      const { data: profiles } = await db
        .from('user_profiles')
        .select('id, display_name')
        .in('id', userIds)
      if (profiles) {
        displayNames = Object.fromEntries(profiles.map((p) => [p.id, p.display_name]))
      }
    }

    const rows = (data || []).map((s) => ({
      id: s.id,
      user_id: s.user_id,
      display_name: displayNames[s.user_id] ?? null,
      type: 'provider',
      tier: s.tier,
      status: s.status,
      current_period_end: s.current_period_end,
      created_at: s.created_at,
    }))

    logger.info({ page, limit }, 'admin subscriptions list')
    return res.json({
      data: rows,
      meta: paginationMeta(count ?? 0, page, limit),
    })
  } catch (err) {
    logger.error({ err: err?.message }, 'admin subscriptions list failed')
    next(err)
  }
})

// ---------------------------------------------------------------------------
// GET /ofsted-changes — recent Ofsted grade changes
// ---------------------------------------------------------------------------
router.get('/ofsted-changes', async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })
    const { page, limit, offset } = paginate(req.query)
    const { notified } = req.query

    let query = db
      .from('ofsted_changes')
      .select('id, nursery_urn, previous_grade, new_grade, change_date, notified', {
        count: 'exact',
      })

    if (notified === 'true') {
      query = query.eq('notified', true)
    } else if (notified === 'false') {
      query = query.eq('notified', false)
    }

    query = query.order('change_date', { ascending: false }).range(offset, offset + limit - 1)

    const { data, error, count } = await query
    if (error) throw error

    // Enrich with nursery names
    const urns = [...new Set((data || []).map((r) => r.nursery_urn).filter(Boolean))]
    let nurseryMap = {}
    if (urns.length > 0) {
      const { data: nurseries } = await db
        .from('nurseries')
        .select('urn, name, town, postcode')
        .in('urn', urns)
      if (nurseries) {
        nurseryMap = Object.fromEntries(nurseries.map((n) => [n.urn, n]))
      }
    }

    const rows = (data || []).map((row) => {
      const nursery = nurseryMap[row.nursery_urn] || {}
      return {
        id: row.id,
        nursery_urn: row.nursery_urn,
        nursery_name: nursery.name ?? null,
        nursery_town: nursery.town ?? null,
        nursery_postcode: nursery.postcode ?? null,
        previous_grade: row.previous_grade,
        new_grade: row.new_grade,
        change_date: row.change_date,
        notified: row.notified,
      }
    })

    logger.info({ page, limit, notified }, 'admin ofsted-changes list')
    return res.json({
      data: rows,
      meta: paginationMeta(count ?? 0, page, limit),
    })
  } catch (err) {
    logger.error({ err: err?.message }, 'admin ofsted-changes list failed')
    next(err)
  }
})

// ---------------------------------------------------------------------------
// GET /stats/growth — growth metrics (week + month)
// ---------------------------------------------------------------------------
router.get('/stats/growth', async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })

    const now = new Date()
    const oneWeekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()
    const oneMonthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString()

    const [
      nurseriesWeek,
      nurseriesMonth,
      usersWeek,
      usersMonth,
      reviewsWeek,
      reviewsMonth,
      claimsWeek,
      claimsMonth,
    ] = await Promise.all([
      db
        .from('nurseries')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', oneWeekAgo),
      db
        .from('nurseries')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', oneMonthAgo),
      db
        .from('user_profiles')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', oneWeekAgo),
      db
        .from('user_profiles')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', oneMonthAgo),
      db
        .from('nursery_reviews')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', oneWeekAgo),
      db
        .from('nursery_reviews')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', oneMonthAgo),
      db
        .from('nursery_claims')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', oneWeekAgo),
      db
        .from('nursery_claims')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', oneMonthAgo),
    ])

    const growth = {
      nurseries: {
        this_week: nurseriesWeek.count ?? 0,
        this_month: nurseriesMonth.count ?? 0,
      },
      users: {
        this_week: usersWeek.count ?? 0,
        this_month: usersMonth.count ?? 0,
      },
      reviews: {
        this_week: reviewsWeek.count ?? 0,
        this_month: reviewsMonth.count ?? 0,
      },
      claims: {
        this_week: claimsWeek.count ?? 0,
        this_month: claimsMonth.count ?? 0,
      },
    }

    logger.info('admin stats/growth fetched')
    return res.json(growth)
  } catch (err) {
    logger.error({ err: err?.message }, 'admin stats/growth failed')
    next(err)
  }
})

// ---------------------------------------------------------------------------
// GET /stats/data-quality — data quality warnings
// ---------------------------------------------------------------------------
router.get('/stats/data-quality', async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })

    const [noLocation, noGrade, staleInspection, pendingReviews] = await Promise.all([
      db.from('nurseries').select('id', { count: 'exact', head: true }).is('lat', null),
      db
        .from('nurseries')
        .select('id', { count: 'exact', head: true })
        .is('ofsted_overall_grade', null),
      db
        .from('nurseries')
        .select('id', { count: 'exact', head: true })
        .eq('inspection_date_warning', true),
      db
        .from('nursery_reviews')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending'),
    ])

    const quality = {
      nurseries_no_location: noLocation.count ?? 0,
      nurseries_no_grade: noGrade.count ?? 0,
      nurseries_stale_inspection: staleInspection.count ?? 0,
      reviews_pending_moderation: pendingReviews.count ?? 0,
    }

    logger.info('admin stats/data-quality fetched')
    return res.json(quality)
  } catch (err) {
    logger.error({ err: err?.message }, 'admin stats/data-quality failed')
    next(err)
  }
})

// ---------------------------------------------------------------------------
// GET /analytics — enhanced analytics dashboard data
// ---------------------------------------------------------------------------
router.get('/analytics', async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })

    const now = new Date()
    const oneWeekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()
    const oneMonthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString()
    const fourYearsAgo = new Date(now.getFullYear() - 4, now.getMonth(), now.getDate())
      .toISOString()
      .split('T')[0]

    // Run all queries in parallel for speed
    const [
      // Overview counts
      nurseriesTotal,
      usersTotal,
      reviewsTotal,
      claimsTotal,
      claimsPending,
      claimsApproved,
      claimsRejected,
      providersTotal,

      // Growth — users
      usersThisWeek,
      usersThisMonth,

      // Growth — reviews
      reviewsThisWeek,
      reviewsThisMonth,

      // Growth — claims
      claimsThisWeek,
      claimsThisMonth,

      // Data quality
      nurseriesNoGeo,
      nurseriesStale,
      nurseriesEnforcement,

      // Provider stats
      providersPaid,
      providersFree,
      photosTotal,
      feesTotal,

      // Email stats
      emailsThisWeek,
      emailsThisMonth,
      emailsByTemplate,
    ] = await Promise.all([
      // Overview
      db.from('nurseries').select('id', { count: 'exact', head: true }),
      db.from('user_profiles').select('id', { count: 'exact', head: true }),
      db.from('nursery_reviews').select('id', { count: 'exact', head: true }),
      db.from('nursery_claims').select('id', { count: 'exact', head: true }),
      db
        .from('nursery_claims')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending'),
      db
        .from('nursery_claims')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'approved'),
      db
        .from('nursery_claims')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'rejected'),
      db.from('user_profiles').select('id', { count: 'exact', head: true }).eq('role', 'provider'),

      // Growth — users
      db
        .from('user_profiles')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', oneWeekAgo),
      db
        .from('user_profiles')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', oneMonthAgo),

      // Growth — reviews
      db
        .from('nursery_reviews')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', oneWeekAgo),
      db
        .from('nursery_reviews')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', oneMonthAgo),

      // Growth — claims
      db
        .from('nursery_claims')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', oneWeekAgo),
      db
        .from('nursery_claims')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', oneMonthAgo),

      // Data quality — nurseries without geocoding (lat/lng is null)
      db.from('nurseries').select('id', { count: 'exact', head: true }).is('lat', null),
      // Stale inspections (>4 years) — use the boolean flag
      db
        .from('nurseries')
        .select('id', { count: 'exact', head: true })
        .eq('inspection_date_warning', true),
      // Enforcement notices
      db
        .from('nurseries')
        .select('id', { count: 'exact', head: true })
        .eq('enforcement_notice', true),

      // Provider stats — paid (have active subscription)
      db
        .from('provider_subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active'),
      // Free providers — providers without active subscription (we count provider role users)
      db.from('user_profiles').select('id', { count: 'exact', head: true }).eq('role', 'provider'),
      // Photos uploaded
      db.from('nursery_photos').select('id', { count: 'exact', head: true }),
      // Fees published
      db.from('nursery_fees').select('id', { count: 'exact', head: true }),

      // Email stats
      db
        .from('email_log')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', oneWeekAgo),
      db
        .from('email_log')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', oneMonthAgo),
      // Top email templates this month
      db.from('email_log').select('template').gte('created_at', oneMonthAgo).limit(500),
    ])

    // Count emails by template
    const templateCounts = {}
    if (emailsByTemplate.data) {
      for (const row of emailsByTemplate.data) {
        templateCounts[row.template] = (templateCounts[row.template] || 0) + 1
      }
    }

    const paidProviders = providersPaid.count ?? 0
    const totalProviders = providersFree.count ?? 0
    const freeProviders = Math.max(0, totalProviders - paidProviders)

    const analytics = {
      overview: {
        total_nurseries: nurseriesTotal.count ?? 0,
        total_users: usersTotal.count ?? 0,
        total_reviews: reviewsTotal.count ?? 0,
        total_claims: claimsTotal.count ?? 0,
        claims_pending: claimsPending.count ?? 0,
        claims_approved: claimsApproved.count ?? 0,
        claims_rejected: claimsRejected.count ?? 0,
        total_providers: providersTotal.count ?? 0,
      },
      growth: {
        users_this_week: usersThisWeek.count ?? 0,
        users_this_month: usersThisMonth.count ?? 0,
        reviews_this_week: reviewsThisWeek.count ?? 0,
        reviews_this_month: reviewsThisMonth.count ?? 0,
        claims_this_week: claimsThisWeek.count ?? 0,
        claims_this_month: claimsThisMonth.count ?? 0,
      },
      data_quality: {
        nurseries_no_geocoding: nurseriesNoGeo.count ?? 0,
        nurseries_stale_inspection: nurseriesStale.count ?? 0,
        nurseries_enforcement: nurseriesEnforcement.count ?? 0,
      },
      providers: {
        paid: paidProviders,
        free: freeProviders,
        total_photos: photosTotal.count ?? 0,
        total_fees: feesTotal.count ?? 0,
      },
      emails: {
        sent_this_week: emailsThisWeek.count ?? 0,
        sent_this_month: emailsThisMonth.count ?? 0,
        by_template: templateCounts,
      },
    }

    logger.info('admin analytics fetched')
    return res.json(analytics)
  } catch (err) {
    logger.error({ err: err?.message }, 'admin analytics failed')
    next(err)
  }
})

// ---------------------------------------------------------------------------
// GET /activity — recent activity feed (reviews, claims, signups merged)
// ---------------------------------------------------------------------------
router.get('/activity', async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })

    const limitParam = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20))

    // Fetch recent items from each table in parallel
    const [recentReviews, recentClaims, recentSignups] = await Promise.all([
      db
        .from('nursery_reviews')
        .select('id, urn, author_display_name, rating, title, status, created_at')
        .order('created_at', { ascending: false })
        .limit(limitParam),
      db
        .from('nursery_claims')
        .select('id, urn, claimer_name, claimer_email, status, created_at')
        .order('created_at', { ascending: false })
        .limit(limitParam),
      db
        .from('user_profiles')
        .select('id, display_name, role, created_at')
        .order('created_at', { ascending: false })
        .limit(limitParam),
    ])

    // Map each to a unified activity item
    const activities = []

    if (recentReviews.data) {
      for (const r of recentReviews.data) {
        activities.push({
          type: 'review',
          date: r.created_at,
          description: `${r.author_display_name || 'Anonymous'} left a ${r.rating}-star review${r.title ? `: "${r.title}"` : ''}`,
          status: r.status,
          link: `/admin/reviews`,
          meta: { id: r.id, urn: r.urn },
        })
      }
    }

    if (recentClaims.data) {
      for (const c of recentClaims.data) {
        activities.push({
          type: 'claim',
          date: c.created_at,
          description: `${c.claimer_name || c.claimer_email || 'Someone'} submitted a claim for nursery ${c.urn}`,
          status: c.status,
          link: `/admin/claims`,
          meta: { id: c.id, urn: c.urn },
        })
      }
    }

    if (recentSignups.data) {
      for (const u of recentSignups.data) {
        activities.push({
          type: 'signup',
          date: u.created_at,
          description: `${u.display_name || 'New user'} signed up as ${u.role}`,
          status: null,
          link: `/admin/users`,
          meta: { id: u.id, role: u.role },
        })
      }
    }

    // Sort by date descending, then take the top N
    activities.sort((a, b) => new Date(b.date) - new Date(a.date))
    const trimmed = activities.slice(0, limitParam)

    logger.info({ count: trimmed.length }, 'admin activity feed fetched')
    return res.json({ data: trimmed })
  } catch (err) {
    logger.error({ err: err?.message }, 'admin activity feed failed')
    next(err)
  }
})

// ---------------------------------------------------------------------------
// GET /reports — admin platform reports (revenue, growth, coverage)
// ---------------------------------------------------------------------------
router.get('/reports', async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })

    const { range = '90' } = req.query
    const days = parseInt(range) || 90
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    const startDateStr = startDate.toISOString().split('T')[0]

    // Fetch cached admin reports
    const { data: reports, error } = await db
      .from('admin_reports_cache')
      .select('*')
      .gte('report_date', startDateStr)
      .order('report_date', { ascending: true })

    if (error) throw error

    // Compute latest snapshot + timeseries
    const timeseries = (reports || []).map((r) => ({
      date: r.report_date,
      total_users: r.total_users,
      new_users: r.new_users,
      total_providers: r.total_providers,
      total_nurseries: r.total_nurseries,
      claimed_nurseries: r.claimed_nurseries,
      active_subscriptions: r.active_subscriptions,
      mrr_gbp: parseFloat(r.mrr_gbp) || 0,
      total_enquiries: r.total_enquiries,
      new_enquiries: r.new_enquiries,
    }))

    const latest = timeseries.length > 0 ? timeseries[timeseries.length - 1] : null

    // Live claim pipeline counts
    const [pendingClaims, approvedClaims, payingProviders] = await Promise.all([
      db
        .from('nursery_claims')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending'),
      db
        .from('nursery_claims')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'approved'),
      db
        .from('provider_subscriptions')
        .select('id', { count: 'exact', head: true })
        .neq('tier', 'free')
        .eq('status', 'active'),
    ])

    res.json({
      latest,
      timeseries,
      claim_pipeline: {
        pending: pendingClaims.count ?? 0,
        approved: approvedClaims.count ?? 0,
        paying: payingProviders.count ?? 0,
      },
    })
  } catch (err) {
    logger.error({ err: err.message }, 'admin reports failed')
    next(err)
  }
})

// ---------------------------------------------------------------------------
// GET /reports/export — admin CSV export
// ---------------------------------------------------------------------------
router.get('/reports/export', async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })

    const { range = '90', metric = 'all' } = req.query
    const days = parseInt(range) || 90
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    const startDateStr = startDate.toISOString().split('T')[0]

    const { data: reports, error } = await db
      .from('admin_reports_cache')
      .select('*')
      .gte('report_date', startDateStr)
      .order('report_date', { ascending: true })

    if (error) throw error

    const headers = [
      'date',
      'total_users',
      'new_users',
      'total_providers',
      'total_nurseries',
      'claimed_nurseries',
      'active_subscriptions',
      'mrr_gbp',
      'total_enquiries',
      'new_enquiries',
    ]
    const rows = [headers.join(',')]

    for (const r of reports || []) {
      rows.push(
        [
          r.report_date,
          r.total_users || 0,
          r.new_users || 0,
          r.total_providers || 0,
          r.total_nurseries || 0,
          r.claimed_nurseries || 0,
          r.active_subscriptions || 0,
          r.mrr_gbp || 0,
          r.total_enquiries || 0,
          r.new_enquiries || 0,
        ].join(',')
      )
    }

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="admin-reports-${days}d.csv"`)
    res.send(rows.join('\n'))
  } catch (err) {
    logger.error({ err: err.message }, 'admin reports export failed')
    next(err)
  }
})

// ---------------------------------------------------------------------------
// POST /reports/snapshot — manually trigger a reports cache snapshot
// ---------------------------------------------------------------------------
router.post('/reports/snapshot', async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })

    const [users, newUsers, providers, nurseries, claimed, activeSubs, enquiries, newEnquiries] =
      await Promise.all([
        db.from('user_profiles').select('id', { count: 'exact', head: true }),
        db
          .from('user_profiles')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', new Date(Date.now() - 86400000).toISOString()),
        db
          .from('user_profiles')
          .select('id', { count: 'exact', head: true })
          .eq('role', 'provider'),
        db.from('nurseries').select('id', { count: 'exact', head: true }),
        db
          .from('nurseries')
          .select('id', { count: 'exact', head: true })
          .not('claimed_by_user_id', 'is', null),
        db
          .from('provider_subscriptions')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'active')
          .neq('tier', 'free'),
        db.from('enquiries').select('id', { count: 'exact', head: true }),
        db
          .from('enquiries')
          .select('id', { count: 'exact', head: true })
          .gte('sent_at', new Date(Date.now() - 86400000).toISOString()),
      ])

    const proCount =
      (
        await db
          .from('provider_subscriptions')
          .select('id', { count: 'exact', head: true })
          .eq('tier', 'pro')
          .eq('status', 'active')
      ).count ?? 0
    const premiumCount =
      (
        await db
          .from('provider_subscriptions')
          .select('id', { count: 'exact', head: true })
          .eq('tier', 'premium')
          .eq('status', 'active')
      ).count ?? 0
    const mrr = proCount * 29 + premiumCount * 79

    const today = new Date().toISOString().split('T')[0]
    const { error } = await db.from('admin_reports_cache').upsert(
      {
        report_date: today,
        total_users: users.count ?? 0,
        new_users: newUsers.count ?? 0,
        total_providers: providers.count ?? 0,
        total_nurseries: nurseries.count ?? 0,
        claimed_nurseries: claimed.count ?? 0,
        active_subscriptions: activeSubs.count ?? 0,
        mrr_gbp: mrr,
        total_enquiries: enquiries.count ?? 0,
        new_enquiries: newEnquiries.count ?? 0,
      },
      { onConflict: 'report_date' }
    )

    if (error) throw error
    logger.info({ date: today }, 'admin reports snapshot taken')
    return res.json({ date: today, total_users: users.count ?? 0 })
  } catch (err) {
    logger.error({ err: err.message }, 'admin reports snapshot failed')
    next(err)
  }
})

export default router
