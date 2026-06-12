// Marketing Hub API — AI content generation (Claude), social posts (Buffer),
// and Google Ads campaigns. ALL routes require requireRole('admin').
//
// The request/response shapes here match the admin UI in
// frontend/app/admin/marketing/page.tsx. Where the UI's vocabulary differs from
// the Google Ads service's canonical enum (active vs enabled, etc.), the mapping
// happens at this boundary so the service and DB stay canonical.

import express from 'express'
import db from '../db.js'
import { requireRole } from '../middleware/supabaseAuth.js'
import { logger } from '../logger.js'
import { callClaude, isClaudeAvailable } from '../services/claudeApi.js'
import * as bufferService from '../services/bufferService.js'
import * as googleAdsService from '../services/googleAdsService.js'
import { runAutopilot, isEnabled as autopilotEnabled } from '../services/marketingAutopilot.js'

const router = express.Router()

// Every route on this router requires admin role
router.use(requireRole('admin'))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// UI content types ↔ legacy marketing_content.type (kept populated for the
// existing NOT NULL + CHECK constraint from migration 059).
const CONTENT_TYPES = ['social_post', 'blog_outline', 'google_ad_copy']
const LEGACY_TYPE = {
  social_post: 'social',
  blog_outline: 'blog',
  google_ad_copy: 'ad_copy',
}

// Google Ads status ↔ UI status. DB/service keep the canonical Google enum.
const AD_STATUS_TO_UI = {
  enabled: 'active',
  paused: 'paused',
  removed: 'ended',
  draft: 'pending',
}
const UI_STATUS_TO_DB = {
  active: 'enabled',
  paused: 'paused',
}

function paginate(req) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20))
  return { page, limit, offset: (page - 1) * limit }
}

// Shape a marketing_google_ads row for the UI.
function adToUi(row) {
  return {
    id: row.id,
    name: row.name,
    status: AD_STATUS_TO_UI[row.status] || 'pending',
    daily_budget: Number(row.daily_budget ?? row.daily_budget_gbp ?? 0),
    keywords: row.keywords || [],
    headlines: row.headlines || [],
    descriptions: row.descriptions || [],
    impressions: row.impressions || 0,
    clicks: row.clicks || 0,
    conversions: row.conversions || 0,
    spend: Number(row.spend ?? row.spend_gbp ?? 0),
    created_at: row.created_at,
  }
}

// ---------------------------------------------------------------------------
// POST /generate-content — Generate social/blog/ad copy via Claude AI
// ---------------------------------------------------------------------------
router.post('/generate-content', async (req, res, next) => {
  try {
    if (!isClaudeAvailable()) {
      return res.status(503).json({ error: 'Claude AI is not configured' })
    }

    const { content_type, topic, tone, platform } = req.body

    if (!content_type || !topic) {
      return res.status(400).json({ error: 'content_type and topic are required' })
    }
    if (!CONTENT_TYPES.includes(content_type)) {
      return res
        .status(400)
        .json({ error: `content_type must be one of: ${CONTENT_TYPES.join(', ')}` })
    }

    const systemPrompts = {
      social_post: `You are a social media copywriter for NurseryMatch, a UK nursery comparison website. Write engaging, concise social media posts. Use a ${tone || 'friendly'} tone. ${platform ? `Optimise for ${platform}.` : ''} Do not use hashtags unless specifically asked. Keep posts under 280 characters for Twitter/X.`,
      blog_outline: `You are a content writer for NurseryMatch, a UK nursery comparison website helping parents find the best nurseries. Write an SEO-friendly blog outline in a ${tone || 'helpful'} tone. Use British English. Include a compelling headline and section headings.`,
      google_ad_copy: `You are an advertising copywriter for NurseryMatch, a UK nursery comparison website. Write compelling Google Ads copy. Keep headlines under 30 characters and descriptions under 90 characters. Use a ${tone || 'persuasive'} tone. Focus on parent benefits.`,
    }

    const prompt = `Write ${
      content_type === 'social_post'
        ? 'a social media post'
        : content_type === 'blog_outline'
          ? 'a blog outline'
          : 'Google Ads copy'
    } about: ${topic}`

    logger.info({ content_type, platform }, 'marketing content generation requested')

    const content = await callClaude({
      prompt,
      system: systemPrompts[content_type],
      maxTokens: content_type === 'blog_outline' ? 2000 : 500,
    })

    // Save draft. content_type/topic/platform/tone are the UI-facing columns
    // (migration 060); `type` satisfies the legacy 059 constraint.
    let saved = null
    if (db) {
      const { data, error: dbErr } = await db
        .from('marketing_content')
        .insert({
          type: LEGACY_TYPE[content_type],
          content_type,
          topic,
          platform: content_type === 'social_post' ? platform || null : null,
          tone: tone || null,
          prompt_used: prompt,
          content,
          status: 'draft',
          created_by: req.user.id,
        })
        .select()
        .single()
      if (dbErr) {
        logger.warn({ err: dbErr.message }, 'failed to save marketing content draft')
      } else {
        saved = data
      }
    }

    logger.info({ content_type, contentLength: content.length }, 'marketing content generated')
    return res.json({ content, prompt_used: prompt, ...(saved || {}) })
  } catch (err) {
    logger.error({ err: err.message }, 'generate-content failed')
    next(err)
  }
})

