import express from 'express'
import db from '../db.js'
import { requireAuth } from '../middleware/supabaseAuth.js'
import { logger } from '../logger.js'

const router = express.Router()

// GET /api/v1/provider/nurseries/:urn/team — list team members
router.get('/nurseries/:urn/team', requireAuth, async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })

    const { urn } = req.params

    // Verify caller is owner or team member
    const { data: membership } = await db
      .from('nursery_team_members')
      .select('role')
      .eq('nursery_urn', urn)
      .eq('user_id', req.user.id)
      .maybeSingle()

    const { data: nursery } = await db
      .from('nurseries')
      .select('claimed_by_user_id')
      .eq('urn', urn)
      .maybeSingle()

    const isOwner = nursery?.claimed_by_user_id === req.user.id
    if (!isOwner && !membership) {
      return res.status(403).json({ error: 'You do not have access to this nursery' })
    }

    const { data: members, error } = await db
      .from('nursery_team_members')
      .select('id, user_id, role, created_at')
      .eq('nursery_urn', urn)
      .order('created_at', { ascending: true })

    if (error) throw error

    // Enrich with display names
    const userIds = (members || []).map((m) => m.user_id)
    let nameMap = {}
    if (userIds.length > 0) {
      const { data: profiles } = await db
        .from('user_profiles')
        .select('id, display_name')
        .in('id', userIds)
      if (profiles) {
        nameMap = Object.fromEntries(profiles.map((p) => [p.id, p.display_name]))
      }
    }

    const enriched = (members || []).map((m) => ({
      ...m,
      display_name: nameMap[m.user_id] || null,
    }))

    res.json({ data: enriched })
  } catch (err) {
    next(err)
  }
})

// POST /api/v1/provider/nurseries/:urn/team — invite a team member by email
router.post('/nurseries/:urn/team', requireAuth, async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })

    const { urn } = req.params
    const { email, role } = req.body || {}

    if (!email) return res.status(400).json({ error: 'email is required' })
    const teamRole = ['manager', 'viewer'].includes(role) ? role : 'manager'

    // Verify caller is owner
    const { data: nursery } = await db
      .from('nurseries')
      .select('claimed_by_user_id')
      .eq('urn', urn)
      .maybeSingle()

    if (!nursery || nursery.claimed_by_user_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the nursery owner can invite team members' })
    }

    // Find user by email in profiles
    const { data: profile } = await db
      .from('user_profiles')
      .select('id')
      .eq('email', email.toLowerCase())
      .maybeSingle()

    if (!profile) {
      return res.status(404).json({
        error: 'No account found with that email. They need to sign up first.',
      })
    }

    const { data, error } = await db
      .from('nursery_team_members')
      .upsert(
        {
          nursery_urn: urn,
          user_id: profile.id,
          role: teamRole,
          invited_by: req.user.id,
        },
        { onConflict: 'nursery_urn,user_id' }
      )
      .select()
      .single()

    if (error) throw error

    logger.info({ urn, userId: profile.id, role: teamRole }, 'team member added')
    res.status(201).json(data)
  } catch (err) {
    next(err)
  }
})

// DELETE /api/v1/provider/nurseries/:urn/team/:memberId — remove a team member
router.delete('/nurseries/:urn/team/:memberId', requireAuth, async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })

    const { urn, memberId } = req.params

    // Verify caller is owner
    const { data: nursery } = await db
      .from('nurseries')
      .select('claimed_by_user_id')
      .eq('urn', urn)
      .maybeSingle()

    if (!nursery || nursery.claimed_by_user_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the nursery owner can remove team members' })
    }

    const { error } = await db
      .from('nursery_team_members')
      .delete()
      .eq('id', memberId)
      .eq('nursery_urn', urn)

    if (error) throw error

    logger.info({ urn, memberId }, 'team member removed')
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

export default router
