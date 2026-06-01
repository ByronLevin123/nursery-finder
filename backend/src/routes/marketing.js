// Marketing Hub API — social posts (Buffer), Google Ads campaigns, AI content generation.
// ALL routes require requireRole('admin').

import express from 'express'
import db from '../db.js'
import { requireRole } from '../middleware/supabaseAuth.js'
import { logger } from '../logger.js'
import { callClaude, isClaudeAvailable } from '../services/claudeApi.js'
import * as bufferService from '../services/bufferService.js'
import * as googleAdsService from '../services/googleAdsService.js'

const router = express.Router()

// Every route on this router requires admin role
router.use(requireRole('admin'))

// ---------------------------------------------------------------------------
// POST /generate-content — Generate social/blog/ad copy via Claude AI
// ---------------------------------------------------------------------------
router.post('/generate-content', async (req, res, next) => {
  try {
    if (!isClaudeAvailable()) {
      return res.status(503).json({ error: 'Claude AI is not configured' })
    }

    const { type, topic, tone, platform } = req.body

    if (!type || !topic) {
      return res.status(400).json({ error: 'type and topic are required' })
    }

    const validTypes = ['social', 'blog', 'ad_copy']
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: `type must be one of: ${validTypes.join(', ')}` })
    }

    const systemPrompts = {
      social: `You are a social media copywriter for NurseryMatch, a UK nursery comparison website. Write engaging, concise social media posts. Use a ${tone || 'friendly'} tone. ${platform ? `Optimise for ${platform}.` : ''} Do not use hashtags unless specifically asked. Keep posts under 280 characters for Twitter/X.`,
      blog: `You are a content writer for NurseryMatch, a UK nursery comparison website helping parents find the best nurseries. Write informative, SEO-friendly blog content in a ${tone || 'helpful'} tone. Use British English. Include a compelling headline.`,
      ad_copy: `You are an advertising copywriter for NurseryMatch, a UK nursery comparison website. Write compelling Google Ads copy. Keep headlines under 30 characters and descriptions under 90 characters. Use a ${tone || 'persuasive'} tone. Focus on parent benefits.`,
    }

    const prompt = `Write ${type === 'social' ? 'a social media post' : type === 'blog' ? 'a blog article' : 'Google Ads copy'} about: ${topic}`

    logger.info({ type, topic, platform }, 'marketing content generation requested')

    const content = await callClaude({
      prompt,
      system: systemPrompts[type],
      maxTokens: type === 'blog' ? 2000 : 500,
    })

    // Save draft to database
    if (db) {
      const { error: dbErr } = await db.from('marketing_content').insert({
        type,
        prompt_used: prompt,
        content,
        status: 'draft',
        created_by: req.user.id,
      })
      if (dbErr) {
        logger.warn({ err: dbErr.message }, 'failed to save marketing content draft')
      }
    }

    logger.info({ type, contentLength: content.length }, 'marketing content generated')
    return res.json({ content, prompt_used: prompt })
  } catch (err) {
    logger.error({ err: err.message }, 'generate-content failed')
    next(err)
  }
})

// ---------------------------------------------------------------------------
// GET /social/profiles — List connected Buffer profiles
// ---------------------------------------------------------------------------
router.get('/social/profiles', async (req, res, next) => {
  try {
    if (!bufferService.isAvailable()) {
      return res.status(503).json({ error: 'Buffer is not configured', available: false })
    }

    const { data, error } = await bufferService.getProfiles()
    if (error) {
      return res.status(502).json({ error })
    }

    return res.json({ data })
  } catch (err) {
    logger.error({ err: err.message }, 'social/profiles failed')
    next(err)
  }
})

