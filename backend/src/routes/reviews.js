import express from 'express'
import crypto from 'crypto'
import db from '../db.js'
import { extractCategoryScores } from '../services/reviewNlp.js'
import { requireAuth } from '../middleware/supabaseAuth.js'
import { logger } from '../logger.js'

const router = express.Router()

const URL_RE = /(https?:\/\/|www\.)\S+/gi

function hashIp(ip) {
  const secret = process.env.REVIEW_IP_SECRET || 'ctn-rev-' + (process.env.NODE_ENV || 'dev')
  return crypto.createHash('sha256').update(`${ip}::${secret}`).digest('hex')
}

function stripIpHash(row) {
  if (!row) return row
  // eslint-disable-next-line no-unused-vars
  const { ip_hash, ...rest } = row
  return rest
}

function countUrls(text) {
  const m = text.match(URL_RE)
  return m ? m.length : 0
}

function uniqueWordCount(text) {
  const words = text.toLowerCase().match(/[a-z0-9']+/g) || []
  return new Set(words).size
}

function isIsoDate(s) {
  if (typeof s !== 'string') return false
  return /^\d{4}-\d{2}-\d{2}/.test(s) && !Number.isNaN(Date.parse(s))
}

// POST /api/v1/nurseries/:urn/reviews
router.post('/:urn/reviews', requireAuth, async (req, res, next) => {
  try {
    const { urn } = req.params
    const {
      rating,
      title,
      body,
      would_recommend,
      child_age_months,
      attended_from,
      attended_to,
      author_display_name,
    } = req.body || {}

    // Validation
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'rating must be an integer between 1 and 5' })
    }
    if (typeof title !== 'string' || title.length < 3 || title.length > 120) {
      return res.status(400).json({ error: 'title must be between 3 and 120 characters' })
    }
    if (typeof body !== 'string' || body.length < 20 || body.length > 4000) {
      return res.status(400).json({ error: 'body must be between 20 and 4000 characters' })
    }
    if (typeof would_recommend !== 'boolean') {
      return res.status(400).json({ error: 'would_recommend must be a boolean' })
    }
    if (
      child_age_months !== undefined &&
      child_age_months !== null &&
      (!Number.isInteger(child_age_months) || child_age_months < 0 || child_age_months > 72)
    ) {
      return res.status(400).json({ error: 'child_age_months must be between 0 and 72' })
    }
    if (attended_from != null && !isIsoDate(attended_from)) {
      return res.status(400).json({ error: 'attended_from must be an ISO date' })
    }
    if (attended_to != null && !isIsoDate(attended_to)) {
      return res.status(400).json({ error: 'attended_to must be an ISO date' })
    }
    if (
      author_display_name != null &&
      (typeof author_display_name !== 'string' || author_display_name.length > 60)
    ) {
      return res.status(400).json({ error: 'author_display_name must be 60 characters or fewer' })
    }

    const ip_hash = hashIp(req.ip || '0.0.0.0')

    // Duplicate check — same user + same urn (primary), or same ip + same urn (secondary)
    const { data: existing, error: existingErr } = await db
      .from('nursery_reviews')
      .select('id')
      .eq('urn', urn)
      .or(`user_id.eq.${req.user.id},ip_hash.eq.${ip_hash}`)
      .limit(1)
    if (existingErr) throw existingErr
    if (existing && existing.length > 0) {
      return res.status(409).json({ error: 'You have already reviewed this nursery' })
    }

    // Rate limit — max 3 reviews per ip in 24h
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: recent, error: recentErr } = await db
      .from('nursery_reviews')
      .select('id')
      .eq('ip_hash', ip_hash)
      .gte('created_at', since)
    if (recentErr) throw recentErr
    if (recent && recent.length >= 3) {
      return res
        .status(429)
        .json({ error: 'Too many reviews from your network in the last 24 hours' })
    }

    // Spam heuristics — flag (not reject) as 'pending'
    const tooManyUrls = countUrls(title) > 3 || countUrls(body) > 3
    const tooFewWords = uniqueWordCount(body) < 3
    const status = tooManyUrls || tooFewWords ? 'pending' : 'published'

    const insertRow = {
      urn,
      rating,
      title,
      body,
      would_recommend,
      child_age_months: child_age_months ?? null,
      attended_from: attended_from ?? null,
      attended_to: attended_to ?? null,
      author_display_name: author_display_name ?? null,
      user_id: req.user.id,
      ip_hash,
      status,
    }

    const { data: inserted, error: insertErr } = await db
      .from('nursery_reviews')
      .insert(insertRow)
      .select()
      .single()
    if (insertErr) throw insertErr

    logger.info({ urn, status }, 'review submitted')

    // NLP category extraction — non-blocking, failure must not block review
    try {
      const categoryScores = await extractCategoryScores(body)
      if (categoryScores && inserted.id) {
        await db
          .from('nursery_reviews')
          .update({ category_scores: categoryScores })
          .eq('id', inserted.id)
        inserted.category_scores = categoryScores
      }
    } catch (nlpErr) {
      logger.warn({ err: nlpErr.message, reviewId: inserted.id }, 'review NLP failed')
    }

    res.status(201).json(stripIpHash(inserted))
  } catch (err) {
    next(err)
  }
})

// GET /api/v1/nurseries/:urn/reviews
router.get('/:urn/reviews', async (req, res, next) => {
  try {
    const { urn } = req.params
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20))
    const offset = Math.max(0, Number(req.query.offset) || 0)

    const {
      data: reviews,
      error: reviewsErr,
      count,
    } = await db
      .from('nursery_reviews')
      .select('*', { count: 'exact' })
      .eq('urn', urn)
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
    if (reviewsErr) throw reviewsErr

    const { data: nursery, error: nurseryErr } = await db
      .from('nurseries')
      .select('review_count, review_avg_rating, review_recommend_pct')
      .eq('urn', urn)
      .maybeSingle()
    if (nurseryErr) throw nurseryErr

    res.json({
      reviews: (reviews || []).map(stripIpHash),
      total: count ?? 0,
      avg_rating: nursery?.review_avg_rating ?? null,
      recommend_pct: nursery?.review_recommend_pct ?? null,
    })
  } catch (err) {
    next(err)
  }
})

export default router
