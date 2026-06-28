// AI feature routes — Claude-powered summaries, syntheses, narratives, smart search.
// All routes degrade gracefully when ANTHROPIC_API_KEY is missing (503).

import express from 'express'
import rateLimit from 'express-rate-limit'
import { isClaudeAvailable, callClaude, ClaudeUnavailableError } from '../services/claudeApi.js'
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

// Stricter rate limit for the nursery advisor chat endpoint — 10 req/hour per IP
const advisorLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: 'You have reached the advisor limit. Please try again later.' },
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

// POST /api/v1/ai/nursery-advisor
const ADVISOR_SYSTEM_PROMPT = `You are the NurseryMatch Advisor — a friendly, knowledgeable UK childcare expert embedded in the NurseryMatch nursery comparison website. You help parents navigate nursery choices with practical, accurate advice.

Your expertise:
- Ofsted inspection grades (Outstanding, Good, Requires Improvement, Inadequate) and what they mean
- UK government-funded childcare hours: 15 hours free for disadvantaged 2-year-olds, 15 hours universal for all 3-4 year-olds, 30 hours extended for working parents of 3-4 year-olds, and the newer entitlements for 9-month-olds+
- Types of nursery settings: day nurseries, pre-schools/playgroups, childminders, nursery schools, Montessori, forest schools
- Age-appropriate environments: baby rooms (0-2), toddler rooms (2-3), pre-school rooms (3-5)
- What to look for when visiting a nursery: staff ratios, key person system, learning environment, outdoor space, settling-in policy, safeguarding
- NurseryMatch features: search by postcode, compare nurseries, read reviews, check area family scores, view Ofsted reports

Rules:
- Keep responses concise (2-4 short paragraphs max). Parents are busy.
- Be warm and reassuring but honest. Starting nursery is emotional for parents.
- Always recommend parents visit nurseries in person before deciding.
- Never make specific nursery recommendations by name — instead guide them to search on NurseryMatch.
- If asked about a specific postcode area, suggest they search for it on NurseryMatch.
- When relevant, mention NurseryMatch features they can use (search, compare, quiz, reviews).
- Only answer questions about UK childcare, nurseries, and early years. Politely redirect off-topic questions.
- Use British English.

For each response, also suggest 1-3 follow-up actions the user might want to take on NurseryMatch. These should be short action phrases like:
- "Search nurseries near [postcode]" (if they mention a location)
- "Take the nursery quiz" (if they seem unsure what they need)
- "Compare your shortlisted nurseries" (if they mention specific nurseries)
- "Learn about funded hours" (if they ask about costs)
- "Read parent reviews" (if they want opinions)

Return your response as JSON with this exact structure:
{"response": "your advice text here", "suggestions": ["action 1", "action 2"]}

Always return valid JSON. Do not include any text before or after the JSON object.`

const ADVISOR_MAX_MESSAGE_LENGTH = 1000

router.post('/ai/nursery-advisor', advisorLimiter, async (req, res, next) => {
  try {
    if (!isClaudeAvailable()) {
      return res.json({
        response:
          'I\'m sorry, the nursery advisor is temporarily unavailable. In the meantime, you can search for nurseries by postcode using the search bar, or take our nursery quiz to find what matters most to you.',
        suggestions: ['Search nurseries near you', 'Take the nursery quiz'],
      })
    }

    const { message, context } = req.body || {}

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'message is required' })
    }
    if (message.length > ADVISOR_MAX_MESSAGE_LENGTH) {
      return res
        .status(400)
        .json({ error: `message must be ${ADVISOR_MAX_MESSAGE_LENGTH} characters or fewer` })
    }

    // Build a contextual prompt that includes any known user context
    const contextParts = []
    if (context && typeof context === 'object') {
      if (context.postcode) contextParts.push(`Parent's postcode: ${context.postcode}`)
      if (context.childAge != null) contextParts.push(`Child's age: ${context.childAge} months`)
      if (Array.isArray(context.priorities) && context.priorities.length) {
        contextParts.push(`Priorities: ${context.priorities.join(', ')}`)
      }
      if (context.budget) contextParts.push(`Budget: ${context.budget}`)
    }

    const contextBlock = contextParts.length
      ? `\n\nKnown context about this parent:\n${contextParts.join('\n')}`
      : ''

    const prompt = `${message}${contextBlock}`

    const raw = await callClaude({
      prompt,
      system: ADVISOR_SYSTEM_PROMPT,
      maxTokens: 600,
    })

    // Parse Claude's JSON response — tolerate markdown fences or extra whitespace
    let parsed
    try {
      const cleaned = raw
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```\s*$/, '')
        .trim()
      parsed = JSON.parse(cleaned)
    } catch {
      // If Claude didn't return valid JSON, wrap the raw text
      parsed = { response: raw.trim(), suggestions: [] }
    }

    const response = typeof parsed.response === 'string' ? parsed.response : raw.trim()
    const suggestions = Array.isArray(parsed.suggestions)
      ? parsed.suggestions.filter((s) => typeof s === 'string').slice(0, 3)
      : []

    logger.info({ msgLen: message.length, suggestionsCount: suggestions.length }, 'nursery advisor reply')

    res.json({ response, suggestions })
  } catch (err) {
    handleAiError(err, res, next)
  }
})

export default router
