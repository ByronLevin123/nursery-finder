// PropertyData.co.uk listings integration (sale + rent).
// Endpoints: /properties-for-sale and /properties-to-rent take ?postcode= (full postcode).
// We use the first active nursery's full postcode in the district as a sample.
// Prices normalized to whole pounds (sale = total, rent = per-week).

import db from '../db.js'
import { logger } from '../logger.js'

const BASE_URL = 'https://api.propertydata.co.uk'
const DEFAULT_TIMEOUT_MS = 15000

function toIntOrNull(v) {
  if (v == null) return null
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) ? Math.round(n) : null
}

function toFloatOrNull(v) {
  if (v == null) return null
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) ? n : null
}

function toStringOrNull(v) {
  if (v == null) return null
  const s = String(v).trim()
  return s.length ? s : null
}

// Pure parser — exported for tests.
// Accepts a single raw listing object from PropertyData and returns a row
// shaped to fit the property_listings table.
export function parseListing(raw, listingType, district) {
  if (!raw || typeof raw !== 'object') return null

  const externalId = toStringOrNull(raw.id ?? raw.listing_id ?? raw.property_id)
  const address = toStringOrNull(raw.address ?? raw.display_address ?? raw.title)
  const postcode = toStringOrNull(raw.postcode ?? raw.post_code)
  const price = toIntOrNull(raw.price ?? raw.asking_price ?? raw.rent_pw ?? raw.rent_per_week)
  const bedrooms = toIntOrNull(raw.bedrooms ?? raw.beds ?? raw.num_bedrooms)
  const bathrooms = toIntOrNull(raw.bathrooms ?? raw.baths ?? raw.num_bathrooms)
  const propertyType = toStringOrNull(raw.type ?? raw.property_type ?? raw.house_type)
  const description = toStringOrNull(raw.description ?? raw.summary)
  const imageUrl = toStringOrNull(
    raw.image ??
      raw.image_url ??
      raw.thumbnail ??
      (Array.isArray(raw.images) ? raw.images[0] : null)
  )
  const listingUrl = toStringOrNull(raw.url ?? raw.listing_url ?? raw.link)
  const agentName = toStringOrNull(raw.agent ?? raw.agent_name ?? raw.branch_name)
  const lat = toFloatOrNull(raw.lat ?? raw.latitude)
  const lng = toFloatOrNull(raw.lng ?? raw.lon ?? raw.longitude)

  return {
    postcode_district: district,
    listing_type: listingType,
    external_id: externalId,
    address,
    postcode,
    price,
    bedrooms,
    bathrooms,
    property_type: propertyType,
    description,
    image_url: imageUrl,
    listing_url: listingUrl,
    agent_name: agentName,
    lat,
    lng,
    raw,
  }
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

// Try a few likely shapes for the listings array — PropertyData wraps things
// inconsistently across endpoints.
function extractRawListings(json) {
  if (!json) return []
  if (Array.isArray(json)) return json
  if (Array.isArray(json.data)) return json.data
  if (Array.isArray(json?.data?.listings)) return json.data.listings
  if (Array.isArray(json?.data?.properties)) return json.data.properties
  if (Array.isArray(json.listings)) return json.listings
  if (Array.isArray(json.properties)) return json.properties
  return []
}

export async function fetchListingsForDistrict(district, listingType) {
  const districtUpper = district.toUpperCase()
  const samplePostcode = await findSamplePostcodeForDistrict(districtUpper)
  if (!samplePostcode) {
    logger.warn({ district: districtUpper }, 'propertydata listings: no sample postcode')
    return []
  }

  const endpoint = listingType === 'rent' ? '/properties-to-rent' : '/properties-for-sale'
  const start = Date.now()
  let json
  try {
    json = await fetchJson(endpoint, { postcode: samplePostcode })
  } catch (err) {
    logger.warn(
      { err: err.message, endpoint, district: districtUpper },
      'propertydata listings: fetch failed'
    )
    return []
  }

  const rawList = extractRawListings(json)
  const parsed = rawList
    .map((r) => parseListing(r, listingType, districtUpper))
    .filter((row) => row != null)

  logger.info(
    {
      district: districtUpper,
      listingType,
      count: parsed.length,
      durationMs: Date.now() - start,
    },
    'propertydata listings: fetched'
  )
  return parsed
}

async function getDistrictMaxFetchedAt(district) {
  const { data, error } = await db
    .from('property_listings')
    .select('fetched_at')
    .eq('postcode_district', district)
    .order('fetched_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data?.fetched_at || null
}

export async function refreshDistrictListings(district, { staleHours = 24, force = false } = {}) {
  const districtUpper = district.toUpperCase()

  if (!force) {
    const lastFetched = await getDistrictMaxFetchedAt(districtUpper)
    if (lastFetched) {
      const ageMs = Date.now() - new Date(lastFetched).getTime()
      if (ageMs < staleHours * 60 * 60 * 1000) {
        const { count: saleCount } = await db
          .from('property_listings')
          .select('id', { count: 'exact', head: true })
          .eq('postcode_district', districtUpper)
          .eq('listing_type', 'sale')
        const { count: rentCount } = await db
          .from('property_listings')
          .select('id', { count: 'exact', head: true })
          .eq('postcode_district', districtUpper)
          .eq('listing_type', 'rent')
        return {
          district: districtUpper,
          sale_count: saleCount || 0,
          rent_count: rentCount || 0,
          fetched_at: lastFetched,
          cached: true,
        }
      }
    }
  }

  const [saleRows, rentRows] = await Promise.all([
    fetchListingsForDistrict(districtUpper, 'sale'),
    fetchListingsForDistrict(districtUpper, 'rent'),
  ])

  const { error: deleteErr } = await db
    .from('property_listings')
    .delete()
    .eq('postcode_district', districtUpper)
  if (deleteErr) throw deleteErr

  const allRows = [...saleRows, ...rentRows]
  let inserted = 0
  if (allRows.length) {
    const { error: insertErr } = await db.from('property_listings').insert(allRows)
    if (insertErr) throw insertErr
    inserted = allRows.length
  }

  const fetchedAt = new Date().toISOString()
  logger.info(
    {
      district: districtUpper,
      sale_count: saleRows.length,
      rent_count: rentRows.length,
      inserted,
    },
    'propertydata listings: district refreshed'
  )

  return {
    district: districtUpper,
    sale_count: saleRows.length,
    rent_count: rentRows.length,
    fetched_at: fetchedAt,
    cached: false,
  }
}
