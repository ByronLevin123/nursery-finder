// Google Search Console integration — pulls organic search clicks / impressions
// so the activity dashboards can be compared against what Google reports.
//
// Uses the same OAuth2 refresh-token flow as the other Google APIs (no SDK, REST
// only). The refresh token MUST be authorised for the
// https://www.googleapis.com/auth/webmasters.readonly scope.
//
// Required env vars:
//   GSC_SITE_URL       e.g. "sc-domain:nurserymatch.com" (Domain property) or
//                      "https://nurserymatch.com/" (URL-prefix property). Must match
//                      exactly how the property is verified in Search Console.
//   GSC_CLIENT_ID      OAuth client id (falls back to GOOGLE_ADS_CLIENT_ID)
//   GSC_CLIENT_SECRET  OAuth client secret (falls back to GOOGLE_ADS_CLIENT_SECRET)
//   GSC_REFRESH_TOKEN  webmasters.readonly-scoped refresh token
//
// Every export degrades gracefully: when credentials are missing the helpers
// return null (or empty maps) instead of throwing, so the dashboards keep
// working without Search Console configured.
//
// Docs: https://developers.google.com/webmaster-tools/v1/searchanalytics/query

import NodeCache from 'node-cache'
import { logger } from '../logger.js'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const API_BASE = 'https://searchconsole.googleapis.com/webmasters/v3'

// Search Console data only refreshes roughly daily, so cache aggressively to
// stay well within the API quota (and keep dashboard loads fast).
const gscCache = new NodeCache({ stdTTL: 6 * 3600, checkperiod: 600 })

let cachedToken = null
let tokenExpiry = 0

function clientId() {
  return process.env.GSC_CLIENT_ID || process.env.GOOGLE_ADS_CLIENT_ID
}
function clientSecret() {
  return process.env.GSC_CLIENT_SECRET || process.env.GOOGLE_ADS_CLIENT_SECRET
}

/**
 * True when all credentials needed to call Search Console are present.
 */
export function isConfigured() {
  return Boolean(
    process.env.GSC_SITE_URL && clientId() && clientSecret() && process.env.GSC_REFRESH_TOKEN
  )
}

/**
 * Get a valid OAuth2 access token, refreshing if needed (60s buffer).
 */
async function getAccessToken() {
  if (!isConfigured()) throw new Error('Search Console credentials not configured')

  if (cachedToken && Date.now() < tokenExpiry - 60000) {
    return cachedToken
  }

  const params = new URLSearchParams({
    client_id: clientId(),
    client_secret: clientSecret(),
    refresh_token: process.env.GSC_REFRESH_TOKEN,
    grant_type: 'refresh_token',
  })

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
    signal: AbortSignal.timeout(15000),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Search Console token refresh failed (${res.status}): ${text}`)
  }

  const data = await res.json()
  cachedToken = data.access_token
  tokenExpiry = Date.now() + (data.expires_in || 3600) * 1000
  return cachedToken
}

/**
 * YYYY-MM-DD for `days` ago (UTC). Search Console only accepts whole dates.
 */
function isoDaysAgo(days) {
  return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
}

/**
 * Run a searchAnalytics.query against the configured property.
 * @returns {Promise<Array<{keys?: string[], clicks: number, impressions: number, ctr: number, position: number}>>}
 */
async function query({ days = 28, dimensions = [], rowLimit = 1000 } = {}) {
  const token = await getAccessToken()
  const siteUrl = encodeURIComponent(process.env.GSC_SITE_URL)

  const res = await fetch(`${API_BASE}/sites/${siteUrl}/searchAnalytics/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      // Search Console data lags ~2-3 days; start a touch earlier than the
      // window and let it cap at the latest available date.
      startDate: isoDaysAgo(days),
      endDate: isoDaysAgo(0),
      dimensions,
      rowLimit,
    }),
    signal: AbortSignal.timeout(20000),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Search Console query failed (${res.status}): ${text}`)
  }

  const data = await res.json()
  return data.rows || []
}

function round(n, dp = 1) {
  const f = 10 ** dp
  return Math.round((n || 0) * f) / f
}

/**
 * Site-wide totals over the trailing window — this is the "53 clicks" figure
 * shown in Search Console's own overview.
 *
 * @returns {Promise<{clicks:number, impressions:number, ctr:number, position:number, days:number}|null>}
 */
export async function getSiteTotals({ days = 28 } = {}) {
  if (!isConfigured()) return null
  const cacheKey = `site:${days}`
  const hit = gscCache.get(cacheKey)
  if (hit !== undefined) return hit

  try {
    const rows = await query({ days, dimensions: [], rowLimit: 1 })
    const row = rows[0]
    const totals = row
      ? {
          clicks: row.clicks || 0,
          impressions: row.impressions || 0,
          ctr: round((row.ctr || 0) * 100, 2), // percent
          position: round(row.position || 0, 1),
          days,
        }
      : { clicks: 0, impressions: 0, ctr: 0, position: 0, days }
    gscCache.set(cacheKey, totals)
    return totals
  } catch (err) {
    logger.warn({ err: err.message }, 'search-console: site totals fetch failed')
    return null
  }
}

/**
 * Extract a nursery URN from a Search Console page URL.
 * Profile pages are served at /nursery/{urn}.
 */
function urnFromPage(pageUrl) {
  const m = /\/nursery\/([^/?#]+)/.exec(pageUrl || '')
  return m ? decodeURIComponent(m[1]) : null
}

/**
 * Per-nursery Search Console stats, keyed by URN, over the trailing window.
 * Aggregates every page row that maps to a /nursery/{urn} path.
 *
 * @returns {Promise<Map<string, {clicks:number, impressions:number, ctr:number, position:number}>>}
 *          Empty map when not configured or on error.
 */
export async function getStatsByUrn({ days = 28 } = {}) {
  const result = new Map()
  if (!isConfigured()) return result

  const cacheKey = `byurn:${days}`
  const hit = gscCache.get(cacheKey)
  if (hit !== undefined) return hit

  try {
    const rows = await query({ days, dimensions: ['page'], rowLimit: 25000 })
    // Position is a weighted average; weight by impressions so aggregation is sound.
    const acc = new Map()
    for (const row of rows) {
      const urn = urnFromPage(row.keys?.[0])
      if (!urn) continue
      const cur = acc.get(urn) || { clicks: 0, impressions: 0, posWeighted: 0 }
      cur.clicks += row.clicks || 0
      cur.impressions += row.impressions || 0
      cur.posWeighted += (row.position || 0) * (row.impressions || 0)
      acc.set(urn, cur)
    }
    for (const [urn, v] of acc) {
      result.set(urn, {
        clicks: v.clicks,
        impressions: v.impressions,
        ctr: v.impressions > 0 ? round((v.clicks / v.impressions) * 100, 2) : 0,
        position: v.impressions > 0 ? round(v.posWeighted / v.impressions, 1) : 0,
      })
    }
    gscCache.set(cacheKey, result)
    return result
  } catch (err) {
    logger.warn({ err: err.message }, 'search-console: per-nursery stats fetch failed')
    return result
  }
}
