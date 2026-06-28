// Google Ads REST API v18 service — lazy-loads when credentials are set.
// Uses native fetch (Node 20+). All functions return { data, error } pattern.
//
// Required env vars:
//   GOOGLE_ADS_DEVELOPER_TOKEN  — from your Google Ads API Centre
//   GOOGLE_ADS_CLIENT_ID        — OAuth2 client ID
//   GOOGLE_ADS_CLIENT_SECRET    — OAuth2 client secret
//   GOOGLE_ADS_REFRESH_TOKEN    — long-lived refresh token
//   GOOGLE_ADS_CUSTOMER_ID      — 10-digit account ID (no dashes)
//   GOOGLE_ADS_LOGIN_CUSTOMER_ID — manager account ID (optional, for MCC)

import { logger } from '../logger.js'

const API_VERSION = 'v18'
const BASE_URL = `https://googleads.googleapis.com/${API_VERSION}`
const TOKEN_URL = 'https://oauth2.googleapis.com/token'

// ---- Auth ----

let _accessToken = null
let _tokenExpiry = 0

/**
 * Returns true if Google Ads integration is configured.
 */
export function isAvailable() {
  return Boolean(
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN &&
    process.env.GOOGLE_ADS_CLIENT_ID &&
    process.env.GOOGLE_ADS_CLIENT_SECRET &&
    process.env.GOOGLE_ADS_REFRESH_TOKEN &&
    process.env.GOOGLE_ADS_CUSTOMER_ID
  )
}

async function getAccessToken() {
  if (_accessToken && Date.now() < _tokenExpiry) {
    return _accessToken
  }

  try {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_ADS_CLIENT_ID,
        client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
        refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN,
        grant_type: 'refresh_token',
      }),
      signal: AbortSignal.timeout(10_000),
    })

    if (!res.ok) {
      const body = await res.text()
      logger.error({ status: res.status, body }, 'google ads token refresh failed')
      throw new Error(`Token refresh failed: ${res.status}`)
    }

    const data = await res.json()
    _accessToken = data.access_token
    // Refresh 60s before actual expiry
    _tokenExpiry = Date.now() + (data.expires_in - 60) * 1000
    return _accessToken
  } catch (err) {
    logger.error({ err: err.message }, 'google ads getAccessToken exception')
    throw err
  }
}

function customerId() {
  return process.env.GOOGLE_ADS_CUSTOMER_ID.replace(/-/g, '')
}

function defaultHeaders(token) {
  const headers = {
    'Authorization': `Bearer ${token}`,
    'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
    'Content-Type': 'application/json',
  }
  if (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID) {
    headers['login-customer-id'] = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID.replace(/-/g, '')
  }
  return headers
}

// ---- GAQL query helper ----

async function searchStream(query) {
  const token = await getAccessToken()
  const cid = customerId()
  const url = `${BASE_URL}/customers/${cid}/googleAds:searchStream`

  const res = await fetch(url, {
    method: 'POST',
    headers: defaultHeaders(token),
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(30_000),
  })

  if (!res.ok) {
    const body = await res.text()
    logger.warn({ status: res.status, body }, 'google ads searchStream failed')
    throw new Error(`Google Ads API error: ${res.status}`)
  }

  const data = await res.json()
  // searchStream returns an array of batches; flatten the results
  const rows = []
  for (const batch of data) {
    if (batch.results) rows.push(...batch.results)
  }
  return rows
}

// ---- Mutate helper ----

async function mutate(resourceType, operations) {
  const token = await getAccessToken()
  const cid = customerId()
  const url = `${BASE_URL}/customers/${cid}/${resourceType}:mutate`

  const res = await fetch(url, {
    method: 'POST',
    headers: defaultHeaders(token),
    body: JSON.stringify({ operations }),
    signal: AbortSignal.timeout(30_000),
  })

  if (!res.ok) {
    const body = await res.text()
    logger.warn({ status: res.status, body }, `google ads mutate ${resourceType} failed`)
    throw new Error(`Google Ads mutate error: ${res.status}`)
  }

  return res.json()
}

