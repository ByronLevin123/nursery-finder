// Admin dashboard API — stats, user management, claims, reviews, enquiries, subscriptions.
// ALL routes require requireRole('admin').

import express from 'express'
import db from '../db.js'
import { requireRole } from '../middleware/supabaseAuth.js'
import { logger } from '../logger.js'

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
      query = query.ilike('display_name', `%${search}%`)
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
        'id, urn, claimer_name, claimer_email, claimer_role, evidence_notes, status, created_at, nurseries(name)',
        { count: 'exact' }
      )

    if (status) {
      query = query.eq('status', status)
    }

    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1)

    const { data, error, count } = await query
    if (error) throw error

    // Flatten nursery name into response
    const rows = (data || []).map((row) => ({
      id: row.id,
      urn: row.urn,
      nursery_name: row.nurseries?.name ?? null,
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
        .select('id, urn, author_display_name, rating, title, body, status, admin_note, moderated_at, created_at', {
          count: 'exact',
        })
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
// GET /enquiries — paginated enquiry list
// ---------------------------------------------------------------------------
router.get('/enquiries', async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })
    const { page, limit, offset } = paginate(req.query)

    const { data, error, count } = await db
      .from('enquiries')
      .select(
        'id, user_id, nursery_id, child_name, message, status, sent_at, responded_at, nurseries(name)',
        { count: 'exact' }
      )
      .order('sent_at', { ascending: false })
      .range(offset, offset + limit - 1)
    if (error) throw error

    const rows = (data || []).map((row) => ({
      id: row.id,
      user_id: row.user_id,
      nursery_id: row.nursery_id,
      nursery_name: row.nurseries?.name ?? null,
      child_name: row.child_name,
      message: row.message,
      status: row.status,
      sent_at: row.sent_at,
      responded_at: row.responded_at,
    }))

    logger.info({ page, limit }, 'admin enquiries list')
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
// GET /subscriptions — paginated subscription list (provider + parent)
// ---------------------------------------------------------------------------
router.get('/subscriptions', async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })
    const { page, limit, offset } = paginate(req.query)

    // Fetch both subscription types in parallel
    const [providerResult, parentResult] = await Promise.all([
      db
        .from('provider_subscriptions')
        .select(
          'id, user_id, tier, status, current_period_end, created_at, user_profiles(display_name)',
          { count: 'exact' }
        )
        .order('created_at', { ascending: false }),
      db
        .from('parent_subscriptions')
        .select(
          'id, user_id, tier, status, current_period_end, created_at, user_profiles(display_name)',
          { count: 'exact' }
        )
        .order('created_at', { ascending: false }),
    ])

    if (providerResult.error) throw providerResult.error
    if (parentResult.error) throw parentResult.error

    // Merge, tag type, sort by created_at desc, then paginate in-memory
    const allSubs = [
      ...(providerResult.data || []).map((s) => ({
        id: s.id,
        user_id: s.user_id,
        display_name: s.user_profiles?.display_name ?? null,
        type: 'provider',
        tier: s.tier,
        status: s.status,
        current_period_end: s.current_period_end,
        created_at: s.created_at,
      })),
      ...(parentResult.data || []).map((s) => ({
        id: s.id,
        user_id: s.user_id,
        display_name: s.user_profiles?.display_name ?? null,
        type: 'parent',
        tier: s.tier,
        status: s.status,
        current_period_end: s.current_period_end,
        created_at: s.created_at,
      })),
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

    const total = allSubs.length
    const paged = allSubs.slice(offset, offset + limit)

    logger.info({ page, limit }, 'admin subscriptions list')
    return res.json({
      data: paged,
      meta: paginationMeta(total, page, limit),
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

export default router
