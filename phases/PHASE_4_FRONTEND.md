# Phase 4 — Frontend MVP (Four Screens)

**Paste into Claude Code:** `Read phases/PHASE_4_FRONTEND.md and execute it`

---

## What this phase does

Builds the four MVP screens in Next.js 14 App Router:
1. Homepage — postcode search
2. Search page — map + results + filters
3. Nursery profile — detail page
4. Shortlist — saved nurseries

Panel instruction from David Park: "Build four screens. Nothing else."

---

## Tasks

### 4.1 — Create frontend/lib/api.ts

All API calls go through this file. Never call the backend directly from components.

```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export interface Nursery {
  id: string
  urn: string
  name: string
  provider_type: string | null
  address_line1: string | null
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

export async function getNursery(urn: string): Promise<Nursery> {
  const res = await fetch(`${API_URL}/api/v1/nurseries/${urn}`, {
    next: { revalidate: 3600 }, // Cache for 1 hour
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
```

### 4.2 — Create lib/shortlist.ts

Manages shortlist in localStorage (upgraded to Supabase in Phase 6):

```typescript
'use client'

const STORAGE_KEY = 'nursery-shortlist'
const MAX_SHORTLIST = 10

export function getShortlist(): string[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

export function addToShortlist(urn: string): boolean {
  const list = getShortlist()
  if (list.includes(urn) || list.length >= MAX_SHORTLIST) return false
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...list, urn]))
  window.dispatchEvent(new Event('shortlist-updated'))
  return true
}

export function removeFromShortlist(urn: string): void {
  const list = getShortlist().filter(u => u !== urn)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  window.dispatchEvent(new Event('shortlist-updated'))
}

export function isInShortlist(urn: string): boolean {
  return getShortlist().includes(urn)
}

export function getShortlistCount(): number {
  return getShortlist().length
}
```

### 4.3 — Create app/page.tsx — Homepage

```tsx
import { Metadata } from 'next'
import HomeSearch from '@/components/HomeSearch'

export const metadata: Metadata = {
  title: 'NurseryFinder — Compare UK Nurseries by Ofsted Grade',
  description: 'Find and compare Ofsted-rated nurseries near you. Search by postcode, filter by grade, and find funded places. Free to use.',
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Hero */}
      <div className="max-w-3xl mx-auto px-4 pt-16 pb-12 text-center">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
          Find the right nursery for your child
        </h1>
        <p className="text-xl text-gray-600 mb-10">
          Search thousands of Ofsted-rated nurseries across the UK.
          Compare grades, funded places, and inspection history — free.
        </p>

        <HomeSearch />
      </div>

      {/* Trust signals */}
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { icon: '🏫', title: '80,000+ nurseries', body: 'Every registered nursery in England from the Ofsted Early Years Register' },
            { icon: '⭐', title: 'Official Ofsted data', body: 'Inspection grades and reports sourced directly from Ofsted. Updated monthly.' },
            { icon: '💷', title: 'Free to use', body: 'No sign-up required. Compare as many nurseries as you need.' },
          ].map(card => (
            <div key={card.title} className="bg-white rounded-xl border border-gray-200 p-6 text-center shadow-sm">
              <div className="text-3xl mb-3">{card.icon}</div>
              <h3 className="font-semibold text-gray-900 mb-2">{card.title}</h3>
              <p className="text-sm text-gray-600">{card.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

### 4.4 — Create components/HomeSearch.tsx (client component)

```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function HomeSearch() {
  const [postcode, setPostcode] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const cleaned = postcode.trim().toUpperCase()
    if (!cleaned) { setError('Please enter a postcode'); return }
    setError('')
    router.push(`/search?postcode=${encodeURIComponent(cleaned)}`)
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 max-w-xl mx-auto">
        <input
          type="text"
          value={postcode}
          onChange={e => setPostcode(e.target.value)}
          placeholder="Enter postcode, e.g. SW11 1AA"
          className="flex-1 px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none"
          autoComplete="postal-code"
        />
        <button
          onClick={handleSearch}
          className="px-8 py-3 bg-blue-600 text-white text-lg font-semibold rounded-xl hover:bg-blue-700 transition-colors"
        >
          Search
        </button>
      </div>
      {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
    </div>
  )
}
```

### 4.5 — Create app/search/page.tsx — Search results page

This is a client component due to the map and interactive filters.
Use 'use client' at the top.

Key layout:
- Mobile: filters collapsed → results list → map below
- Desktop: left 1/3 (filters + cards) | right 2/3 (map)

Build this page with:

1. Read `postcode` from URL search params
2. State for: results, loading, error, filters (radius, grade, funded_2yr, funded_3yr)
3. On mount + filter change: call `searchNurseries()` from lib/api.ts
4. Left panel: search bar (re-search), filter controls, result count, NurseryCard list
5. Right panel: Leaflet map with markers coloured by grade

**Leaflet map notes:**
- Import Leaflet CSS in the component: `import 'leaflet/dist/leaflet.css'`
- Use dynamic import for the Map component to avoid SSR issues:
  `const Map = dynamic(() => import('@/components/NurseryMap'), { ssr: false })`
- Map centered on search lat/lng
- Circle showing search radius
- Marker colours: Outstanding=#22c55e, Good=#3b82f6, Requires Improvement=#f59e0b, Inadequate=#ef4444, null=#9ca3af

**Filter controls to include:**
- Distance slider: options 1, 2, 5, 10, 20 km
- Grade select: All grades | Outstanding | Good | Requires Improvement | Inadequate
- Toggle: "2-year funded places only"
- Toggle: "3–4 year funded places only"

### 4.6 — Create components/NurseryCard.tsx

```tsx
import Link from 'next/link'
import GradeBadge from './GradeBadge'
import { Nursery } from '@/lib/api'
import ShortlistButton from './ShortlistButton'