// ---- Public API ----

/**
 * List all campaigns with basic stats.
 */
export async function listCampaigns() {
  if (!isAvailable()) {
    return { data: null, error: 'Google Ads is not configured' }
  }

  try {
    const query = `
      SELECT
        campaign.id,
        campaign.name,
        campaign.status,
        campaign.campaign_budget,
        metrics.impressions,
        metrics.clicks,
        metrics.conversions,
        metrics.cost_micros
      FROM campaign
      WHERE campaign.status != 'REMOVED'
      ORDER BY campaign.id DESC
    `
    const rows = await searchStream(query)
    const campaigns = rows.map((r) => ({
      id: r.campaign?.id,
      name: r.campaign?.name,
      status: r.campaign?.status?.toLowerCase(),
      impressions: parseInt(r.metrics?.impressions || '0', 10),
      clicks: parseInt(r.metrics?.clicks || '0', 10),
      conversions: parseFloat(r.metrics?.conversions || '0'),
      spend_gbp: parseInt(r.metrics?.costMicros || '0', 10) / 1_000_000,
    }))

    logger.info({ count: campaigns.length }, 'google ads campaigns listed')
    return { data: campaigns, error: null }
  } catch (err) {
    logger.error({ err: err.message }, 'google ads listCampaigns exception')
    return { data: null, error: err.message }
  }
}

/**
 * Create a Search campaign with one ad group containing responsive search ads.
 */
export async function createCampaign({ name, dailyBudget, keywords, headlines, descriptions }) {
  if (!isAvailable()) {
    return { data: null, error: 'Google Ads is not configured' }
  }

  if (!name || !dailyBudget) {
    return { data: null, error: 'name and dailyBudget are required' }
  }

  try {
    const cid = customerId()

    // 1. Create campaign budget
    const budgetRes = await mutate('campaignBudgets', [
      {
        create: {
          name: `${name} Budget`,
          amountMicros: String(Math.round(dailyBudget * 1_000_000)),
          deliveryMethod: 'STANDARD',
        },
      },
    ])
    const budgetResourceName = budgetRes.results?.[0]?.resourceName
    if (!budgetResourceName) throw new Error('Failed to create campaign budget')

    // 2. Create campaign
    const campaignRes = await mutate('campaigns', [
      {
        create: {
          name,
          advertisingChannelType: 'SEARCH',
          status: 'PAUSED', // Start paused for review
          campaignBudget: budgetResourceName,
          manualCpc: {},
          networkSettings: {
            targetGoogleSearch: true,
            targetSearchNetwork: false,
            targetContentNetwork: false,
          },
        },
      },
    ])
    const campaignResourceName = campaignRes.results?.[0]?.resourceName
    if (!campaignResourceName) throw new Error('Failed to create campaign')

    // 3. Create ad group
    const adGroupRes = await mutate('adGroups', [
      {
        create: {
          name: `${name} Ad Group`,
          campaign: campaignResourceName,
          status: 'ENABLED',
          type: 'SEARCH_STANDARD',
          cpcBidMicros: '1000000', // £1 default CPC
        },
      },
    ])
    const adGroupResourceName = adGroupRes.results?.[0]?.resourceName
    if (!adGroupResourceName) throw new Error('Failed to create ad group')

    // 4. Add keywords
    if (keywords?.length) {
      const keywordOps = keywords.map((kw) => ({
        create: {
          adGroup: adGroupResourceName,
          status: 'ENABLED',
          keyword: {
            text: kw,
            matchType: 'BROAD',
          },
        },
      }))
      await mutate('adGroupCriteria', keywordOps)
    }

    // 5. Create responsive search ad
    if (headlines?.length && descriptions?.length) {
      const headlineAssets = headlines.slice(0, 15).map((h) => ({
        text: h.slice(0, 30),
      }))
      const descriptionAssets = descriptions.slice(0, 4).map((d) => ({
        text: d.slice(0, 90),
      }))

      await mutate('adGroupAds', [
        {
          create: {
            adGroup: adGroupResourceName,
            status: 'ENABLED',
            ad: {
              responsiveSearchAd: {
                headlines: headlineAssets,
                descriptions: descriptionAssets,
              },
              finalUrls: ['https://nurserymatch.com'],
            },
          },
        },
      ])
    }

    // Extract campaign ID from resource name (customers/{cid}/campaigns/{id})
    const campaignId = campaignResourceName.split('/').pop()

    logger.info({ campaignId, name }, 'google ads campaign created')
    return {
      data: {
        campaignId,
        resourceName: campaignResourceName,
        name,
        status: 'paused',
        dailyBudget,
      },
      error: null,
    }
  } catch (err) {
    logger.error({ err: err.message }, 'google ads createCampaign exception')
    return { data: null, error: err.message }
  }
}

