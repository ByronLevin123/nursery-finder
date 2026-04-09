// Quiz + recommendations routes — personalised nursery matching.

import express from 'express'
import db from '../db.js'
import { requireAuth } from '../middleware/supabaseAuth.js'
import { mapQuizToWeights, getPersonalisedRankings, generateTradeoffExplanation } from '../services/quizEngine.js'
import { logger } from '../logger.js'

const router = express.Router()

const VALID_URGENCIES = ['asap', '3_months', '6_months', 'exploring']
const VALID_COMMUTE_FROM = ['home', 'work', 'both']
const VALID_PRIORITIES = ['quality', 'cost', 'location', 'staff', 'availability', 'facilities']

// POST /api/v1/quiz/submit — validate + upsert quiz response
router.post('/submit', requireAuth, async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })

    const {
      child_dob,
      child_name,
      urgency,
      commute_from,
      commute_postcode,
      budget_min,
      budget_max,
      priority_order,
      must_haves,
      min_grade,
    } = req.body

    // Validation
    if (urgency && !VALID_URGENCIES.includes(urgency)) {
      return res.status(400).json({ error: `urgency must be one of: ${VALID_URGENCIES.join(', ')}` })
    }
    if (commute_from && !VALID_COMMUTE_FROM.includes(commute_from)) {
      return res.status(400).json({ error: `commute_from must be one of: ${VALID_COMMUTE_FROM.join(', ')}` })
    }
    if (priority_order && !Array.isArray(priority_order)) {
      return res.status(400).json({ error: 'priority_order must be an array' })
    }
    if (priority_order) {
      for (const p of priority_order) {
        if (!VALID_PRIORITIES.includes(p)) {
          return res.status(400).json({ error: `invalid priority: ${p}` })
        }
      }
    }
    if (must_haves && !Array.isArray(must_haves)) {
      return res.status(400).json({ error: 'must_haves must be an array' })
    }
    if (budget_min != null && (typeof budget_min !== 'number' || budget_min < 0)) {
      return res.status(400).json({ error: 'budget_min must be a non-negative number' })
    }
    if (budget_max != null && (typeof budget_max !== 'number' || budget_max < 0)) {
      return res.status(400).json({ error: 'budget_max must be a non-negative number' })
    }

    const row = {
      user_id: req.user.id,
      child_dob: child_dob || null,
      child_name: child_name || null,
      urgency: urgency || null,
      commute_from: commute_from || null,
      commute_postcode: commute_postcode || null,
      budget_min: budget_min || null,
      budget_max: budget_max || null,
      priority_order: priority_order || [],
      must_haves: must_haves || [],
      min_grade: min_grade || null,
      updated_at: new Date().toISOString(),
    }

    // Upsert — one quiz response per user
    const { data: existing } = await db
      .from('user_quiz_responses')
      .select('id')
      .eq('user_id', req.user.id)
      .maybeSingle()

    let data, error
    if (existing) {
      ;({ data, error } = await db
        .from('user_quiz_responses')
        .update(row)
        .eq('user_id', req.user.id)
        .select()
        .single())
    } else {
      ;({ data, error } = await db
        .from('user_quiz_responses')
        .insert(row)
        .select()
        .single())
    }

    if (error) throw error
    logger.info({ userId: req.user.id }, 'quiz response saved')
    return res.json(data)
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/quiz/mine — current user's quiz response
router.get('/mine', requireAuth, async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })

    const { data, error } = await db
      .from('user_quiz_responses')
      .select('*')
      .eq('user_id', req.user.id)
      .maybeSingle()

    if (error) throw error
    return res.json(data || null)
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/recommendations — personalised nursery rankings
router.get('/recommendations', requireAuth, async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })

    const { data: quiz, error: quizErr } = await db
      .from('user_quiz_responses')
      .select('*')
      .eq('user_id', req.user.id)
      .maybeSingle()

    if (quizErr) throw quizErr
    if (!quiz) {
      return res.status(404).json({ error: 'No quiz response found. Take the quiz first.' })
    }

    // Merge profile postcodes if commute_from=both
    let enrichedQuiz = { ...quiz }
    if (quiz.commute_from === 'both') {
      try {
        const { data: profile } = await db
          .from('user_profiles')
          .select('home_postcode, work_postcode')
          .eq('id', req.user.id)
          .maybeSingle()
        if (profile) {
          enrichedQuiz.home_postcode = profile.home_postcode
          enrichedQuiz.work_postcode = profile.work_postcode
        }
      } catch {
        // non-fatal
      }
    }

    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20))
    const offset = Math.max(0, Number(req.query.offset) || 0)

    const result = await getPersonalisedRankings(enrichedQuiz, { limit, offset })
    logger.info({ userId: req.user.id, total: result.meta.total }, 'recommendations served')
    return res.json(result)
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/recommendations/tradeoffs — AI trade-off explanation for a pair
router.get('/recommendations/tradeoffs', requireAuth, async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })

    const urnsParam = req.query.urns
    if (!urnsParam) {
      return res.status(400).json({ error: 'urns query parameter required (e.g., ?urns=A,B)' })
    }
    const urns = urnsParam.split(',').filter(Boolean)
    if (urns.length !== 2) {
      return res.status(400).json({ error: 'Provide exactly 2 URNs separated by comma' })
    }

    // Fetch both nurseries
    const { data: nurseries, error } = await db
      .from('nurseries')
      .select('*')
      .in('urn', urns)
    if (error) throw error
    if (!nurseries || nurseries.length !== 2) {
      return res.status(404).json({ error: 'One or both nurseries not found' })
    }

    // Get user's quiz weights
    const { data: quiz } = await db
      .from('user_quiz_responses')
      .select('priority_order, urgency')
      .eq('user_id', req.user.id)
      .maybeSingle()

    const parsed = mapQuizToWeights(quiz || {})

    const explanation = await generateTradeoffExplanation(
      nurseries[0],
      nurseries[1],
      parsed.weights
    )

    return res.json({
      nurseries: nurseries.map((n) => ({ urn: n.urn, name: n.name })),
      explanation: explanation || 'Trade-off analysis is not available at this time.',
    })
  } catch (err) {
    next(err)
  }
})

export default router
