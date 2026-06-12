// Marketing autopilot — automated social acquisition.
//
// On a schedule (see worker.js) this generates an on-brand, locally-relevant
// social post via Claude and queues it to every connected Buffer channel, with
// a UTM-tagged link back to the site so traffic is measurable in Plausible.
//
// Safe by default: no-ops unless MARKETING_AUTOPILOT_ENABLED=true AND both
// Claude and Buffer are configured. Instagram is only targeted when a default
// branded image URL is provided (IG cannot post text-only).

import db from '../db.js'
import { logger } from '../logger.js'
import { callClaude, isClaudeAvailable } from './claudeApi.js'
import * as bufferService from './bufferService.js'
import { loadGuides, weeklyIndex } from './contentLibrary.js'

const SYSTEM_PROMPT =
  'You are a social media copywriter for NurseryMatch, a UK nursery comparison website ' +
  'that lets parents compare Ofsted/Care Inspectorate/CIW ratings, fees and availability. ' +
  'Write ONE engaging, concise post (under 240 characters, British English, warm and helpful). ' +
  'End with a clear call to action to visit the site. Do not include hashtags or the URL ' +
  '(both are appended automatically). Return only the post text.'

// Rotating content themes — keeps the feed varied across runs.
export const THEMES = [
  'local', // filled with a real popular district below
  'funded-hours',
  'visit-checklist',
  'nursery-vs-childminder',
  'compare-fees',
  'ofsted-ratings',
]

export function isEnabled() {
  return process.env.MARKETING_AUTOPILOT_ENABLED === 'true'
}

// Deterministic theme rotation by day, so reruns on the same day are stable
// but the theme changes day to day.
export function pickTheme(date = new Date(), themes = THEMES) {
  const dayIndex = Math.floor(date.getTime() / 86400000)
  return themes[dayIndex % themes.length]
}

// Append UTM params without clobbering an existing query string.
export function withUtm(baseUrl, { campaign = 'autopilot', content } = {}) {
  const sep = baseUrl.includes('?') ? '&' : '?'
  const params = new URLSearchParams({
    utm_source: 'social',
    utm_medium: 'organic_social',
    utm_campaign: campaign,
  })
  if (content) params.set('utm_content', content)
  return `${baseUrl}${sep}${params.toString()}`
}

// Map a theme to the highest-intent landing page on the site, so social
// traffic lands where it is most likely to convert (and reinforces that page's
// SEO). Returns a path to append to FRONTEND_URL.
export function landingPath(theme, { district } = {}) {
  switch (theme) {
    case 'local':
      return district ? `/nurseries-in/${district.toLowerCase()}` : '/search'
    case 'visit-checklist':
      return '/guides/questions-to-ask-nursery-visit'
    case 'nursery-vs-childminder':
      return '/guides/nursery-vs-childminder'
    case 'funded-hours':
    case 'compare-fees':
    case 'ofsted-ratings':
      return '/search'
    default:
      return '/'
  }
}

// Build the generation brief for a theme. `district` is an optional real
// postcode district used to localise the 'local' theme.
export function buildBrief(theme, { district } = {}) {
  switch (theme) {
    case 'local':
      return district
        ? `Finding a nursery in ${district}: compare Ofsted-rated nurseries near you by fees and availability.`
        : 'Finding a nursery near you: compare Ofsted-rated nurseries by fees and availability.'
    case 'funded-hours':
      return 'Making the most of funded childcare hours in England — what parents need to know.'
    case 'visit-checklist':
      return 'The key questions every parent should ask on a nursery visit.'
    case 'nursery-vs-childminder':
      return 'Nursery vs childminder: how to choose what is right for your family.'
    case 'compare-fees':
      return 'Nursery fees vary a lot street to street — how to compare the true cost.'
    case 'ofsted-ratings':
      return 'What an Ofsted rating really tells you (and what it does not) when choosing a nursery.'
    default:
      return 'Compare nurseries near you on NurseryMatch.'
  }
}

// Pull a popular postcode district to localise the 'local' theme. Best-effort.
async function topDistrict() {
  if (!db) return null
  try {
    const { data } = await db
      .from('postcode_areas')
      .select('postcode_district, nursery_count_total')
      .not('postcode_district', 'is', null)
      .order('nursery_count_total', { ascending: false, nullsFirst: false })
      .limit(25)
    if (!data?.length) return null
    // Rotate within the top set by day so the localised post varies.
    const idx = Math.floor(Date.now() / 86400000) % data.length
    return data[idx]?.postcode_district || null
  } catch (err) {
    logger.warn({ err: err?.message }, 'autopilot: topDistrict lookup failed')
    return null
  }
}

/**
 * Run one autopilot cycle. Returns a summary object; throws only on unexpected
 * errors (so the job tracker records a failure).
 */