// ---------------------------------------------------------------------------
// POST /social/post — Post to social media via Buffer
// ---------------------------------------------------------------------------
router.post('/social/post', async (req, res, next) => {
  try {
    if (!bufferService.isAvailable()) {
      return res.status(503).json({ error: 'Buffer is not configured' })
    }

    const { text, profileIds, scheduledAt, media } = req.body

    if (!text || !profileIds?.length) {
      return res.status(400).json({ error: 'text and profileIds are required' })
    }

    logger.info(
      { profileCount: profileIds.length, scheduled: !!scheduledAt },
      'social post requested'
    )

    const { data, error } = await bufferService.createPost({
      text,
      profileIds,
      media,
      scheduledAt,
    })

    if (error) {
      return res.status(502).json({ error })
    }

    // Save to database
    const bufferPostId = data?.updates?.[0]?.id || null
    const status = scheduledAt ? 'scheduled' : 'posted'

    if (db) {
      // Determine platform from first profile (simplified — Buffer may return profile info)
      for (const pid of profileIds) {
        const { error: dbErr } = await db.from('marketing_posts').insert({
          content: text,
          platform: 'twitter', // Default; ideally resolve from profile
          status,
          buffer_post_id: bufferPostId,
          scheduled_at: scheduledAt || null,
          posted_at: scheduledAt ? null : new Date().toISOString(),
          created_by: req.user.id,
        })
        if (dbErr) {
          logger.warn({ err: dbErr.message, pid }, 'failed to save marketing post record')
        }
      }
    }

    logger.info({ bufferPostId, status }, 'social post created')
    return res.json({ postId: bufferPostId, status })
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

    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20))
    const offset = (page - 1) * limit

    const { data, error, count } = await db
      .from('marketing_posts')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      logger.warn({ err: error.message }, 'failed to fetch marketing posts')
      return res.status(500).json({ error: 'Failed to fetch posts' })
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

    const { name, dailyBudget, keywords, headlines, descriptions } = req.body

    if (!name || !dailyBudget) {
      return res.status(400).json({ error: 'name and dailyBudget are required' })
    }

    if (dailyBudget <= 0 || dailyBudget > 10000) {
      return res.status(400).json({ error: 'dailyBudget must be between 0.01 and 10000' })
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

    if (error) {
      return res.status(502).json({ error })
    }

    // Save to database
    if (db) {
      const { error: dbErr } = await db.from('marketing_google_ads').insert({
        name,
        google_campaign_id: data.campaignId,
        daily_budget_gbp: dailyBudget,
        status: data.status || 'paused',
        created_by: req.user.id,
      })
      if (dbErr) {
        logger.warn({ err: dbErr.message }, 'failed to save google ads campaign record')
      }
    }

    logger.info({ campaignId: data.campaignId, name }, 'ads campaign created')
    return res.json({ data })
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

    // If Google Ads is available, try to sync live stats
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

    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20))
    const offset = (page - 1) * limit

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
      data,
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

    if (!status || !['paused', 'enabled'].includes(status)) {
      return res.status(400).json({ error: 'status must be "paused" or "enabled"' })
    }

    // Fetch campaign from DB
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

    // Update via Google Ads API if available and campaign has a Google ID
    if (googleAdsService.isAvailable() && campaign.google_campaign_id) {
      const result =
        status === 'paused'
          ? await googleAdsService.pauseCampaign(campaign.google_campaign_id)
          : await googleAdsService.resumeCampaign(campaign.google_campaign_id)

      if (result.error) {
        return res.status(502).json({ error: result.error })
      }
    }

    // Update in DB
    const { data: updated, error: updateErr } = await db
      .from('marketing_google_ads')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (updateErr) {
      logger.warn({ err: updateErr.message, id }, 'failed to update campaign status')
      return res.status(500).json({ error: 'Failed to update campaign' })
    }

    logger.info({ id, status }, 'ads campaign status updated')
    return res.json({ data: updated })
  } catch (err) {
    logger.error({ err: err.message }, 'ads/campaigns patch failed')
    next(err)
  }
})

// ---------------------------------------------------------------------------
// GET /content — List AI-generated content drafts
// ---------------------------------------------------------------------------
router.get('/content', async (req, res, next) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not configured' })

    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20))
    const offset = (page - 1) * limit

    let query = db
      .from('marketing_content')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })

    // Optional filters
    if (req.query.type) {
      query = query.eq('type', req.query.type)
    }
    if (req.query.status) {
      query = query.eq('status', req.query.status)
    }

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
// PATCH /content/:id — Update content status (approve/reject/publish)
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

export default router