interface Props {
  nursery: Nursery
  showDistance?: boolean
}

export default function NurseryCard({ nursery, showDistance = true }: Props) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start gap-2 mb-2">
        <Link
          href={`/nursery/${nursery.urn}`}
          className="font-semibold text-gray-900 hover:text-blue-600 line-clamp-2 flex-1"
        >
          {nursery.name}
        </Link>
        <ShortlistButton urn={nursery.urn} />
      </div>

      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <GradeBadge grade={nursery.ofsted_overall_grade} size="sm" />
        {nursery.inspection_date_warning && (
          <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
            ⚠️ Old inspection
          </span>
        )}
      </div>

      <p className="text-sm text-gray-500 mb-2">
        {nursery.address_line1 && `${nursery.address_line1}, `}{nursery.town}
      </p>

      <div className="flex gap-3 text-xs text-gray-600 flex-wrap">
        {nursery.total_places && (
          <span>🏫 {nursery.total_places} places</span>
        )}
        {nursery.places_funded_2yr && nursery.places_funded_2yr > 0 && (
          <span className="text-green-700">✓ 2yr funded</span>
        )}
        {nursery.places_funded_3_4yr && nursery.places_funded_3_4yr > 0 && (
          <span className="text-green-700">✓ 3-4yr funded</span>
        )}
        {showDistance && nursery.distance_km != null && (
          <span>📍 {nursery.distance_km.toFixed(1)}km away</span>
        )}
        {nursery.fee_avg_monthly && nursery.fee_report_count >= 3 && (
          <span>💷 ~£{nursery.fee_avg_monthly}/mo</span>
        )}
      </div>

      {nursery.last_inspection_date && (
        <p className="text-xs text-gray-400 mt-2">
          Inspected {new Date(nursery.last_inspection_date).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
        </p>
      )}
    </div>
  )
}
```

### 4.7 — Create components/ShortlistButton.tsx (client component)

Toggles shortlist state using localStorage. Shows heart icon. Listens to `shortlist-updated` event.

### 4.8 — Create components/NurseryMap.tsx (client only, no SSR)

Leaflet map component. Accepts `nurseries: Nursery[]`, `centerLat`, `centerLng`, `radiusKm`.
Uses react-leaflet MapContainer, TileLayer, CircleMarker.
On marker click: show popup with nursery name, grade badge, distance, and a link to nursery page.

### 4.9 — Create app/nursery/[urn]/page.tsx — Nursery profile (server rendered)

```tsx
import { Metadata } from 'next'
import { getNursery } from '@/lib/api'
import { notFound } from 'next/navigation'
import GradeBadge from '@/components/GradeBadge'
import StaleGradeBanner from '@/components/StaleGradeBanner'
import EnforcementBanner from '@/components/EnforcementBanner'
import FeeModal from '@/components/FeeModal'
import ShortlistButton from '@/components/ShortlistButton'
import OglAttribution from '@/components/OglAttribution'
import dynamic from 'next/dynamic'

const SingleNurseryMap = dynamic(() => import('@/components/SingleNurseryMap'), { ssr: false })

export async function generateMetadata({ params }: { params: { urn: string } }): Promise<Metadata> {
  try {
    const nursery = await getNursery(params.urn)
    return {
      title: `${nursery.name} — Ofsted ${nursery.ofsted_overall_grade || 'Rating Pending'} | NurseryFinder`,
      description: `${nursery.name} in ${nursery.town} is rated ${nursery.ofsted_overall_grade || 'not yet rated'} by Ofsted. ${nursery.total_places ? `${nursery.total_places} places available.` : ''}`,
    }
  } catch {
    return { title: 'Nursery not found | NurseryFinder' }
  }
}

