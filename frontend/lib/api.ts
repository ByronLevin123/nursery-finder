export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

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
  review_count?: number | null
  review_avg_rating?: number | null
  review_recommend_pct?: number | null
  lat: number | null
  lng: number | null
  distance_km?: number
  claimed_by_user_id?: string | null
  claimed_at?: string | null
  description?: string | null
  opening_hours?: Record<string, string> | null
  photos?: string[] | null
  website_url?: string | null
  contact_email?: string | null
  contact_phone?: string | null
  provider_updated_at?: string | null
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
  flood_updated_at?: string | null
  nearest_park_name?: string | null
  nearest_park_distance_m?: number | null
  park_count_within_1km?: number | null
  parks_updated_at?: string | null
  asking_price_avg: number | null
  rent_avg_weekly: number | null
  gross_yield_pct: number | null
  demand_rating: string | null
  days_on_market: number | null
  price_growth_1yr_pct: number | null
  propertydata_sample_postcode?: string | null
  propertydata_updated_at?: string | null
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

export interface Review {
  id: string
  urn: string
  rating: number
  title: string
  body: string
  would_recommend: boolean
  child_age_months: number | null
  attended_from: string | null
  attended_to: string | null
  author_display_name: string | null
  status: string
  created_at: string
}

export interface ReviewSummary {
  reviews: Review[]
  total: number
  avg_rating: number | null
  recommend_pct: number | null
}

export interface SubmitReviewInput {
  rating: number
  title: string
  body: string
  would_recommend: boolean
  child_age_months?: number | null
  attended_from?: string | null
  attended_to?: string | null
  author_display_name?: string | null
}

export async function getReviews(
  urn: string,
  limit = 20,
  offset = 0
): Promise<ReviewSummary> {
  const res = await fetch(
    `${API_URL}/api/v1/nurseries/${encodeURIComponent(urn)}/reviews?limit=${limit}&offset=${offset}`,
    { cache: 'no-store' }
  )
  if (!res.ok) throw new Error(`Failed to load reviews: ${res.status}`)
  return res.json()
}

export async function submitReview(
  urn: string,
  input: SubmitReviewInput
): Promise<Review> {
  const res = await fetch(`${API_URL}/api/v1/nurseries/${encodeURIComponent(urn)}/reviews`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Failed to submit review: ${res.status}`)
  }
  return res.json()
}

export interface ProfileChild {
  name?: string
  age_months?: number
}

export interface Profile {
  id: string
  display_name: string | null
  avatar_url: string | null
  home_postcode: string | null
  children: ProfileChild[]
  preferences: any | null
  email_alerts: boolean
  created_at?: string
  updated_at?: string
}

export async function getAuthToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null
  const { supabase } = await import('./supabase')
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

// AI features (Claude-powered) — all tolerate 503 by returning null

export async function getNurserySummary(urn: string): Promise<string | null> {
  try {
    const res = await fetch(
      `${API_URL}/api/v1/nurseries/${encodeURIComponent(urn)}/summary`,
      { next: { revalidate: 86400 } }
    )
    if (!res.ok) return null
    const data = await res.json()
    return data?.summary || null
  } catch {
    return null
  }
}

export interface ReviewSynthesis {
  loves: string[]
  concerns: string[]
  know: string[]
}

export async function getReviewSynthesis(urn: string): Promise<ReviewSynthesis | null> {
  try {
    const res = await fetch(
      `${API_URL}/api/v1/nurseries/${encodeURIComponent(urn)}/review-synthesis`,
      { next: { revalidate: 3600 } }
    )
    if (!res.ok) return null
    const data = await res.json()
    if (!data || data.synthesis === null) return null
    if (!Array.isArray(data.loves)) return null
    return data as ReviewSynthesis
  } catch {
    return null
  }
}

export async function generateMatchNarrative(body: {
  nursery: any
  area: any
  match: any
}): Promise<string | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/ai/match-narrative`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data?.narrative || null
  } catch {
    return null
  }
}

export interface ConversationalSearchFilters {
  postcode: string | null
  grade: string | null
  funded_2yr: boolean | null
  funded_3yr: boolean | null
  radius_km: number | null
  maxCrimeRate: number | null
  minFamilyScore: number | null
  maxPrice: number | null
  keywords: string | null
}

export async function conversationalSearch(
  query: string
): Promise<ConversationalSearchFilters | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/ai/conversational-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    })
    if (!res.ok) return null
    return (await res.json()) as ConversationalSearchFilters
  } catch {
    return null
  }
}

export async function getProfile(token: string): Promise<Profile | null> {
  const res = await fetch(`${API_URL}/api/v1/profile`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (res.status === 404) return null
  if (res.status === 401) return null
  if (!res.ok) throw new Error(`Failed to load profile: ${res.status}`)
  return res.json()
}

export async function updateProfile(
  token: string,
  patch: Partial<Omit<Profile, 'id' | 'created_at' | 'updated_at'>>
): Promise<Profile> {
  const res = await fetch(`${API_URL}/api/v1/profile`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(patch),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Failed to update profile: ${res.status}`)
  }
  return res.json()
}

// AI Family Move Assistant ----------------------------------------------------

export interface AssistantCriteria {
  area: {
    postcode: string | null
    district: string | null
    region: string | null
    max_distance_km: number | null
  }
  budget: { type: 'sale' | 'rent' | null; min: number | null; max: number | null }
  bedrooms: { min: number | null }
  priorities: {
    nursery_quality: 'required' | 'priority' | 'nice' | null
    low_crime: 'required' | 'priority' | 'nice' | null
    low_deprivation: 'required' | 'priority' | 'nice' | null
    affordability: 'required' | 'priority' | 'nice' | null
  }
  notes: string[]
}

export const EMPTY_ASSISTANT_CRITERIA: AssistantCriteria = {
  area: { postcode: null, district: null, region: null, max_distance_km: null },
  budget: { type: null, min: null, max: null },
  bedrooms: { min: null },
  priorities: {
    nursery_quality: null,
    low_crime: null,
    low_deprivation: null,
    affordability: null,
  },
  notes: [],
}

export interface AssistantArea {
  postcode_district: string
  local_authority: string | null
  region: string | null
  family_score: number | null
  nursery_count_total: number | null
  nursery_count_outstanding: number | null
  nursery_outstanding_pct: number | null
  crime_rate_per_1000: number | null
  imd_decile: number | null
  flood_risk_level: string | null
  avg_sale_price_all: number | null
  lat: number | null
  lng: number | null
  distance_km?: number
  score: number
  breakdown: Record<string, { level: string | null; value: number | null; weight: number }>
  match_rationale?: string | null
}

export async function assistantChat(
  message: string,
  criteria: AssistantCriteria
): Promise<{ criteria: AssistantCriteria; assistant_message: string } | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/assistant/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, criteria }),
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export async function assistantSearch(
  criteria: AssistantCriteria
): Promise<{ data: AssistantArea[]; meta: { total: number; criteria_used: AssistantCriteria } } | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/assistant/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ criteria }),
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
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
