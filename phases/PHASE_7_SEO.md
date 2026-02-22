# Phase 7 — SEO & Content Engine

**Paste into Claude Code:** `Read phases/PHASE_7_SEO.md and execute it`

---

## What this phase does

Builds the statically generated area pages that will rank in Google for searches
like "nurseries in hackney" or "outstanding nurseries sw11". Generates a sitemap
for 88,000+ pages. Adds JSON-LD structured data. This is your long-term free
traffic engine.

---

## Tasks

### 7.1 — Create app/nurseries-in/[district]/page.tsx

Server-side generated area pages. These are the SEO goldmine.

```tsx
import { Metadata } from 'next'
import { getNurseriesInDistrict } from '@/lib/api'
import NurseryCard from '@/components/NurseryCard'
import GradeBadge from '@/components/GradeBadge'
import OglAttribution from '@/components/OglAttribution'
import Link from 'next/link'

interface Props {
  params: { district: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const district = params.district.toUpperCase()
  const { nurseries, stats } = await getNurseriesInDistrict(district)
  return {
    title: `Nurseries in ${district} — ${stats.total} Found | NurseryFinder`,
    description: `${stats.total} Ofsted-rated nurseries in ${district}. ${stats.outstanding} rated Outstanding. Compare grades, funded places and inspection dates.`,
    alternates: {
      canonical: `/nurseries-in/${district.toLowerCase()}`,
    },
  }
}

export default async function AreaPage({ params }: Props) {
  const district = params.district.toUpperCase()
  const { nurseries, stats } = await getNurseriesInDistrict(district)

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Nurseries in {district}
        </h1>
        <p className="text-gray-600">
          {stats.total} registered nurseries — {stats.outstanding} Outstanding, {stats.good} Good
        </p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total nurseries', value: stats.total },
          { label: 'Outstanding', value: stats.outstanding },
          { label: 'Good', value: stats.good },
          { label: '% Outstanding/Good', value: `${Math.round(((stats.outstanding + stats.good) / stats.total) * 100)}%` },
        ].map(s => (
          <div key={s.label} className="bg-gray-50 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Nursery list */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {nurseries.map(nursery => (
          <NurseryCard key={nursery.urn} nursery={nursery} showDistance={false} />
        ))}
      </div>

      {/* Back to search */}
      <div className="mt-8 text-center">
        <Link
          href={`/search?postcode=${district}`}
          className="inline-block px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700"
        >
          Search nurseries on map →
        </Link>
      </div>

      {/* JSON-LD structured data for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: `Nurseries in ${district}`,
            numberOfItems: stats.total,
            itemListElement: nurseries.slice(0, 10).map((n, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              item: {
                '@type': 'ChildCare',
                name: n.name,
                address: {
                  '@type': 'PostalAddress',
                  streetAddress: n.address_line1,
                  addressLocality: n.town,
                  postalCode: n.postcode,
                  addressCountry: 'GB',
                },
              },
            })),
          }),
        }}
      />

      <OglAttribution />
    </div>
  )
}
```

### 7.2 — Add JSON-LD to nursery profile pages

Update `app/nursery/[urn]/page.tsx` — add LocalBusiness structured data:

```tsx
// Add inside the page component, before closing </div>
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{
    __html: JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'ChildCare',
      name: nursery.name,
      address: {
        '@type': 'PostalAddress',
        streetAddress: nursery.address_line1,
        addressLocality: nursery.town,
        postalCode: nursery.postcode,
        addressCountry: 'GB',
      },
      telephone: nursery.phone,
      url: nursery.website,
      ...(nursery.google_rating && {
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: nursery.google_rating,
          reviewCount: nursery.google_review_count,
        }
      }),
    }),
  }}
/>
```

### 7.3 — Add getNurseriesInDistrict to lib/api.ts

```typescript
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
```

### 7.4 — Add area nurseries endpoint to backend

In `backend/src/routes/areas.js`:

```js
// GET /api/v1/areas/:district/nurseries
router.get('/:district/nurseries', async (req, res, next) => {
  try {
    const district = req.params.district.toUpperCase()

    const { data: nurseries, error } = await db
      .from('nurseries')
      .select('urn, name, provider_type, address_line1, town, postcode, local_authority, ofsted_overall_grade, last_inspection_date, inspection_report_url, inspection_date_warning, enforcement_notice, total_places, places_funded_2yr, places_funded_3_4yr, fee_avg_monthly, fee_report_count, lat, lng')
      .eq('registration_status', 'Active')
      .like('postcode', `${district}%`)
      .order('ofsted_overall_grade', { ascending: true, nullsFirst: false })
      .limit(200)

    if (error) throw error

    const total = nurseries.length
    const outstanding = nurseries.filter(n => n.ofsted_overall_grade === 'Outstanding').length
    const good = nurseries.filter(n => n.ofsted_overall_grade === 'Good').length

    res.json({ nurseries, stats: { total, outstanding, good, district } })
  } catch (err) {
    next(err)
  }
})
```

