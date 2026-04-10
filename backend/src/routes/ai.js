// AI feature routes — Claude-powered summaries, syntheses, narratives, smart search.
// All routes degrade gracefully when ANTHROPIC_API_KEY is missing (503).

import express from 'express'
import rateLimit from 'express-rate-limit'
import { isClaudeAvailable, ClaudeUnavailableError } from '../services/claudeApi.js'
import { getNurserySummary } from '../services/aiNurserySummary.js'
import { getReviewSynthesis } from '../services/aiReviewSynthesis.js'
import { generateMatchNarrative } from '../services/aiMatchNarrative.js'
import { parseNaturalLanguageSearch } from '../services/aiConversationalSearch.js'
import { logger } from '../logger.js'

const router = express.Router()

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Too many AI requests, please slow down' },
})

router.use(aiLimiter)

function unavailable(res) {
  return res.status(503).json({ error: 'AI unavailable' })
}

function handleAiError(err, res, next) {
  if (err instanceof ClaudeUnavailableError || err?.code === 'CLAUDE_UNAVAILABLE') {
    return unavailable(res)
  }
  return next(err)
}

// GET /api/v1/nurseries/:urn/summary
router.get('/nurseries/:urn/summary', async (req, res, next) => {
  try {
    if (!isClaudeAvailable()) return unavailable(res)
    const summary = await getNurserySummary(req.params.urn)
    if (!summary) return res.json({ summary: null })
    res.json({ summary })
  } catch (err) {
    handleAiError(err, res, next)
  }
})

// GET /api/v1/nurseries/:urn/review-synthesis
router.get('/nurseries/:urn/review-synthesis', async (req, res, next) => {
  try {
    if (!isClaudeAvailable()) return unavailable(res)
    const synth = await getReviewSynthesis(req.params.urn)
    if (!synth) return res.json({ synthesis: null })
    res.json(synth)
  } catch (err) {
    handleAiError(err, res, next)
  }
})

// POST /api/v1/ai/match-narrative
router.post('/ai/match-narrative', async (req, res, next) => {
  try {
    if (!isClaudeAvailable()) return unavailable(res)
    const { nursery, area, match } = req.body || {}
    if (!nursery || typeof nursery !== 'object' || !nursery.name) {
      return res.status(400).json({ error: 'nursery object with name is required' })
    }
    if (!match || typeof match !== 'object') {
      return res.status(400).json({ error: 'match object is required' })
    }
    if (area != null && typeof area !== 'object') {
      return res.status(400).json({ error: 'area must be an object if provided' })
    }
    const narrative = await generateMatchNarrative(nursery, area, match)
    res.json({ narrative })
  } catch (err) {
    handleAiError(err, res, next)
  }
})

// POST /api/v1/ai/conversational-search
router.post('/ai/conversational-search', async (req, res, next) => {
  try {
    if (!isClaudeAvailable()) return unavailable(res)
    const { query } = req.body || {}
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'query is required' })
    }
    const filters = await parseNaturalLanguageSearch(query)
    logger.info({ queryLen: query.length }, 'conversational search parsed')
    res.json(filters)
  } catch (err) {
    handleAiError(err, res, next)
  }
})

export default router
