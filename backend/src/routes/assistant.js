// AI Family Move Assistant — chat + agentic district search.
// Degrades gracefully when Claude key is missing (chat returns 503).

import express from 'express'
import crypto from 'crypto'
import rateLimit from 'express-rate-limit'
import db from '../db.js'
import { geocodePostcode } from '../services/geocoding.js'
import {
  extractDistrictCriteria,
  generateAssistantReply,
  mergeCriteria,
  EMPTY_CRITERIA,
} from '../services/assistantCriteria.js'
import { scoreDistrict, scoreCommute } from '../services/districtScoring.js'
import { getTravelMatrix } from '../services/travelTime.js'
import { generateMatchNarrative } from '../services/aiMatchNarrative.js'
import { getCached, setCached } from '../services/aiCache.js'
import { isClaudeAvailable, ClaudeUnavailableError } from '../services/claudeApi.js'
import { logger } from '../logger.js'

const router = express.Router()

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many assistant requests, please slow down' },
})
router.use(limiter)

function unavailable(res) {
  return res.status(503).json({ error: 'AI unavailable' })
}

function handleAiError(err, res, next) {
  if (err instanceof ClaudeUnavailableError || err?.code === 'CLAUDE_UNAVAILABLE') {
    return unavailable(res)
  }
  return next(err)
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function rationaleHashKey(district, criteria) {
  const h = crypto.createHash('sha1')
  h.update(district || '')
  h.update('|')
  h.update(JSON.stringify(criteria || {}))
  return `assistant:rationale:${h.digest('hex')}`
}

// POST /api/v1/assistant/chat
router.post('/chat', async (req, res, next) => {
  try {
    if (!isClaudeAvailable()) return unavailable(res)
    const { message, criteria } = req.body || {}
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'message is required' })
    }
    const prior = criteria && typeof criteria === 'object' ? criteria : EMPTY_CRITERIA
    const merged = await extractDistrictCriteria(message, prior)
    const assistant_message = await generateAssistantReply(merged)
    logger.info({ msgLen: message.length }, 'assistant chat turn')
    res.json({ criteria: merged, assistant_message })
  } catch (err) {
    handleAiError(err, res, next)
  }
})

// POST /api/v1/assistant/search
router.post('/search', async (req, res, next) => {
  try {
    const { criteria } = req.body || {}
    if (!criteria || typeof criteria !== 'object') {
      return res.status(400).json({ error: 'criteria is required' })
    }
    if (!db) return res.status(503).json({ error: 'database unavailable' })

    const used = mergeCriteria(EMPTY_CRITERIA, criteria)

    let query = db
      .from('postcode_areas')
      .select(
        `
        postcode_district, local_authority, region,
        family_score, family_score_breakdown,
        nursery_count_total, nursery_count_outstanding,
        nursery_outstanding_pct, crime_rate_per_1000,
        imd_decile, flood_risk_level, lat, lng,
        avg_sale_price_all
      `
      )
      .not('lat', 'is', null)
      .not('family_score', 'is', null)
      .limit(2000)

    const { data: areas, error } = await query
    if (error) throw error

    let candidates = areas || []

    // Optional radius filter from postcode
    if (used.area?.postcode) {
      try {
        const { lat, lng } = await geocodePostcode(used.area.postcode)
        const radius = Number(used.area.max_distance_km) || 25
        candidates = candidates
          .map((a) => ({ ...a, distance_km: haversineKm(lat, lng, a.lat, a.lng) }))
          .filter((a) => a.distance_km <= radius)
      } catch (err) {
        logger.warn({ err: err.message }, 'assistant search: geocode failed, ignoring radius')
      }
    }

    // Commute: batch travel-time from each candidate centroid to the target postcode.
    let commuteByDistrict = new Map()
    if (used.commute?.to_postcode && used.commute?.max_minutes) {
      try {
        const target = await geocodePostcode(used.commute.to_postcode)
        const mode = used.commute.mode || 'drive'
        // Cap candidates for matrix call to keep it fast.
        const matrixCandidates = candidates.slice(0, 200).filter((a) => a.lat && a.lng)
        const matrix = await getTravelMatrix({
          from: { lat: target.lat, lng: target.lng },
          to: matrixCandidates.map((a) => ({ lat: a.lat, lng: a.lng })),
          mode,
        })
        matrixCandidates.forEach((a, i) => {
          commuteByDistrict.set(a.postcode_district, matrix[i])
        })
      } catch (err) {
        logger.warn({ err: err.message }, 'assistant commute matrix failed')
      }
    }

    const scored = candidates
      .map((a) => {
        const result = scoreDistrict(a, used)
        let commuteMeta = null
        let excluded = result.excluded
        let score = result.score
        if (used.commute?.to_postcode && used.commute?.max_minutes) {
          const tt = commuteByDistrict.get(a.postcode_district)
          if (tt) {
            const c = scoreCommute(tt.duration_s, used.commute.max_minutes)
            commuteMeta = {
              duration_s: tt.duration_s,
              distance_m: tt.distance_m,
              mode: used.commute.mode || 'drive',
              score: c.score,
            }
            if (c.excluded) {
              excluded = true
              result.reasons.push(
                `Commute ${Math.round(tt.duration_s / 60)}min > max ${used.commute.max_minutes}min`
              )
            } else if (c.score != null && !excluded) {
              // blend commute into score (30% weight)
              score = Math.round(score * 0.7 + c.score * 0.3)
            }
          }
        }
        return {
          ...a,
          score,
          breakdown: result.breakdown,
          excluded,
          exclude_reasons: result.reasons,
          commute: commuteMeta,
        }
      })
      .filter((a) => !a.excluded)
      .sort((a, b) => b.score - a.score)
      .slice(0, 30)

    // For top 5, generate AI rationale (cached)
    const top = scored.slice(0, 5)
    if (isClaudeAvailable()) {
      await Promise.all(
        top.map(async (a) => {
          const cacheKey = rationaleHashKey(a.postcode_district, used)
          try {
            const cached = await getCached(cacheKey)
            if (cached?.content) {
              a.match_rationale = cached.content
              return
            }
            const rationaleItems = Object.entries(a.breakdown || {})
              .filter(([, v]) => v?.value != null)
              .map(([k, v]) => `${k}: ${Math.round(v.value)} (${v.level || 'n/a'})`)
            const narrative = await generateMatchNarrative(
              null,
              {
                family_score: a.family_score,
                crime_rate_per_1000: a.crime_rate_per_1000,
                imd_decile: a.imd_decile,
                nursery_outstanding_pct: a.nursery_outstanding_pct,
              },
              { score: a.score, rationale: rationaleItems }
            )
            a.match_rationale = narrative
            if (narrative) {
              await setCached(cacheKey, narrative, {
                ttlDays: 7,
                metadata: { kind: 'assistant_rationale' },
              })
            }
          } catch (err) {
            logger.warn(
              { err: err.message, district: a.postcode_district },
              'assistant rationale failed'
            )
          }
        })
      )
    }

    res.json({
      data: scored,
      meta: { total: scored.length, criteria_used: used },
    })
  } catch (err) {
    next(err)
  }
})

export default router
