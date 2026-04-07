const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export interface Nursery {
  id: string
  urn: string
  name: string
  provider_type: string | null
  address_line1: string | null
  address_line2?: string | null
  town: string | null
  postcode: string | null
  local_authority: string | null
  region: string | null
  phone: string | null
  email: string | null
  website: string | null
  ofsted_overall_grade: string | null
  last_inspection_date: string | null
  inspection_report_url: string | null
  inspection_date_warning: boolean
  enforcement_notice: boolean
  total_places: number | null
  places_funded_2yr: number | null
  places_funded_3_4yr: number | null
  google_rating: number | null
  google_review_count: number | null
  fee_avg_monthly: number | null
  fee_report_count: number
  lat: number | null
  lng: number | null
  distance_km?: number
}

export interface SearchResult {
  data: Nursery[]
  meta: {
    total: number
    page: number
    limit: number
    pages: number
    search_lat: number
    search_lng: number
  }
}

export async function searchNurseries(params: {
  postcode: string
  radius_km?: number
  grade?: string | null
  funded_2yr?: boolean
  funded_3yr?: boolean
  page?: number
}): Promise<SearchResult> {
  const res = await fetch(`${API_URL}/api/v1/nurseries/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    cache: 'no-store',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Search failed: ${res.status}`)
  }
  return res.json()
}

export async function smartSearchNurseries(params: {
  query: string
  radius_km?: number
  grade?: string | null
  funded_2yr?: boolean
  funded_3yr?: boolean
}): Promise<SearchResult> {
  const res = await fetch(`${API_URL}/api/v1/nurseries/smart-search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    cache: 'no-store',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Search failed: ${res.status}`)
  }
  return res.json()
}

export async function getNursery(urn: string): Promise<Nursery> {
  const res = await fetch(`${API_URL}/api/v1/nurseries/${urn}`, {
    next: { revalidate: 3600 },
  })
  if (!res.ok) throw new Error(`Nursery not found: ${urn}`)
  return res.json()
}

export async function submitFee(params: {
  nursery_id: string
  fee_per_month: number
  hours_per_week?: number
  age_group?: string
}): Promise<void> {
  const res = await fetch(`${API_URL}/api/v1/nurseries/fees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  if (!res.ok) throw new Error('Failed to submit fee')
}

export async function compareNurseries(urns: string[]): Promise<Nursery[]> {
  const res = await fetch(`${API_URL}/api/v1/nurseries/compare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ urns }),
    cache: 'no-store',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Compare failed: ${res.status}`)
  }
  const result = await res.json()
  return result.data
}

export interface AreaSummary {
  postcode_district: string
  local_authority: string | null
  region: string | null
  nursery_count_total: number | null
  nursery_count_outstanding: number | null
  nursery_count_good: number | null
  nursery_outstanding_pct: number | null
  avg_sale_price_all: number | null
  avg_sale_price_flat: number | null
  avg_sale_price_terraced: number | null
  avg_sale_price_semi: number | null
  avg_sale_price_detached: number | null
  crime_rate_per_1000: number | null
  imd_decile: number | null
  flood_risk_level: string | null
  family_score: number | null
  family_score_breakdown: any
  lat: number | null
  lng: number | null
  updated_at: string | null
}

export async function getAreaSummary(district: string): Promise<AreaSummary | null> {
  const res = await fetch(
    `${API_URL}/api/v1/areas/${encodeURIComponent(district.toUpperCase())}`,
    { next: { revalidate: 3600 } }
  )
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Area lookup failed: ${res.status}`)
  return res.json()
}

export function postcodeDistrict(postcode: string | null | undefined): string | null {
  if (!postcode) return null
  const trimmed = postcode.trim().toUpperCase()
  return trimmed.split(' ')[0] || null
}

export async function getNurseriesInDistrict(district: string) {
  const res = await fetch(
    `${API_URL}/api/v1/areas/${encodeURIComponent(district)}/nurseries`,
    { next: { revalidate: 3600 } }
  )
  if (!res.ok) throw new Error(`Area not found: ${district}`)
  return res.json() as Promise<{
    nurseries: Nursery[]
    stats: { total: number; outstanding: number; good: number }
  }>
}
