#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

const API_BASE =
  process.env.NURSERYMATCH_API_URL ||
  'https://nursery-finder-6u7r.onrender.com'

async function apiFetch(path, options = {}) {
  const url = `${API_BASE}${path}`
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${text.slice(0, 200)}`)
  }
  const ct = res.headers.get('content-type') || ''
  return ct.includes('json') ? res.json() : res.text()
}

function jsonResult(data) {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
}

function textResult(data) {
  return { content: [{ type: 'text', text: typeof data === 'string' ? data : JSON.stringify(data, null, 2) }] }
}

const server = new McpServer({
  name: 'nurserymatch',
  version: '1.1.0',
})

// ---------------------------------------------------------------------------
// NURSERY SEARCH & DISCOVERY
// ---------------------------------------------------------------------------

server.tool(
  'search_nurseries',
  'Search UK nurseries by postcode, place name, or nursery name. Returns up to 50 results with Ofsted grade, distance, fees, and availability.',
  {
    query: z.string().describe('Postcode (e.g. "SW11 1AA"), place name (e.g. "Camden"), or nursery name'),
    radius_km: z.number().min(0.1).max(25).optional().describe('Search radius in km (default 5)'),
    grade: z.enum(['Outstanding', 'Good', 'Requires Improvement', 'Inadequate']).optional().describe('Filter by Ofsted grade'),
    has_funded_2yr: z.boolean().optional().describe('Only nurseries with funded 2-year-old places'),
    has_funded_3yr: z.boolean().optional().describe('Only nurseries with funded 3-4-year-old places'),
    has_availability: z.boolean().optional().describe('Only nurseries with current availability'),
    min_rating: z.number().min(1).max(5).optional().describe('Minimum Google rating (1-5)'),
    provider_type: z.string().optional().describe('Filter by provider type'),
  },
  async ({ query, radius_km, grade, has_funded_2yr, has_funded_3yr, has_availability, min_rating, provider_type }) => {
    const body = { query, radius_km, grade, has_availability, min_rating, provider_type }
    if (has_funded_2yr) body.funded_2yr = true
    if (has_funded_3yr) body.funded_3yr = true
    const data = await apiFetch('/api/v1/nurseries/smart-search', {
      method: 'POST',
      body: JSON.stringify(body),
    })
    return jsonResult(data)
  }
)

server.tool(
  'get_nursery',
  'Get full details for a single nursery by its Ofsted URN. Includes address, Ofsted grades (overall + sub-categories), fees, funded places, availability, reviews, and contact info.',
  {
    urn: z.string().describe('Ofsted URN (unique reference number) of the nursery'),
  },
  async ({ urn }) => {
    const data = await apiFetch(`/api/v1/nurseries/${encodeURIComponent(urn)}`)
    return jsonResult(data)
  }
)

server.tool(
  'compare_nurseries',
  'Compare 2-10 nurseries side by side. Returns Ofsted grades, fees, availability, funded places, reviews, and scores for each.',
  {
    urns: z.array(z.string()).min(2).max(10).describe('Array of Ofsted URNs to compare'),
  },
  async ({ urns }) => {
    const data = await apiFetch('/api/v1/nurseries/compare', {
      method: 'POST',
      body: JSON.stringify({ urns }),
    })
    return jsonResult(data)
  }
)

server.tool(
  'autocomplete_nurseries',
  'Autocomplete nursery names as the user types. Returns up to 10 matching nurseries with URN and location.',
  {
    q: z.string().min(2).describe('Search text (minimum 2 characters)'),
    limit: z.number().min(1).max(20).optional().describe('Max results (default 10)'),
  },
  async ({ q, limit }) => {
    const params = new URLSearchParams({ q })
    if (limit) params.set('limit', String(limit))
    const data = await apiFetch(`/api/v1/nurseries/autocomplete?${params}`)
    return jsonResult(data)
  }
)

server.tool(
  'get_nurseries_in_town',
  'List all nurseries in a town, sorted by Ofsted grade. Includes town-level nursery statistics.',
  {
    town: z.string().describe('Town name (e.g. "Camden", "Bristol", "Manchester")'),
  },
  async ({ town }) => {
    const data = await apiFetch(`/api/v1/nurseries/by-town/${encodeURIComponent(town)}`)
    return jsonResult(data)
  }
)

server.tool(
  'get_similar_nurseries',
  'Find nurseries similar to a given nursery — same area, similar Ofsted grade, within 3km.',
  {
    urn: z.string().describe('Ofsted URN of the reference nursery'),
    limit: z.number().min(1).max(20).optional().describe('Max results (default 5)'),
  },
  async ({ urn, limit }) => {
    const params = limit ? `?limit=${limit}` : ''
    const data = await apiFetch(`/api/v1/nurseries/${encodeURIComponent(urn)}/similar${params}`)
    return jsonResult(data)
  }
)

server.tool(
  'get_nursery_reviews',
  'Get parent reviews for a nursery. Includes ratings, titles, and review text.',
  {
    urn: z.string().describe('Ofsted URN of the nursery'),
    page: z.number().optional().describe('Page number (default 1)'),
    limit: z.number().min(1).max(100).optional().describe('Results per page (default 20)'),
  },
  async ({ urn, page, limit }) => {
    const params = new URLSearchParams()
    if (page) params.set('page', String(page))
    if (limit) params.set('limit', String(limit))
    const qs = params.toString() ? `?${params}` : ''
    const data = await apiFetch(`/api/v1/nurseries/${encodeURIComponent(urn)}/reviews${qs}`)
    return jsonResult(data)
  }
)

server.tool(
  'get_nursery_availability',
  'Get current availability by age group for a nursery — shows which age groups have open spaces.',
  {
    urn: z.string().describe('Ofsted URN of the nursery'),
  },
  async ({ urn }) => {
    const data = await apiFetch(`/api/v1/nurseries/${encodeURIComponent(urn)}/availability`)
    return jsonResult(data)
  }
)

server.tool(
  'get_school_progression',
  'Get the school progression path for a nursery — shows nearby primary and secondary schools children typically move on to.',
  {
    urn: z.string().describe('Ofsted URN of the nursery'),
  },
  async ({ urn }) => {
    const data = await apiFetch(`/api/v1/nurseries/${encodeURIComponent(urn)}/progression`)
    return jsonResult(data)
  }
)

// ---------------------------------------------------------------------------
// AREAS & FAMILY SEARCH
// ---------------------------------------------------------------------------

server.tool(
  'get_area',
  'Get family score and statistics for a UK postcode district. Includes nursery quality breakdown (Outstanding/Good/RI counts), crime rate per 1,000, parks within 1km, IMD deprivation decile, and average property prices by type.',
  {
    district: z.string().describe('UK postcode district (e.g. "SW11", "N1", "BS6")'),
  },
  async ({ district }) => {
    const data = await apiFetch(`/api/v1/areas/${encodeURIComponent(district)}`)
    return jsonResult(data)
  }
)

server.tool(
  'find_family_areas',
  'Find the best family-friendly areas near a postcode. Ranks districts by family score, nursery quality, and affordability within a radius.',
  {
    postcode: z.string().describe('UK postcode to search around (e.g. "SW11 1AA")'),
    radius_km: z.number().min(1).max(50).optional().describe('Search radius in km (default 15)'),
    min_family_score: z.number().min(0).max(100).optional().describe('Minimum family score (0-100)'),
    sort: z.enum(['family_score', 'nursery_score', 'distance']).optional().describe('Sort results by (default family_score)'),
  },
  async ({ postcode, radius_km, min_family_score, sort }) => {
    const params = new URLSearchParams({ postcode })
    if (radius_km) params.set('radius_km', String(radius_km))
    if (min_family_score) params.set('min_family_score', String(min_family_score))
    if (sort) params.set('sort', sort)
    const data = await apiFetch(`/api/v1/areas/family-search?${params}`)
    return jsonResult(data)
  }
)

server.tool(
  'browse_districts',
  'Browse UK districts filtered by property price, type, and family score. Useful for families looking to relocate.',
  {
    min_price: z.number().optional().describe('Minimum average property price'),
    max_price: z.number().optional().describe('Maximum average property price'),
    property_type: z.enum(['all', 'flat', 'terraced', 'semi', 'detached']).optional().describe('Property type filter'),
    region: z.string().optional().describe('Region filter (e.g. "London", "South East")'),
    sort: z.enum(['price_asc', 'price_desc', 'family_score', 'yield']).optional().describe('Sort order'),
    limit: z.number().min(1).max(200).optional().describe('Max results (default 60)'),
  },
  async ({ min_price, max_price, property_type, region, sort, limit }) => {
    const params = new URLSearchParams()
    if (min_price) params.set('min_price', String(min_price))
    if (max_price) params.set('max_price', String(max_price))
    if (property_type) params.set('property_type', property_type)
    if (region) params.set('region', region)
    if (sort) params.set('sort', sort)
    if (limit) params.set('limit', String(limit))
    const data = await apiFetch(`/api/v1/properties/districts?${params}`)
    return jsonResult(data)
  }
)

// ---------------------------------------------------------------------------
// TRAVEL & COMMUTE
// ---------------------------------------------------------------------------

server.tool(
  'calculate_travel_time',
  'Calculate travel time between two points by walking, cycling, or driving. Accepts postcodes, coordinates, or nursery URNs.',
  {
    from_postcode: z.string().optional().describe('Origin postcode (e.g. "SW11 1AA")'),
    from_lat: z.number().optional().describe('Origin latitude'),
    from_lng: z.number().optional().describe('Origin longitude'),
    to_postcode: z.string().optional().describe('Destination postcode'),
    to_lat: z.number().optional().describe('Destination latitude'),
    to_lng: z.number().optional().describe('Destination longitude'),
    to_urn: z.string().optional().describe('Destination nursery URN'),
    mode: z.enum(['walk', 'cycle', 'drive']).optional().describe('Travel mode (default walk)'),
  },
  async ({ from_postcode, from_lat, from_lng, to_postcode, to_lat, to_lng, to_urn, mode }) => {
    const from = from_postcode ? { postcode: from_postcode } : { lat: from_lat, lng: from_lng }
    const to = to_urn ? { urn: to_urn } : to_postcode ? { postcode: to_postcode } : { lat: to_lat, lng: to_lng }
    const data = await apiFetch('/api/v1/travel/time', {
      method: 'POST',
      body: JSON.stringify({ from, to, mode }),
    })
    return jsonResult(data)
  }
)

// ---------------------------------------------------------------------------
// SCHOOLS
// ---------------------------------------------------------------------------

server.tool(
  'find_schools_nearby',
  'Find primary and secondary schools near a location. Useful for checking school options alongside nursery choices.',
  {
    lat: z.number().describe('Latitude'),
    lng: z.number().describe('Longitude'),
    radius_km: z.number().min(0.5).max(10).optional().describe('Search radius in km (default 2)'),
    phase: z.string().optional().describe('School phase filter (e.g. "Primary", "Secondary")'),
  },
  async ({ lat, lng, radius_km, phase }) => {
    const params = new URLSearchParams({ lat: String(lat), lng: String(lng) })
    if (radius_km) params.set('radius_km', String(radius_km))
    if (phase) params.set('phase', phase)
    const data = await apiFetch(`/api/v1/schools/near?${params}`)
    return jsonResult(data)
  }
)

// ---------------------------------------------------------------------------
// MARKDOWN (LLM-FRIENDLY SUMMARIES)
// ---------------------------------------------------------------------------

server.tool(
  'get_nursery_markdown',
  'Get a nursery profile as formatted markdown — ideal for reading aloud or summarising. Includes Ofsted grade, address, fees, funded places, and reviews in a clean readable format.',
  {
    urn: z.string().describe('Ofsted URN of the nursery'),
  },
  async ({ urn }) => {
    const data = await apiFetch(`/api/v1/public/nursery/${encodeURIComponent(urn)}.md`)
    return textResult(data)
  }
)

server.tool(
  'get_area_markdown',
  'Get an area summary as formatted markdown — family score, nursery quality breakdown, crime rate, parks, and property prices in a readable format.',
  {
    district: z.string().describe('UK postcode district (e.g. "SW11")'),
  },
  async ({ district }) => {
    const data = await apiFetch(`/api/v1/public/area/${encodeURIComponent(district)}.md`)
    return textResult(data)
  }
)

// ---------------------------------------------------------------------------
// GUIDES & BLOG
// ---------------------------------------------------------------------------

server.tool(
  'list_guides',
  'List all nursery guides and parenting advice articles. Returns title, excerpt, date, and slug for each.',
  {},
  async () => {
    const data = await apiFetch('/api/v1/blog')
    return jsonResult(data)
  }
)

server.tool(
  'get_guide',
  'Get a full nursery guide or advice article by slug. Returns the complete article with title, body, tags, and date.',
  {
    slug: z.string().describe('Guide slug (e.g. "how-to-choose-nursery", "free-childcare-hours-guide")'),
  },
  async ({ slug }) => {
    const data = await apiFetch(`/api/v1/blog/${encodeURIComponent(slug)}`)
    return jsonResult(data)
  }
)

// ---------------------------------------------------------------------------
// AI FEATURES
// ---------------------------------------------------------------------------

server.tool(
  'ai_nursery_summary',
  'Get an AI-generated summary of a nursery based on its Ofsted data, reviews, and profile.',
  {
    urn: z.string().describe('Ofsted URN of the nursery'),
  },
  async ({ urn }) => {
    const data = await apiFetch(`/api/v1/nurseries/${encodeURIComponent(urn)}/summary`)
    return jsonResult(data)
  }
)

server.tool(
  'ai_review_synthesis',
  'Get an AI synthesis of all parent reviews for a nursery — summarises themes, strengths, and concerns.',
  {
    urn: z.string().describe('Ofsted URN of the nursery'),
  },
  async ({ urn }) => {
    const data = await apiFetch(`/api/v1/nurseries/${encodeURIComponent(urn)}/review-synthesis`)
    return jsonResult(data)
  }
)

const transport = new StdioServerTransport()
await server.connect(transport)
