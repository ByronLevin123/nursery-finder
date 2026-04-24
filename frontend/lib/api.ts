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
  featured?: boolean
  claimed_by_user_id?: string | null
  claimed_at?: string | null
  description?: string | null
  opening_hours?: Record<string, string> | null
  photos?: string[] | null
  website_url?: string | null
  contact_email?: string | null
  contact_phone?: string | null
  provider_updated_at?: string | null
  spots_available?: number | null
  has_waitlist?: boolean
  quality_score?: number | null
  cost_score?: number | null
  availability_score?: number | null
  staff_score?: number | null
  sentiment_score?: number | null
  dimension_scores_updated_at?: string | null
}

export interface SearchResult {
  data: Nursery[]
  meta: {
    total: number
    page?: number
    limit?: number
    pages?: number
    search_lat: number
    search_lng: number
    mode?: string
    did_you_mean?: string
    query?: string
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
  has_availability?: boolean
  min_rating?: number | null
  provider_type?: string | null
  has_funded_2yr?: boolean
  has_funded_3yr?: boolean
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
  nursery_urn: string
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
  id?: string
  name?: string
  age_months?: number
}

export interface Profile {
  id: string
  display_name: string | null
  avatar_url: string | null
  home_postcode: string | null
  work_postcode?: string | null
  children: ProfileChild[]
  preferences: any | null
  email_alerts: boolean
  email_weekly_digest?: boolean
  email_new_nurseries?: boolean
  email_marketing?: boolean
  last_active_at?: string | null
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

// Notification Preferences ---------------------------------------------------

export interface NotificationPreferences {
  id: string
  user_id: string
  email_new_review: boolean
  email_qa_answer: boolean
  email_saved_search_alert: boolean
  email_ofsted_change: boolean
  email_weekly_digest: boolean
  email_marketing: boolean
  created_at: string
  updated_at: string
}

export async function getNotificationPreferences(
  token: string
): Promise<NotificationPreferences> {
  const res = await fetch(`${API_URL}/api/v1/profile/notification-preferences`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Failed to load notification preferences: ${res.status}`)
  return res.json()
}

export async function updateNotificationPreferences(
  token: string,
  prefs: Partial<Omit<NotificationPreferences, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
): Promise<NotificationPreferences> {
  const res = await fetch(`${API_URL}/api/v1/profile/notification-preferences`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(prefs),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Failed to update notification preferences: ${res.status}`)
  }
  return res.json()
}

// GDPR data export
export async function exportMyData(token: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${API_URL}/api/v1/profile/export`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Export failed: ${res.status}`)
  return res.json()
}

// GDPR account deletion
export async function deleteMyAccount(token: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/v1/profile`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Deletion failed: ${res.status}`)
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
  commute: {
    to_postcode: string | null
    max_minutes: number | null
    mode: 'walk' | 'cycle' | 'drive' | null
  }
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
  commute: { to_postcode: null, max_minutes: null, mode: null },
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
  commute?: {
    duration_s: number
    distance_m: number
    mode: string
    score: number | null
  } | null
}

// Travel time ---------------------------------------------------------------

export type TravelMode = 'walk' | 'cycle' | 'drive'

export interface TravelEndpoint {
  lat?: number
  lng?: number
  postcode?: string
  urn?: string
}

export interface TravelTimeResult {
  duration_s: number
  distance_m: number
  mode: TravelMode
  cached?: boolean
  fallback?: boolean
}

export async function getTravelTime(
  from: TravelEndpoint,
  to: TravelEndpoint,
  mode: TravelMode
): Promise<TravelTimeResult | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/travel/time`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, mode }),
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export interface IsochroneResponse {
  type: 'FeatureCollection'
  features: Array<{
    type: 'Feature'
    properties: { duration_min: number; mode: string }
    geometry: { type: 'Polygon'; coordinates: [number, number][][] }
  }>
  meta: { from: { lat: number; lng: number }; mode: string; durations_min: number[] }
}

export async function getIsochrone(
  from: TravelEndpoint,
  durationsMin: number[],
  mode: TravelMode
): Promise<IsochroneResponse | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/travel/isochrone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, durations_min: durationsMin, mode }),
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
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

// Q&A (parent questions & answers on nursery profiles) ----------------------

export interface NurseryAnswer {
  id: string
  question_id: string
  user_id: string
  is_provider: boolean
  answer: string
  status: string
  created_at: string
  updated_at: string
}

export interface NurseryQuestion {
  id: string
  nursery_urn: string
  user_id: string
  question: string
  status: string
  created_at: string
  updated_at: string
  answers: NurseryAnswer[]
}

export async function getNurseryQuestions(
  urn: string
): Promise<{ questions: NurseryQuestion[] }> {
  const res = await fetch(
    `${API_URL}/api/v1/nurseries/${encodeURIComponent(urn)}/questions`,
    { cache: 'no-store' }
  )
  if (!res.ok) throw new Error(`Failed to load questions: ${res.status}`)
  return res.json()
}

export async function postNurseryQuestion(
  urn: string,
  question: string,
  token: string
): Promise<NurseryQuestion> {
  const res = await fetch(
    `${API_URL}/api/v1/nurseries/${encodeURIComponent(urn)}/questions`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ question }),
    }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Failed to post question: ${res.status}`)
  }
  return res.json()
}

