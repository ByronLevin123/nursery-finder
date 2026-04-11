import express from 'express'
import db from '../db.js'
import { logger } from '../logger.js'
import { requireAuth } from '../middleware/supabaseAuth.js'

const router = express.Router()

// GET /api/v1/nurseries/:urn/questions — list published questions with answers (public)
router.get('/:urn/questions', async (req, res, next) => {
  try {
    const { urn } = req.params
    if (!db) return res.status(503).json({ error: 'Database not configured' })

    const { data: questions, error: qErr } = await db
      .from('nursery_questions')
      .select('*')
      .eq('nursery_urn', urn)
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(50)

    if (qErr) throw qErr

    if (!questions || questions.length === 0) {
      return res.json({ questions: [] })
    }

    // Fetch answers for all returned questions
    const questionIds = questions.map((q) => q.id)
    const { data: answers, error: aErr } = await db
      .from('nursery_answers')
      .select('*')
      .in('question_id', questionIds)
      .eq('status', 'published')
      .order('created_at', { ascending: true })

    if (aErr) throw aErr

    // Group answers by question_id
    const answersByQuestion = {}
    for (const a of answers || []) {
      if (!answersByQuestion[a.question_id]) answersByQuestion[a.question_id] = []
      answersByQuestion[a.question_id].push(a)
    }

    const result = questions.map((q) => ({
      ...q,
      answers: answersByQuestion[q.id] || [],
    }))

    return res.json({ questions: result })
  } catch (err) {
    logger.error({ err: err?.message, urn: req.params.urn }, 'Failed to fetch questions')
    next(err)
  }
})

// POST /api/v1/nurseries/:urn/questions — ask a question (requires auth)
router.post('/:urn/questions', requireAuth, async (req, res, next) => {
  try {
    const { urn } = req.params
    const { question } = req.body
    if (!db) return res.status(503).json({ error: 'Database not configured' })

    // Validate question length
    if (!question || typeof question !== 'string') {
      return res.status(400).json({ error: 'Question is required' })
    }
    const trimmed = question.trim()
    if (trimmed.length < 10 || trimmed.length > 500) {
      return res.status(400).json({ error: 'Question must be between 10 and 500 characters' })
    }

    const { data, error } = await db
      .from('nursery_questions')
      .insert({
        nursery_urn: urn,
        user_id: req.user.id,
        question: trimmed,
        status: 'published',
      })
      .select()
      .single()

    if (error) throw error

    logger.info({ urn, questionId: data.id, userId: req.user.id }, 'New question posted')
    return res.status(201).json(data)
  } catch (err) {
    logger.error({ err: err?.message, urn: req.params.urn }, 'Failed to post question')
    next(err)
  }
})

// POST /api/v1/nurseries/:urn/questions/:questionId/answers — answer a question (requires auth)
router.post('/:urn/questions/:questionId/answers', requireAuth, async (req, res, next) => {
  try {
    const { urn, questionId } = req.params
    const { answer } = req.body
    if (!db) return res.status(503).json({ error: 'Database not configured' })

    // Validate answer length
    if (!answer || typeof answer !== 'string') {
      return res.status(400).json({ error: 'Answer is required' })
    }
    const trimmed = answer.trim()
    if (trimmed.length < 10 || trimmed.length > 1000) {
      return res.status(400).json({ error: 'Answer must be between 10 and 1000 characters' })
    }

    // Verify the question exists and belongs to this nursery
    const { data: question, error: qErr } = await db
      .from('nursery_questions')
      .select('id, nursery_urn')
      .eq('id', questionId)
      .eq('nursery_urn', urn)
      .eq('status', 'published')
      .maybeSingle()

    if (qErr) throw qErr
    if (!question) {
      return res.status(404).json({ error: 'Question not found' })
    }

    // Check if the user is the provider (via nursery_claims table)
    let isProvider = false
    const { data: claim } = await db
      .from('nursery_claims')
      .select('id')
      .eq('nursery_urn', urn)
      .eq('user_id', req.user.id)
      .eq('status', 'approved')
      .maybeSingle()

    if (claim) {
      isProvider = true
    }

    // Only providers can answer questions
    if (!isProvider) {
      return res.status(403).json({ error: 'Only the nursery provider can answer questions' })
    }

    const { data, error } = await db
      .from('nursery_answers')
      .insert({
        question_id: questionId,
        user_id: req.user.id,
        is_provider: isProvider,
        answer: trimmed,
        status: 'published',
      })
      .select()
      .single()

    if (error) throw error

    logger.info(
      { urn, questionId, answerId: data.id, userId: req.user.id, isProvider },
      'New answer posted'
    )
    return res.status(201).json(data)
  } catch (err) {
    logger.error({ err: err?.message, urn: req.params.urn }, 'Failed to post answer')
    next(err)
  }
})

export default router