export async function runAutopilot({ now = new Date(), force = false } = {}) {
  // The scheduled cron requires the feature flag; a manual admin trigger
  // (force) bypasses it so the pipeline can be tested before enabling.
  if (!force && !isEnabled()) return { skipped: 'MARKETING_AUTOPILOT_ENABLED is not true' }
  if (!isClaudeAvailable()) return { skipped: 'Claude not configured' }
  if (!bufferService.isAvailable()) return { skipped: 'Buffer not configured' }

  const { data: channels, error: chErr } = await bufferService.getProfiles()
  if (chErr) throw new Error(`autopilot: could not load channels: ${chErr}`)
  if (!channels?.length) return { skipped: 'no connected Buffer channels' }

  const theme = pickTheme(now)
  const district = theme === 'local' ? await topDistrict() : null
  const brief = buildBrief(theme, { district })

  const copy = await callClaude({
    prompt: `Write the post. Topic: ${brief}`,
    system: SYSTEM_PROMPT,
    maxTokens: 300,
  })
  const landing = `${siteUrl()}${landingPath(theme, { district })}`
  const text = `${copy.trim()}\n\n${withUtm(landing, { content: theme })}`

  const imageUrl = process.env.MARKETING_DEFAULT_IMAGE_URL || null
  const { results, posted } = await postToChannels(channels, { text, imageUrl })
  await recordPost({ text, imageUrl, theme, brief, channels, posted })

  logger.info(
    { theme, district, channels: channels.length, posted: posted.length },
    'autopilot: cycle complete'
  )
  return { theme, district, channels: channels.length, posted: posted.length, results }
}

// Shared posting helper — queues `text` to every channel, skipping Instagram
// when no image is available. Returns { results, posted }.
async function postToChannels(channels, { text, imageUrl }) {
  const results = []
  for (const ch of channels) {
    if (ch.service === 'instagram' && !imageUrl) {
      results.push({ channelId: ch.id, skipped: 'instagram requires an image' })
      continue
    }
    const { data, error } = await bufferService.createPost({
      text,
      channelId: ch.id,
      imageUrl: ch.service === 'instagram' ? imageUrl : imageUrl || undefined,
    })
    results.push({ channelId: ch.id, service: ch.service, postId: data?.id || null, error })
  }
  return { results, posted: results.filter((r) => r.postId) }
}

/**
 * Content syndication — auto-share a site guide to social each week, with a
 * tracked link. Drives referral traffic and fresh crawls of the guide pages.
 * Same gating as the autopilot.
 */
export async function runContentSyndication({ now = new Date(), force = false } = {}) {
  if (!force && !isEnabled()) return { skipped: 'MARKETING_AUTOPILOT_ENABLED is not true' }
  if (!bufferService.isAvailable()) return { skipped: 'Buffer not configured' }

  const guides = loadGuides()
  if (!guides.length) return { skipped: 'no guides found' }

  const { data: channels, error: chErr } = await bufferService.getProfiles()
  if (chErr) throw new Error(`syndication: could not load channels: ${chErr}`)
  if (!channels?.length) return { skipped: 'no connected Buffer channels' }

  const guide = guides[weeklyIndex(now, guides.length)]
  const link = withUtm(`${siteUrl()}/guides/${guide.slug}`, {
    campaign: 'content',
    content: guide.slug,
  })

  // Use Claude for a fresh hook when available; otherwise fall back to the
  // guide's own excerpt so syndication still works without AI configured.
  let hook = guide.excerpt
  if (isClaudeAvailable()) {
    try {
      hook = (
        await callClaude({
          prompt: `Write a one-sentence social hook (British English, under 180 chars, no hashtags, no URL) to get parents to read this NurseryMatch guide titled "${guide.title}". Context: ${guide.excerpt}`,
          system: SYSTEM_PROMPT,
          maxTokens: 120,
        })
      ).trim()
    } catch (err) {
      logger.warn({ err: err?.message }, 'syndication: claude hook failed, using excerpt')
    }
  }

  const text = `${hook}\n\n${link}`
  const imageUrl = process.env.MARKETING_DEFAULT_IMAGE_URL || null
  const { results, posted } = await postToChannels(channels, { text, imageUrl })

  await recordPost({
    text,
    imageUrl,
    theme: `guide:${guide.slug}`,
    brief: guide.title,
    channels,
    posted,
  })

  logger.info({ slug: guide.slug, posted: posted.length }, 'syndication: cycle complete')
  return { slug: guide.slug, title: guide.title, posted: posted.length, results }
}

function siteUrl() {
  return process.env.FRONTEND_URL || 'https://nurserymatch.com'
}

async function recordPost({ text, imageUrl, theme, brief, channels, posted }) {
  if (!db) return
  try {
    await db.from('marketing_content').insert({
      type: 'social',
      content_type: 'social_post',
      topic: brief,
      tone: 'friendly',
      prompt_used: `autopilot:${theme}`,
      content: text,
      status: 'published',
    })
    if (posted.length > 0) {
      const platforms = [...new Set(posted.map((p) => p.service).filter(Boolean))]
      await db.from('marketing_posts').insert({
        text,
        content: text,
        platform: platforms[0] || channels[0]?.service || 'twitter',
        platforms,
        profile_ids: posted.map((p) => p.channelId),
        image_url: imageUrl || null,
        status: 'posted',
        buffer_post_id: posted[0]?.postId || null,
        posted_at: new Date().toISOString(),
      })
    }
  } catch (err) {
    logger.warn({ err: err?.message }, 'autopilot: failed to record post')
  }
}

export default {
  isEnabled,
  runAutopilot,
  runContentSyndication,
  pickTheme,
  withUtm,
  buildBrief,
  landingPath,
  THEMES,
}
