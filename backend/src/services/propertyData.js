// PropertyData.co.uk API integration
// Docs: https://propertydata.co.uk/api
// Auth: ?key=... query string. All endpoints take a full UK postcode.
// We sample each postcode district using the first active nursery's full postcode.

import db from '../db.js'
import { logger } from '../logger.js'

const BASE_URL = 'https://api.propertydata.co.uk'
const DEFAULT_TIMEOUT_MS = 15000
const DELAY_BETWEEN_DISTRICTS_MS = 500

function toNumberOrNull(v) {
  if (v == null) return null
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) ? n : null
}

export function parsePrices(json) {
  const avg = json?.data?.average
  return { asking_price_avg: toNumberOrNull(avg) != null ? Math.round(toNumberOrNull(avg)) : null }
}

export function parseRents(json) {
  const avg = json?.data?.long_let?.average
  return { rent_avg_weekly: toNumberOrNull(avg) != null ? Math.round(toNumberOrNull(avg)) : null }
}

export function parseYields(json) {
  const raw = json?.data?.long_let?.gross_yield
  const n = toNumberOrNull(raw)
  return { gross_yield_pct: n != null ? Number(n.toFixed(2)) : null }
}

export function parseDemand(json) {
  const rating = json?.demand_rating ?? json?.data?.demand_rating ?? null
  const dom = json?.days_on_market ?? json?.data?.days_on_market ?? null
  return {
    demand_rating: rating ? String(rating) : null,
    days_on_market: toNumberOrNull(dom) != null ? Math.round(toNumberOrNull(dom)) : null,
  }
}

export function parseGrowth(json) {
  const rows = json?.data
  if (!Array.isArray(rows) || rows.length === 0) return { price_growth_1yr_pct: null }
  const last = rows[rows.length - 1]
  if (!Array.isArray(last) || last.length < 3) return { price_growth_1yr_pct: null }
  const n = toNumberOrNull(last[2])
  return { price_growth_1yr_pct: n != null ? Number(n.toFixed(2)) : null }
}

async function fetchJson(endpoint, params, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const key = process.env.PROPERTYDATA_API_KEY
  if (!key) throw new Error('PROPERTYDATA_API_KEY not set')
  const qs = new URLSearchParams({ key, ...params }).toString()
  const url = `${BASE_URL}${endpoint}?${qs}`
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`propertydata ${endpoint} ${res.status}: ${text.slice(0, 200)}`)
    }
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

export async function fetchDistrictPropertyData(samplePostcode) {
  if (!samplePostcode) throw new Error('samplePostcode required')
  const postcode = String(samplePostcode).trim().toUpperCase()
  const params = { postcode }

  const [prices, rents, yields, demand, growth] = await Promise.all([
    fetchJson('/prices', params).catch((err) => {
      logger.warn({ err: err.message, endpoint: 'prices' }, 'propertydata: endpoint failed')
      return null
    }),
    fetchJson('/rents', params).catch((err) => {
      logger.warn({ err: err.message, endpoint: 'rents' }, 'propertydata: endpoint failed')
      return null
    }),
    fetchJson('/yields', params).catch((err) => {
      logger.warn({ err: err.message, endpoint: 'yields' }, 'propertydata: endpoint failed')
      return null
    }),
    fetchJson('/demand', params).catch((err) => {
      logger.warn({ err: err.message, endpoint: 'demand' }, 'propertydata: endpoint failed')
      return null
    }),
    fetchJson('/growth', params).catch((err) => {
      logger.warn({ err: err.message, endpoint: 'growth' }, 'propertydata: endpoint failed')
      return null
    }),
  ])

  return {
    ...parsePrices(prices || {}),
    ...parseRents(rents || {}),
    ...parseYields(yields || {}),
    ...parseDemand(demand || {}),
    ...parseGrowth(growth || {}),
    propertydata_sample_postcode: postcode,
  }
}

async function findSamplePostcodeForDistrict(district) {
  const { data, error } = await db
    .from('nurseries')
    .select('postcode')
    .eq('registration_status', 'Active')
    .like('postcode', `${district} %`)
    .not('postcode', 'is', null)
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data?.postcode ? data.postcode.trim().toUpperCase() : null
}

export async function refreshDistrictPropertyData(
  district,
  { force = false, staleDays = 30 } = {}
) {
  const districtUpper = district.toUpperCase()

  const { data: existing, error: existingErr } = await db
    .from('postcode_areas')
    .select('postcode_district, propertydata_updated_at')
    .eq('postcode_district', districtUpper)
    .maybeSingle()
  if (existingErr) throw existingErr
  if (!existing) return { district: districtUpper, skipped: true, reason: 'district_not_found' }

  if (!force && existing.propertydata_updated_at) {
    const ageMs = Date.now() - new Date(existing.propertydata_updated_at).getTime()
    if (ageMs < staleDays * 24 * 60 * 60 * 1000) {
      return { district: districtUpper, skipped: true, reason: 'fresh' }
    }
  }

  const samplePostcode = await findSamplePostcodeForDistrict(districtUpper)
  if (!samplePostcode) {
    return { district: districtUpper, skipped: true, reason: 'no_sample_postcode' }
  }

  const merged = await fetchDistrictPropertyData(samplePostcode)

  const { error: updateErr } = await db
    .from('postcode_areas')
    .update({
      asking_price_avg: merged.asking_price_avg,
      rent_avg_weekly: merged.rent_avg_weekly,
      gross_yield_pct: merged.gross_yield_pct,
      demand_rating: merged.demand_rating,
      days_on_market: merged.days_on_market,
      price_growth_1yr_pct: merged.price_growth_1yr_pct,
      propertydata_sample_postcode: merged.propertydata_sample_postcode,
      propertydata_updated_at: new Date().toISOString(),
    })
    .eq('postcode_district', districtUpper)
  if (updateErr) throw updateErr

  logger.info({ district: districtUpper, samplePostcode }, 'propertydata: district refreshed')
  return { district: districtUpper, refreshed: true, ...merged }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function refreshAllDistricts({ limit = 50, staleDays = 30, force = false } = {}) {
  const staleCutoff = new Date(Date.now() - staleDays * 24 * 60 * 60 * 1000).toISOString()

  let query = db
    .from('postcode_areas')
    .select('postcode_district, nursery_count_total, propertydata_updated_at')
    .order('nursery_count_total', { ascending: false, nullsFirst: false })
    .limit(limit)

  if (!force) {
    query = query.or(`propertydata_updated_at.is.null,propertydata_updated_at.lt.${staleCutoff}`)
  }

  const { data: districts, error } = await query
  if (error) throw error

  const summary = { refreshed: 0, skipped: 0, errors: 0, details: [] }
  for (const row of districts || []) {
    try {
      const result = await refreshDistrictPropertyData(row.postcode_district, { force, staleDays })
      if (result.refreshed) summary.refreshed++
      else summary.skipped++
      summary.details.push(result)
    } catch (err) {
      summary.errors++
      summary.details.push({ district: row.postcode_district, error: err.message })
      logger.error(
        { err: err.message, district: row.postcode_district },
        'propertydata: district refresh failed'
      )
    }
    await sleep(DELAY_BETWEEN_DISTRICTS_MS)
  }

  logger.info(
    { refreshed: summary.refreshed, skipped: summary.skipped, errors: summary.errors },
    'propertydata: refreshAllDistricts complete'
  )
  return summary
}