export async function postNurseryAnswer(
  urn: string,
  questionId: string,
  answer: string,
  token: string
): Promise<NurseryAnswer> {
  const res = await fetch(
    `${API_URL}/api/v1/nurseries/${encodeURIComponent(urn)}/questions/${encodeURIComponent(questionId)}/answers`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ answer }),
    }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Failed to post answer: ${res.status}`)
  }
  return res.json()
}

// Schools (nearby primary schools overlay) ----------------------------------

export interface School {
  id: string
  urn: string
  name: string
  type: string | null
  phase: string | null
  ofsted_rating: string | null
  last_inspection_date: string | null
  address: string | null
  town: string | null
  postcode: string | null
  local_authority: string | null
  lat: number | null
  lng: number | null
  pupils: number | null
  age_range: string | null
  website: string | null
  distance_km?: number
}

export async function getNearbySchools(
  lat: number,
  lng: number,
  radius_km = 1,
  phase: string | null = 'Primary'
): Promise<School[]> {
  try {
    const params = new URLSearchParams({
      lat: String(lat),
      lng: String(lng),
      radius_km: String(radius_km),
    })
    if (phase) params.set('phase', phase)

    const res = await fetch(`${API_URL}/api/v1/schools/near?${params}`, {
      next: { revalidate: 3600 },
    })
    if (!res.ok) return []
    const data = await res.json()
    return data.data || []
  } catch {
    return []
  }
}

// Similar nurseries + autocomplete ---------------------------------------------

export async function getSimilarNurseries(urn: string): Promise<Nursery[]> {
  try {
    const res = await fetch(`${API_URL}/api/v1/nurseries/${encodeURIComponent(urn)}/similar`, {
      next: { revalidate: 3600 },
    })
    if (!res.ok) return []
    const data = await res.json()
    return data.data || []
  } catch {
    return []
  }
}

export interface SearchSuggestion {
  type: 'nursery' | 'area'
  label: string
  urn?: string
  postcode?: string
}

export async function getSearchSuggestions(query: string): Promise<SearchSuggestion[]> {
  if (!query || query.length < 2) return []
  try {
    const res = await fetch(`${API_URL}/api/v1/nurseries/autocomplete?q=${encodeURIComponent(query)}`)
    if (!res.ok) return []
    const data = await res.json()
    return data.suggestions || []
  } catch {
    return []
  }
}

// Billing / Subscription -------------------------------------------------------

export interface TierInfo {
  tier: string
  monthly_price_gbp: number
  enquiry_credits: number
  featured_listing: boolean
  analytics_advanced: boolean
  priority_search: boolean
  custom_branding: boolean
  description: string
}

export interface SubscriptionInfo {
  provider: {
    tier: string
    status: string
    enquiry_credits: number
    enquiry_credits_used: number
    current_period_end: string | null
    cancel_at_period_end: boolean
  } | null
  parent: {
    tier: string
    status: string
    current_period_end: string | null
    cancel_at_period_end: boolean
  } | null
}

export async function getTiers(): Promise<TierInfo[]> {
  const res = await fetch(`${API_URL}/api/v1/billing/tiers`, { cache: 'no-store' })
  if (!res.ok) return []
  const data = await res.json()
  return data.data || []
}

export async function getSubscription(token: string): Promise<SubscriptionInfo> {
  const res = await fetch(`${API_URL}/api/v1/billing/subscription`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!res.ok) return { provider: null, parent: null }
  return res.json()
}

export async function createCheckout(
  token: string,
  tier: string,
  type: 'provider' | 'parent'
): Promise<string | null> {
  const res = await fetch(`${API_URL}/api/v1/billing/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ tier, type }),
  })
  if (!res.ok) return null
  const data = await res.json()
  return data.url
}