// ---------------------------------------------------------------------------
// GET /content — List AI-generated content drafts
// ---------------------------------------------------------------------------
router.get('/content', async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })

    const { page, limit, offset } = paginate(req)

    let query = db
      .from('marketing_content')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })

    if (req.query.content_type) query = query.eq('content_type', req.query.content_type)
    if (req.query.status) query = query.eq('status', req.query.status)

    const { data, error, count } = await query.range(offset, offset + limit - 1)
    if (error) {
      logger.warn({ err: error.message }, 'failed to fetch marketing content')
      return res.status(500).json({ error: 'Failed to fetch content' })
    }

    return res.json({
      data,
      pagination: {
        total: count ?? 0,
        page,
        limit,
        pages: Math.ceil((count ?? 0) / limit) || 1,
      },
    })
  } catch (err) {
    logger.error({ err: err.message }, 'content list failed')
    next(err)
  }
})

// ---------------------------------------------------------------------------
// PATCH /content/:id — Update content status (approve/publish) or edit body
// ---------------------------------------------------------------------------
router.patch('/content/:id', async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })

    const { id } = req.params
    const { status, content } = req.body

    const validStatuses = ['draft', 'approved', 'published']
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` })
    }

    const updates = { updated_at: new Date().toISOString() }
    if (status) updates.status = status
    if (content) updates.content = content

    const { data: updated, error } = await db
      .from('marketing_content')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Content not found' })
      }
      logger.warn({ err: error.message, id }, 'failed to update marketing content')
      return res.status(500).json({ error: 'Failed to update content' })
    }

    logger.info({ id, status: updates.status }, 'marketing content updated')
    return res.json({ data: updated })
  } catch (err) {
    logger.error({ err: err.message }, 'content patch failed')
    next(err)
  }
})

// ---------------------------------------------------------------------------
// GET /social/profiles — List connected Buffer channels
// ---------------------------------------------------------------------------
router.get('/social/profiles', async (req, res, next) => {
  try {
    if (!bufferService.isAvailable()) {
      return res.status(503).json({ error: 'Buffer is not configured', available: false })
    }

    const { data, error } = await bufferService.getProfiles()
    if (error) return res.status(502).json({ error })

    return res.json({ data })
  } catch (err) {
    logger.error({ err: err.message }, 'social/profiles failed')
    next(err)
  }
})

// ---------------------------------------------------------------------------
// POST /social/post — Post (or schedule) to one or more Buffer channels
// ---------------------------------------------------------------------------
router.post('/social/post', async (req, res, next) => {
  try {
    if (!bufferService.isAvailable()) {
      return res.status(503).json({ error: 'Buffer is not configured' })
    }

    const {
      text,
      profile_ids: profileIds,
      scheduled_at: scheduledAt,
      image_url: imageUrl,
    } = req.body

    if (!text || !profileIds?.length) {
      return res.status(400).json({ error: 'text and profile_ids are required' })
    }
    if (!profileIds.every((id) => typeof id === 'string')) {
      return res.status(400).json({ error: 'profile_ids must be strings' })
    }
    if (imageUrl !== undefined && imageUrl !== null) {
      if (
        typeof imageUrl !== 'string' ||
        imageUrl.length > 2048 ||
        !/^https?:\/\//i.test(imageUrl)
      ) {
        return res.status(400).json({ error: 'image_url must be an http(s) URL (max 2048 chars)' })
      }
    }

    // Resolve channel → platform so we can store which platforms were targeted.
    const platformById = {}
    const { data: channels } = await bufferService.getProfiles()
    for (const c of channels || []) {
      platformById[c.id] = c.service
    }

    // Instagram (and other image-first networks) cannot post text only.
    if (!imageUrl) {
      const imageRequired = profileIds.filter((id) => platformById[id] === 'instagram')
      if (imageRequired.length > 0) {
        return res.status(400).json({
          error: 'Instagram posts require an image. Add an image URL and try again.',
        })
      }
    }

    logger.info(
      { channelCount: profileIds.length, scheduled: !!scheduledAt, hasImage: !!imageUrl },
      'social post requested'
    )

    const results = []
    for (const channelId of profileIds) {
      const { data, error } = await bufferService.createPost({
        text,
        channelId,
        scheduledAt,
        imageUrl,
      })
      results.push({ channelId, postId: data?.id || null, error })
    }

    const failures = results.filter((r) => r.error)
    if (failures.length === profileIds.length) {
      // Every channel failed — surface the first error.
      return res.status(502).json({ error: failures[0].error })
    }

    const succeeded = results.filter((r) => !r.error)
    const platforms = [...new Set(succeeded.map((r) => platformById[r.channelId]).filter(Boolean))]
    const status = scheduledAt ? 'scheduled' : 'posted'

    if (db) {
      const { error: dbErr } = await db.from('marketing_posts').insert({
        text,
        content: text,
        platform: platforms[0] || 'twitter',
        platforms,
        profile_ids: succeeded.map((r) => r.channelId),
        image_url: imageUrl || null,
        status,
        buffer_post_id: succeeded[0]?.postId || null,
        scheduled_at: scheduledAt || null,
        posted_at: scheduledAt ? null : new Date().toISOString(),
        created_by: req.user.id,
      })
      if (dbErr) {
        logger.warn({ err: dbErr.message }, 'failed to save marketing post record')
      }
    }

    logger.info(
      { status, succeeded: succeeded.length, failed: failures.length },
      'social post done'
    )
    return res.json({
      status,
      posted: succeeded.length,
      failed: failures.length,
      errors: failures.map((f) => f.error),
    })
  } catch (err) {
    logger.error({ err: err.message }, 'social/post failed')
    next(err)
  }
})

// ---------------------------------------------------------------------------
// GET /social/posts — List recent posts from DB
// ---------------------------------------------------------------------------
router.get('/social/posts', async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })

    const { page, limit, offset } = paginate(req)

    const { data, error, count } = await db
      .from('marketing_posts')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      logger.warn({ err: error.message }, 'failed to fetch marketing posts')
      return res.status(500).json({ error: 'Failed to fetch posts' })
    }

    const shaped = (data || []).map((row) => ({
      id: row.id,
      text: row.text ?? row.content,
      profile_ids: row.profile_ids || [],
      platforms: row.platforms?.length ? row.platforms : row.platform ? [row.platform] : [],
      status: row.status,
      scheduled_at: row.scheduled_at,
      posted_at: row.posted_at,
      impressions: row.impressions || 0,
      engagement: row.engagement || 0,
      created_at: row.created_at,
    }))

    return res.json({
      data: shaped,
      pagination: {
        total: count ?? 0,
        page,
        limit,
        pages: Math.ceil((count ?? 0) / limit) || 1,
      },
    })
  } catch (err) {
    logger.error({ err: err.message }, 'social/posts failed')
    next(err)
  }
})

// ---------------------------------------------------------------------------
// POST /ads/campaigns — Create Google Ads campaign
// ---------------------------------------------------------------------------
router.post('/ads/campaigns', async (req, res, next) => {
  try {
    if (!googleAdsService.isAvailable()) {
      return res.status(503).json({ error: 'Google Ads is not configured' })
    }

    const { name, keywords, headlines, descriptions } = req.body
    const dailyBudget = Number(req.body.daily_budget ?? req.body.dailyBudget)

    if (!name || !dailyBudget) {
      return res.status(400).json({ error: 'name and daily_budget are required' })
    }
    if (dailyBudget <= 0 || dailyBudget > 10000) {
      return res.status(400).json({ error: 'daily_budget must be between 0.01 and 10000' })
    }

    logger.info(
      { name, dailyBudget, keywordCount: keywords?.length },
      'ads campaign creation requested'
    )

    const { data, error } = await googleAdsService.createCampaign({
      name,
      dailyBudget,
      keywords,
      headlines,
      descriptions,
    })
    if (error) return res.status(502).json({ error })

    let saved = null
    if (db) {
      const { data: row, error: dbErr } = await db
        .from('marketing_google_ads')
        .insert({
          name,
          google_campaign_id: data.campaignId,
          daily_budget_gbp: dailyBudget,
          daily_budget: dailyBudget,
          keywords: keywords || [],
          headlines: headlines || [],
          descriptions: descriptions || [],
          status: data.status || 'paused',
          created_by: req.user.id,
        })
        .select()
        .single()
      if (dbErr) {
        logger.warn({ err: dbErr.message }, 'failed to save google ads campaign record')
      } else {
        saved = row
      }
    }

    logger.info({ campaignId: data.campaignId, name }, 'ads campaign created')
    return res.json({ data: saved ? adToUi(saved) : { ...data, daily_budget: dailyBudget } })
  } catch (err) {
    logger.error({ err: err.message }, 'ads/campaigns create failed')
    next(err)
  }
})

// ---------------------------------------------------------------------------
// GET /ads/campaigns — List campaigns with stats
// ---------------------------------------------------------------------------
router.get('/ads/campaigns', async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })

    // If Google Ads is available, try to sync live stats first.
    if (googleAdsService.isAvailable()) {
      try {
        const { data: liveCampaigns } = await googleAdsService.listCampaigns()
        if (liveCampaigns?.length) {
          for (const c of liveCampaigns) {
            await db
              .from('marketing_google_ads')
              .update({
                impressions: c.impressions,
                clicks: c.clicks,
                conversions: c.conversions,
                spend_gbp: c.spend_gbp,
                spend: c.spend_gbp,
                status: c.status,
                synced_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq('google_campaign_id', String(c.id))
          }
        }
      } catch (syncErr) {
        logger.warn({ err: syncErr.message }, 'failed to sync google ads stats')
        // Continue with cached DB data
      }
    }

    const { page, limit, offset } = paginate(req)

    const { data, error, count } = await db
      .from('marketing_google_ads')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      logger.warn({ err: error.message }, 'failed to fetch google ads campaigns')
      return res.status(500).json({ error: 'Failed to fetch campaigns' })
    }

    return res.json({
      data: (data || []).map(adToUi),
      pagination: {
        total: count ?? 0,
        page,
        limit,
        pages: Math.ceil((count ?? 0) / limit) || 1,
      },
      google_ads_available: googleAdsService.isAvailable(),
    })
  } catch (err) {
    logger.error({ err: err.message }, 'ads/campaigns list failed')
    next(err)
  }
})

// ---------------------------------------------------------------------------
// PATCH /ads/campaigns/:id — Pause/resume campaign
// ---------------------------------------------------------------------------
router.patch('/ads/campaigns/:id', async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })

    const { id } = req.params
    const { status } = req.body

    // UI sends 'active' | 'paused'.
    if (!status || !UI_STATUS_TO_DB[status]) {
      return res.status(400).json({ error: 'status must be "active" or "paused"' })
    }
    const dbStatus = UI_STATUS_TO_DB[status]

    const { data: campaign, error: fetchErr } = await db
      .from('marketing_google_ads')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (fetchErr) {
      logger.warn({ err: fetchErr.message, id }, 'failed to fetch campaign for update')
      return res.status(500).json({ error: 'Failed to fetch campaign' })
    }
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' })
    }

    if (googleAdsService.isAvailable() && campaign.google_campaign_id) {
      const result =
        dbStatus === 'paused'
          ? await googleAdsService.pauseCampaign(campaign.google_campaign_id)
          : await googleAdsService.resumeCampaign(campaign.google_campaign_id)
      if (result.error) return res.status(502).json({ error: result.error })
    }

    const { data: updated, error: updateErr } = await db
      .from('marketing_google_ads')
      .update({ status: dbStatus, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (updateErr) {
      logger.warn({ err: updateErr.message, id }, 'failed to update campaign status')
      return res.status(500).json({ error: 'Failed to update campaign' })
    }

    logger.info({ id, status: dbStatus }, 'ads campaign status updated')
    return res.json({ data: adToUi(updated) })
  } catch (err) {
    logger.error({ err: err.message }, 'ads/campaigns patch failed')
    next(err)
  }
})

// ---------------------------------------------------------------------------
// GET /autopilot — automation status
// ---------------------------------------------------------------------------
router.get('/autopilot', async (req, res, next) => {
  try {
    return res.json({
      enabled: autopilotEnabled(),
      claude: isClaudeAvailable(),
      buffer: bufferService.isAvailable(),
      schedule: 'Mon/Wed/Fri 09:00 UTC',
    })
  } catch (err) {
    logger.error({ err: err.message }, 'autopilot status failed')
    next(err)
  }
})

// ---------------------------------------------------------------------------
// POST /autopilot/run — run one autopilot cycle now (manual trigger/test)
// ---------------------------------------------------------------------------
router.post('/autopilot/run', async (req, res, next) => {
  try {
    const summary = await runAutopilot({ force: true })
    logger.info({ summary }, 'autopilot manual run')
    return res.json({ data: summary })
  } catch (err) {
    logger.error({ err: err.message }, 'autopilot manual run failed')
    next(err)
  }
})

export default router