### 7.5 — Create scripts/generate-sitemap.js

```js
// Generates sitemap.xml with all nursery and area URLs
// Run: node scripts/generate-sitemap.js
// Schedule: weekly in worker.js cron

import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'fs'

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
const BASE_URL = process.env.FRONTEND_URL || 'https://nurseryfinder.co.uk'

async function generateSitemap() {
  console.log('Generating sitemap...')

  // Fetch all active URNs
  const { data: nurseries } = await db
    .from('nurseries')
    .select('urn, updated_at')
    .eq('registration_status', 'Active')
    .limit(100000)

  // Fetch all postcode districts
  const { data: areas } = await db
    .from('postcode_areas')
    .select('postcode_district, updated_at')

  const urls = [
    // Static pages
    `<url><loc>${BASE_URL}/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>`,
    `<url><loc>${BASE_URL}/search</loc><changefreq>daily</changefreq><priority>0.9</priority></url>`,
    `<url><loc>${BASE_URL}/privacy</loc><changefreq>yearly</changefreq><priority>0.3</priority></url>`,

    // Nursery pages
    ...(nurseries || []).map(n =>
      `<url><loc>${BASE_URL}/nursery/${n.urn}</loc><lastmod>${n.updated_at?.split('T')[0]}</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>`
    ),

    // Area pages
    ...(areas || []).map(a =>
      `<url><loc>${BASE_URL}/nurseries-in/${a.postcode_district.toLowerCase()}</loc><lastmod>${a.updated_at?.split('T')[0]}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>`
    ),
  ]

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`

  writeFileSync('frontend/public/sitemap.xml', sitemap)
  console.log(`✅ Sitemap generated: ${urls.length} URLs`)
  console.log(`   ${nurseries?.length || 0} nursery pages`)
  console.log(`   ${areas?.length || 0} area pages`)
}

generateSitemap().catch(console.error)
```

Add to `backend/src/worker.js`:
```js
// Regenerate sitemap every Sunday at 4am
cron.schedule('0 4 * * 0', async () => {
  logger.info('cron: regenerating sitemap')
  // Call sitemap generation script
  exec('node ../../scripts/generate-sitemap.js', (err, stdout) => {
    if (err) logger.error({ err: err.message }, 'cron: sitemap generation failed')
    else logger.info(stdout, 'cron: sitemap generated')
  })
})
```

### 7.6 — Create robots.txt

Create `frontend/public/robots.txt`:
```
User-agent: *
Allow: /

Sitemap: https://nurseryfinder.co.uk/sitemap.xml
```

### 7.7 — Submit to Google Search Console

Tell Byron:
```
After deploying:
1. Go to https://search.google.com/search-console
2. Add your property (your Vercel/custom domain)
3. Verify ownership (Google will guide you)
4. Submit your sitemap: https://nurseryfinder.co.uk/sitemap.xml
5. Check back in 2-4 weeks to see indexing progress

Your ~88,000 pages (nurseries + areas) will gradually appear in Google.
Area pages like "nurseries in sw11" are low competition and will rank quickly.
```

### 7.8 — Commit

```bash
git add -A
git commit -m "feat: phase 7 — SEO area pages, sitemap, JSON-LD structured data"
git push origin main
```

### 7.9 — Tell Byron what to do next

```
✅ Phase 7 complete!

SEO infrastructure is live:
- Area pages at /nurseries-in/[district] for every postcode district
- Sitemap with 88,000+ URLs submitted to Google
- JSON-LD structured data on nursery profile pages
- robots.txt configured

What to expect:
- Weeks 1-4: Google indexes your pages (check Search Console)
- Month 2-3: Area pages start ranking for "[postcode] nurseries" searches
- Month 4+: Nursery profile pages rank for "[nursery name] ofsted" searches

This is your free traffic engine. It compounds over time with no ongoing effort.

Ready for the property layer?
→ Type: Read phases/PHASE_8_PROPERTY.md and execute it

Or focus on growth first:
- Share in parenting Facebook groups
- Post in local Mumsnet forums
- Reach out to parenting bloggers
- Write a press release about the fee crowd-sourcing feature (first in the UK)
```