export async function createPortalSession(
  token: string,
  type: 'provider' | 'parent'
): Promise<string | null> {
  const res = await fetch(`${API_URL}/api/v1/billing/portal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ type }),
  })
  if (!res.ok) return null
  const data = await res.json()
  return data.url
}

// Town pages -------------------------------------------------------------------

export interface TownListItem {
  name: string
  count: number
}

export async function getTowns(limit = 200): Promise<TownListItem[]> {
  const res = await fetch(`${API_URL}/api/v1/nurseries/towns?limit=${limit}`, {
    next: { revalidate: 86400 },
  })
  if (!res.ok) return []
  const data = await res.json()
  return data.data || []
}

export async function getNurseriesInTown(town: string): Promise<{
  data: Nursery[]
  stats: { total: number; outstanding: number; good: number }
  town: string
}> {
  const res = await fetch(
    `${API_URL}/api/v1/nurseries/by-town/${encodeURIComponent(town)}`,
    { next: { revalidate: 3600 } }
  )
  if (!res.ok) throw new Error(`Town not found: ${town}`)
  return res.json()
}

// Blog / guides ---------------------------------------------------------------

export interface BlogPost {
  slug: string
  title: string
  excerpt: string
  date: string | null
  author: string
  body?: string
}

export async function getBlogPosts(): Promise<BlogPost[]> {
  const res = await fetch(`${API_URL}/api/v1/blog`, {
    next: { revalidate: 3600 },
  })
  if (!res.ok) return []
  const data = await res.json()
  return data.data || []
}

export async function getBlogPost(slug: string): Promise<BlogPost | null> {
  const res = await fetch(`${API_URL}/api/v1/blog/${encodeURIComponent(slug)}`, {
    next: { revalidate: 3600 },
  })
  if (!res.ok) return null
  return res.json()
}

// Enhanced provider features ---------------------------------------------------

export interface ProviderFeatures {
  tier: string
  can_edit_description: boolean
  can_upload_photos: boolean
  can_manage_fees: boolean
  photo_limit: number
  featured_listing: boolean
  analytics_advanced: boolean
  priority_search: boolean
  custom_branding: boolean
}

export async function getProviderFeatures(token: string): Promise<ProviderFeatures> {
  const res = await fetch(`${API_URL}/api/v1/provider/features`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!res.ok) {
    return {
      tier: 'free',
      can_edit_description: false,
      can_upload_photos: false,
      can_manage_fees: false,
      photo_limit: 0,
      featured_listing: false,
      analytics_advanced: false,
      priority_search: false,
      custom_branding: false,
    }
  }
  return res.json()
}

export interface NurseryPhoto {
  id: string
  nursery_urn: string
  storage_path: string
  public_url: string
  display_order: number
  caption: string | null
  uploaded_at: string
}

export async function getNurseryPhotos(urn: string): Promise<NurseryPhoto[]> {
  try {
    const res = await fetch(`${API_URL}/api/v1/provider/nurseries/${encodeURIComponent(urn)}/photos`, {
      cache: 'no-store',
    })
    if (!res.ok) return []
    const data = await res.json()
    return data.data || []
  } catch {
    return []
  }
}

export async function uploadNurseryPhoto(
  token: string,
  urn: string,
  imageFile: File,
  caption?: string
): Promise<NurseryPhoto> {
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(imageFile)
  })

  const res = await fetch(`${API_URL}/api/v1/provider/nurseries/${encodeURIComponent(urn)}/photos`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ image: base64, caption }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Upload failed: ${res.status}`)
  }
  return res.json()
}

export async function deleteNurseryPhoto(
  token: string,
  urn: string,
  photoId: string
): Promise<void> {
  const res = await fetch(
    `${API_URL}/api/v1/provider/nurseries/${encodeURIComponent(urn)}/photos/${encodeURIComponent(photoId)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Delete failed: ${res.status}`)
  }
}