export default async function NurseryPage({ params }: { params: { urn: string } }) {
  let nursery
  try {
    nursery = await getNursery(params.urn)
  } catch {
    notFound()
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Banners — most important, shown first */}
      <EnforcementBanner
        enforcementNotice={nursery.enforcement_notice}
        inspectionReportUrl={nursery.inspection_report_url}
      />
      <StaleGradeBanner
        lastInspectionDate={nursery.last_inspection_date}
        inspectionDateWarning={nursery.inspection_date_warning}
      />

      {/* Header */}
      <div className="flex justify-between items-start gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{nursery.name}</h1>
          <p className="text-gray-500 mt-1">{nursery.town}{nursery.local_authority ? `, ${nursery.local_authority}` : ''}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <GradeBadge grade={nursery.ofsted_overall_grade} size="lg" />
          <ShortlistButton urn={nursery.urn} />
        </div>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {nursery.address_line1 && (
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-xs text-gray-500 uppercase font-medium mb-1">Address</p>
            <p className="text-sm">{nursery.address_line1}</p>
            {nursery.address_line2 && <p className="text-sm">{nursery.address_line2}</p>}
            <p className="text-sm">{nursery.town}</p>
            <p className="text-sm font-medium">{nursery.postcode}</p>
          </div>
        )}

        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase font-medium mb-1">Places</p>
          {nursery.total_places && <p className="text-sm">Total: <strong>{nursery.total_places}</strong></p>}
          {nursery.places_funded_2yr && nursery.places_funded_2yr > 0 && (
            <p className="text-sm text-green-700">✓ {nursery.places_funded_2yr} funded 2-year places</p>
          )}
          {nursery.places_funded_3_4yr && nursery.places_funded_3_4yr > 0 && (
            <p className="text-sm text-green-700">✓ {nursery.places_funded_3_4yr} funded 3-4yr places</p>
          )}
        </div>

        {(nursery.phone || nursery.email) && (
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-xs text-gray-500 uppercase font-medium mb-1">Contact</p>
            {nursery.phone && <p className="text-sm">📞 {nursery.phone}</p>}
            {nursery.email && <p className="text-sm">✉️ {nursery.email}</p>}
            {nursery.website && (
              <a href={nursery.website} target="_blank" rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline">🌐 Website</a>
            )}
          </div>
        )}

        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase font-medium mb-1">Ofsted Inspection</p>
          {nursery.last_inspection_date && (
            <p className="text-sm">
              Last inspected: {new Date(nursery.last_inspection_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          )}
          {nursery.inspection_report_url && (
            <a href={nursery.inspection_report_url} target="_blank" rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:underline mt-1 block">
              View full Ofsted report →
            </a>
          )}
        </div>
      </div>

      {/* Fee section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <p className="font-medium text-blue-900 mb-1">💷 Fees</p>
        {nursery.fee_avg_monthly && nursery.fee_report_count >= 3 ? (
          <p className="text-sm text-blue-800">
            Average: <strong>£{nursery.fee_avg_monthly}/month</strong> — based on {nursery.fee_report_count} parent reports
          </p>
        ) : (
          <p className="text-sm text-blue-700">No fee data yet for this nursery.</p>
        )}
        <FeeModal nurseryId={nursery.id} />
      </div>

      {/* Map */}
      {nursery.lat && nursery.lng && (
        <div className="mb-6 rounded-lg overflow-hidden border border-gray-200 h-48">
          <SingleNurseryMap lat={nursery.lat} lng={nursery.lng} name={nursery.name} />
        </div>
      )}

      <OglAttribution />
    </div>
  )
}
```

### 4.10 — Create components/FeeModal.tsx (client component)

Modal with form to submit anonymous fee. Fields:
- Monthly fee (number input, £, required)
- Hours per week (optional)
- Child's age group (select: Under 2, 2-3 years, 3-5 years)
- Submit button
On success: show thank you message. On error: show error.

### 4.11 — Create app/shortlist/page.tsx — Shortlist

Client component. On mount reads from localStorage shortlist (list of URNs).
For each URN, fetches nursery data from API.
Shows grid of NurseryCard components.
"Remove" button on each card.
Empty state: "No nurseries saved yet. Search for nurseries to add them."
"Share shortlist" button: copies URL like `/shortlist?urns=123,456,789` to clipboard.

### 4.12 — Create components/Nav.tsx

Simple header with:
- "NurseryFinder" logo/wordmark (links to /)
- Shortlist link with count badge (reads from localStorage)
- Mobile: hamburger collapses to drawer

Add Nav to app/layout.tsx above {children}.

### 4.13 — Test all four pages

Start both servers:
```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev
```

Visit and verify:
- http://localhost:3000 — homepage loads, search redirects to /search?postcode=...
- http://localhost:3000/search?postcode=SW11 — results appear, map shows markers
- http://localhost:3000/nursery/[any-urn] — profile loads with grade badge
- http://localhost:3000/shortlist — shortlist shows saved nurseries

### 4.14 — Commit

```bash
git add -A
git commit -m "feat: phase 4 — Next.js frontend with 4 MVP screens"
```

### 4.15 — Tell Byron what to do next

```
✅ Phase 4 complete!

Your app is running at:
- Frontend: http://localhost:3000
- Backend:  http://localhost:3001

Test the full journey:
1. Go to http://localhost:3000
2. Enter your postcode
3. Browse nursery results on the map
4. Click a nursery to see its full profile
5. Add it to your shortlist (heart icon)
6. View your shortlist at /shortlist

Ready to deploy? → Type: Read phases/PHASE_5_DEPLOY.md and execute it
```
