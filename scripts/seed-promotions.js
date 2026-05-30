#!/usr/bin/env node
/**
 * Seed promotions by finding local children's activities via Google Places API.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... GOOGLE_PLACES_API_KEY=... \
 *     node scripts/seed-promotions.js [--districts SW11,E1,M1,LS1,BS1]
 *
 * Defaults to 20 major UK postcode districts if none specified.
 * Finds up to 10 kid-friendly activity businesses per district.
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY
const GOOGLE_KEY = process.env.GOOGLE_PLACES_API_KEY

if (!SUPABASE_URL || !SUPABASE_KEY || !GOOGLE_KEY) {
  console.error('Required: SUPABASE_URL, SUPABASE_SERVICE_KEY, GOOGLE_PLACES_API_KEY')
  process.exit(1)
}

const db = createClient(SUPABASE_URL, SUPABASE_KEY)

const DEFAULT_DISTRICTS = [
  'SW11', 'SW1', 'E1', 'N1', 'W1', 'SE1',
  'M1', 'M20', 'LS1', 'LS6',
  'B1', 'B15', 'BS1', 'BS8',
  'EH1', 'G1', 'CF1', 'L1',
  'NE1', 'NG1',
]

const SEARCH_QUERIES = [
  { query: 'swimming lessons for kids', category: 'swimming' },
  { query: 'baby music class', category: 'music' },
  { query: 'soft play centre', category: 'soft_play' },
  { query: 'children dance class', category: 'dance' },
  { query: 'kids sports class', category: 'sports' },
  { query: 'children art class', category: 'arts' },
  { query: 'baby sensory class', category: 'other' },
  { query: 'kids gymnastics', category: 'sports' },
  { query: 'toddler group', category: 'other' },
  { query: 'kids yoga', category: 'health' },
]

async function geocodeDistrict(district) {
  const res = await fetch(`https://api.postcodes.io/outcodes/${encodeURIComponent(district)}`)
  if (!res.ok) return null
  const data = await res.json()
  if (!data.result) return null
  return { lat: data.result.latitude, lng: data.result.longitude }
}

async function searchPlaces(lat, lng, query) {
  const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json')
  url.searchParams.set('query', query)
  url.searchParams.set('location', `${lat},${lng}`)
  url.searchParams.set('radius', '5000')
  url.searchParams.set('key', GOOGLE_KEY)

  const res = await fetch(url.toString())
  if (!res.ok) {
    console.warn(`  Google Places API error: ${res.status}`)
    return []
  }
  const data = await res.json()
  return (data.results || []).slice(0, 3)
}

async function upsertPromotion(place, category, district, coords) {
  const title = place.name
  const description = place.formatted_address || ''
  const link_url = place.website ||
    `https://www.google.com/maps/place/?q=place_id:${place.place_id}`

  const existing = await db
    .from('promotions')
    .select('id')
    .eq('title', title)
    .eq('category', category)
    .limit(1)

  if (existing.data && existing.data.length > 0) {
    return { skipped: true, title }
  }

  const { error } = await db.from('promotions').insert({
    title,
    description: description.slice(0, 200),
    link_url,
    category,
    lat: place.geometry?.location?.lat || coords.lat,
    lng: place.geometry?.location?.lng || coords.lng,
    postcode_district: district,
    radius_km: 5,
    active: true,
    image_url: place.photos?.[0]
      ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${place.photos[0].photo_reference}&key=${GOOGLE_KEY}`
      : null,
  })

  if (error) {
    console.warn(`  Insert failed for "${title}": ${error.message}`)
    return { failed: true, title }
  }
  return { created: true, title }
}

async function main() {
  const args = process.argv.slice(2)
  let districts = DEFAULT_DISTRICTS

  const districtFlag = args.find(a => a.startsWith('--districts='))
  if (districtFlag) {
    districts = districtFlag.split('=')[1].split(',').map(d => d.trim().toUpperCase())
  }

  console.log(`Seeding promotions for ${districts.length} districts...`)
  let totalCreated = 0
  let totalSkipped = 0
  let totalFailed = 0

  for (const district of districts) {
    console.log(`\n--- ${district} ---`)
    const coords = await geocodeDistrict(district)
    if (!coords) {
      console.warn(`  Could not geocode district ${district}, skipping`)
      continue
    }

    const shuffled = SEARCH_QUERIES.sort(() => Math.random() - 0.5).slice(0, 5)

    for (const { query, category } of shuffled) {
      console.log(`  Searching: "${query}" (${category})`)
      const places = await searchPlaces(coords.lat, coords.lng, query)

      for (const place of places) {
        const result = await upsertPromotion(place, category, district, coords)
        if (result.created) {
          console.log(`    + ${result.title}`)
          totalCreated++
        } else if (result.skipped) {
          totalSkipped++
        } else {
          totalFailed++
        }
      }

      // Rate limit: 200ms between Google Places calls
      await new Promise(r => setTimeout(r, 200))
    }
  }

  console.log(`\nDone! Created: ${totalCreated}, Skipped: ${totalSkipped}, Failed: ${totalFailed}`)
}

main().catch(err => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