export async function reorderNurseryPhotos(
  token: string,
  urn: string,
  order: string[]
): Promise<NurseryPhoto[]> {
  const res = await fetch(
    `${API_URL}/api/v1/provider/nurseries/${encodeURIComponent(urn)}/photos/reorder`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ order }),
    }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Reorder failed: ${res.status}`)
  }
  const data = await res.json()
  return data.data || []
}

export interface NurseryFee {
  id: string
  nursery_urn: string
  age_group: string
  session_type: string
  price_gbp: number
  notes: string | null
  created_at: string
  updated_at: string
}

export async function getNurseryFees(urn: string): Promise<NurseryFee[]> {
  try {
    const res = await fetch(`${API_URL}/api/v1/provider/nurseries/${encodeURIComponent(urn)}/fees`, {
      cache: 'no-store',
    })
    if (!res.ok) return []
    const data = await res.json()
    return data.data || []
  } catch {
    return []
  }
}

export async function addNurseryFee(
  token: string,
  urn: string,
  fee: { age_group: string; session_type: string; price_gbp: number; notes?: string }
): Promise<NurseryFee> {
  const res = await fetch(`${API_URL}/api/v1/provider/nurseries/${encodeURIComponent(urn)}/fees`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(fee),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Add fee failed: ${res.status}`)
  }
  return res.json()
}

export async function updateNurseryFee(
  token: string,
  urn: string,
  feeId: string,
  patch: Partial<{ age_group: string; session_type: string; price_gbp: number; notes: string }>
): Promise<NurseryFee> {
  const res = await fetch(
    `${API_URL}/api/v1/provider/nurseries/${encodeURIComponent(urn)}/fees/${encodeURIComponent(feeId)}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(patch),
    }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Update fee failed: ${res.status}`)
  }
  return res.json()
}

export async function deleteNurseryFee(
  token: string,
  urn: string,
  feeId: string
): Promise<void> {
  const res = await fetch(
    `${API_URL}/api/v1/provider/nurseries/${encodeURIComponent(urn)}/fees/${encodeURIComponent(feeId)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Delete fee failed: ${res.status}`)
  }
}

// Availability / Waitlist -------------------------------------------------------

export interface NurseryAvailability {
  id: string
  nursery_urn: string
  age_group: string
  spots_available: number
  waitlist_length: number
  next_available_date: string | null
  updated_at: string
}

export async function getNurseryAvailability(urn: string): Promise<NurseryAvailability[]> {
  try {
    const res = await fetch(
      `${API_URL}/api/v1/provider/nurseries/${encodeURIComponent(urn)}/availability`,
      { cache: 'no-store' }
    )
    if (!res.ok) return []
    const data = await res.json()
    return data.data || []
  } catch {
    return []
  }
}

export async function updateNurseryAvailability(
  token: string,
  urn: string,
  availability: Array<{
    age_group: string
    spots_available: number
    waitlist_length: number
    next_available_date: string | null
  }>
): Promise<NurseryAvailability[]> {
  const res = await fetch(
    `${API_URL}/api/v1/provider/nurseries/${encodeURIComponent(urn)}/availability`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(availability),
    }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Update availability failed: ${res.status}`)
  }
  const data = await res.json()
  return data.data || []
}

// Admin API helpers ------------------------------------------------------------

// Admin analytics helpers -----------------------------------------------------

export interface AdminGrowthStats {
  nurseries: { this_week: number; this_month: number }
  users: { this_week: number; this_month: number }
  reviews: { this_week: number; this_month: number }
  claims: { this_week: number; this_month: number }
}

export interface AdminDataQuality {
  nurseries_no_location: number
  nurseries_no_grade: number
  nurseries_stale_inspection: number
  reviews_pending_moderation: number
}

export interface AdminActivityItem {
  type: 'review' | 'claim' | 'signup'
  date: string
  description: string
  status: string | null
  link: string
  meta: Record<string, unknown>
}

export async function getAdminGrowthStats(token: string): Promise<AdminGrowthStats> {
  const res = await fetch(`${API_URL}/api/v1/admin/stats/growth`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Admin API error: ${res.status}`)
  return res.json()
}

export async function getAdminDataQuality(token: string): Promise<AdminDataQuality> {
  const res = await fetch(`${API_URL}/api/v1/admin/stats/data-quality`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Admin API error: ${res.status}`)
  return res.json()
}

export async function getAdminActivity(token: string, limit = 50): Promise<AdminActivityItem[]> {
  const res = await fetch(`${API_URL}/api/v1/admin/activity?limit=${limit}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Admin API error: ${res.status}`)
  const json = await res.json()
  return json.data || []
}

export async function adminFetch(path: string, token: string, options?: RequestInit) {
  const res = await fetch(`${API_URL}/api/v1/admin${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Admin API error: ${res.status}`)
  return res.json()
}