/**
 * Pause a campaign.
 */
export async function pauseCampaign(campaignId) {
  if (!isAvailable()) {
    return { data: null, error: 'Google Ads is not configured' }
  }

  try {
    const cid = customerId()
    const resourceName = `customers/${cid}/campaigns/${campaignId}`
    await mutate('campaigns', [
      {
        update: { resourceName, status: 'PAUSED' },
        updateMask: 'status',
      },
    ])
    logger.info({ campaignId }, 'google ads campaign paused')
    return { data: { campaignId, status: 'paused' }, error: null }
  } catch (err) {
    logger.error({ err: err.message, campaignId }, 'google ads pauseCampaign exception')
    return { data: null, error: err.message }
  }
}

/**
 * Resume (enable) a campaign.
 */
export async function resumeCampaign(campaignId) {
  if (!isAvailable()) {
    return { data: null, error: 'Google Ads is not configured' }
  }

  try {
    const cid = customerId()
    const resourceName = `customers/${cid}/campaigns/${campaignId}`
    await mutate('campaigns', [
      {
        update: { resourceName, status: 'ENABLED' },
        updateMask: 'status',
      },
    ])
    logger.info({ campaignId }, 'google ads campaign resumed')
    return { data: { campaignId, status: 'enabled' }, error: null }
  } catch (err) {
    logger.error({ err: err.message, campaignId }, 'google ads resumeCampaign exception')
    return { data: null, error: err.message }
  }
}

/**
 * Get campaign performance stats.
 */
export async function getCampaignStats(campaignId) {
  if (!isAvailable()) {
    return { data: null, error: 'Google Ads is not configured' }
  }

  try {
    const query = `
      SELECT
        campaign.id,
        campaign.name,
        campaign.status,
        metrics.impressions,
        metrics.clicks,
        metrics.conversions,
        metrics.cost_micros
      FROM campaign
      WHERE campaign.id = ${campaignId}
    `
    const rows = await searchStream(query)
    if (!rows.length) {
      return { data: null, error: 'Campaign not found' }
    }

    const r = rows[0]
    const stats = {
      id: r.campaign?.id,
      name: r.campaign?.name,
      status: r.campaign?.status?.toLowerCase(),
      impressions: parseInt(r.metrics?.impressions || '0', 10),
      clicks: parseInt(r.metrics?.clicks || '0', 10),
      conversions: parseFloat(r.metrics?.conversions || '0'),
      spend_gbp: parseInt(r.metrics?.costMicros || '0', 10) / 1_000_000,
    }

    return { data: stats, error: null }
  } catch (err) {
    logger.error({ err: err.message, campaignId }, 'google ads getCampaignStats exception')
    return { data: null, error: err.message }
  }
}

export default {
  isAvailable,
  listCampaigns,
  createCampaign,
  pauseCampaign,
  resumeCampaign,
  getCampaignStats,
}
