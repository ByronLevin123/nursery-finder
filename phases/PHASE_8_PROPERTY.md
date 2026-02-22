# Phase 8 — Property & Area Intelligence Layer

**Paste into Claude Code:** `Read phases/PHASE_8_PROPERTY.md and execute it`

**Gate: Only start this phase after Phase 7 is live and you have meaningful traffic.**

---

## What this phase does

Adds the family relocation layer: Land Registry property prices, Police crime data,
Environment Agency flood risk, ONS deprivation scores, and a composite Family Score
per postcode district. Adds an area search UI where parents can find where to live
based on nursery quality and property prices.

---

## Context from panel review

Sarah Chen (Zoopla CTO) confirmed this architecture is sound with these amendments:
- Land Registry only (not Rightmove/Zoopla — they require commercial contracts)
- Stream Land Registry files — do not load 4GB CSV into memory
- Police API: max 1 request per 500ms, process 100 districts per nightly run
- IMD 2019 data — check for 2025 update from ONS before using
- Label Family Score as an estimate, not an official metric

---

## Tasks

### 8.1 — Create database/migrations/003_property_layer.sql

```sql
-- Migration 003: Property and area intelligence layer

-- Land Registry price paid (last 3 years only)
CREATE TABLE IF NOT EXISTS land_registry_prices (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  postcode            TEXT NOT NULL,
  postcode_district   TEXT NOT NULL,
  price               INTEGER NOT NULL,
  date_of_transfer    DATE NOT NULL,
  property_type       TEXT CHECK (property_type IN ('D','S','T','F','O')),
  -- D=Detached, S=Semi, T=Terraced, F=Flat, O=Other
  new_build           BOOLEAN,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX lr_district_date_idx ON land_registry_prices(postcode_district, date_of_transfer);
CREATE INDEX lr_district_type_idx ON land_registry_prices(postcode_district, property_type);

-- Pre-computed area property stats (refreshed monthly)
CREATE TABLE IF NOT EXISTS area_property_stats (
  postcode_district     TEXT PRIMARY KEY,
  avg_price_all         INTEGER,
  avg_price_flat        INTEGER,
  avg_price_terraced    INTEGER,
  avg_price_semi        INTEGER,
  avg_price_detached    INTEGER,
  median_price          INTEGER,
  transactions_last_12m INTEGER,
  price_change_1yr_pct  DECIMAL(5,2),
  last_calculated       TIMESTAMPTZ DEFAULT NOW()
);

-- Family Score calculation function
CREATE OR REPLACE FUNCTION calculate_family_score(district TEXT)
RETURNS DECIMAL(3,1)
LANGUAGE plpgsql
AS $$
DECLARE
  v_area            postcode_areas%ROWTYPE;
  v_nursery_score   DECIMAL;
  v_safety_score    DECIMAL;
  v_deprivation_score DECIMAL;
  v_flood_score     DECIMAL;
  v_final_score     DECIMAL(3,1);
  v_breakdown       JSONB;
BEGIN
  SELECT * INTO v_area FROM postcode_areas WHERE postcode_district = district;
  IF NOT FOUND THEN RETURN NULL; END IF;

  -- Nursery score (0-10): % outstanding nurseries
  v_nursery_score := COALESCE(
    LEAST(10, (v_area.nursery_outstanding_pct / 100.0) * 10),
    5  -- default if no data
  );

  -- Safety score (0-10): based on crime rate per 1,000
  v_safety_score := CASE
    WHEN v_area.crime_rate_per_1000 IS NULL THEN 5
    WHEN v_area.crime_rate_per_1000 < 20 THEN 10
    WHEN v_area.crime_rate_per_1000 < 40 THEN 8
    WHEN v_area.crime_rate_per_1000 < 60 THEN 6
    WHEN v_area.crime_rate_per_1000 < 80 THEN 4
    ELSE 2
  END;

  -- Deprivation score (1-10): IMD decile (10 = least deprived)
  v_deprivation_score := COALESCE(v_area.imd_decile, 5)::DECIMAL;

  -- Flood score (0-10)
  v_flood_score := CASE v_area.flood_risk_level
    WHEN 'Very Low' THEN 10
    WHEN 'Low' THEN 8
    WHEN 'Medium' THEN 5
    WHEN 'High' THEN 2
    ELSE 7  -- unknown = neutral
  END;

  -- Weighted composite (weights must sum to 1.0)
  v_final_score := ROUND(
    (v_nursery_score     * 0.35) +
    (v_safety_score      * 0.30) +
    (v_deprivation_score * 0.25) +
    (v_flood_score       * 0.10),
  1);

  v_breakdown := jsonb_build_object(
    'nursery',     jsonb_build_object('score', v_nursery_score, 'weight', 0.35),
    'safety',      jsonb_build_object('score', v_safety_score, 'weight', 0.30),
    'deprivation', jsonb_build_object('score', v_deprivation_score, 'weight', 0.25),
    'flood',       jsonb_build_object('score', v_flood_score, 'weight', 0.10)
  );

  UPDATE postcode_areas SET
    family_score = v_final_score,
    family_score_breakdown = v_breakdown,
    updated_at = NOW()
  WHERE postcode_district = district;

  RETURN v_final_score;
END;
$$;
```

### 8.2 — Create backend/src/services/landRegistry.js

```js
// Land Registry Price Paid Data ingestion
// CRITICAL: Files are 4GB+ — stream only, never load into memory
// We only import the last 3 years to keep storage manageable

import axios from 'axios'
import csv from 'csv-parser'
import db from '../db.js'
import { logger } from '../logger.js'

const BATCH_SIZE = 1000
const BASE_URL = 'http://prod.publicdata.landregistry.gov.uk'

function extractDistrict(postcode) {
  if (!postcode) return null
  // Postcode like "SW11 1AA" → district "SW11"
  return postcode.trim().split(' ')[0].toUpperCase()
}

export async function ingestLandRegistryYear(year) {
  const url = `${BASE_URL}/pp-${year}.csv`
  logger.info({ url, year }, 'land_registry: starting ingestion')

  const cutoffDate = new Date()
  cutoffDate.setFullYear(cutoffDate.getFullYear() - 3)

  let imported = 0
  let skipped = 0
  let batch = []

  return new Promise((resolve, reject) => {
    axios({
      method: 'get',
      url,
      responseType: 'stream',
    }).then(response => {
      response.data
        .pipe(csv({
          headers: [
            'transaction_id', 'price', 'date_of_transfer', 'postcode',
            'property_type', 'new_build', 'estate_type', 'saon', 'paon',
            'street', 'locality', 'town', 'district', 'county',
            'ppd_type', 'record_status'
          ],
          skipLines: 0,
        }))
        .on('data', async row => {
          const transferDate = new Date(row.date_of_transfer)
          if (transferDate < cutoffDate) { skipped++; return }

          const district = extractDistrict(row.postcode)
          if (!district) { skipped++; return }

          batch.push({
            postcode: row.postcode?.trim().toUpperCase(),
            postcode_district: district,
            price: parseInt(row.price),
            date_of_transfer: row.date_of_transfer,
            property_type: row.property_type,
            new_build: row.new_build === 'Y',
          })

          // Flush batch
          if (batch.length >= BATCH_SIZE) {
            const currentBatch = [...batch]
            batch = []
            try {
              await db.from('land_registry_prices').upsert(currentBatch, {
                onConflict: 'postcode,date_of_transfer,price',
                ignoreDuplicates: true,
              })
              imported += currentBatch.length
              if (imported % 10000 === 0) {
                logger.info({ imported, skipped }, 'land_registry: progress')
              }
            } catch (err) {
              logger.error({ err: err.message }, 'land_registry: batch insert failed')
            }
          }
        })
        .on('end', async () => {
          // Flush remaining
          if (batch.length > 0) {
            await db.from('land_registry_prices').upsert(batch, { ignoreDuplicates: true })
            imported += batch.length
          }
          logger.info({ imported, skipped, year }, 'land_registry: year complete')
          resolve({ imported, skipped, year })
        })
        .on('error', reject)
    }).catch(reject)
  })
}

// Compute area_property_stats from raw price data
export async function refreshPropertyStats() {
  logger.info('land_registry: refreshing area property stats')

  // Run aggregation query in Supabase
  const { data, error } = await db.rpc('compute_area_property_stats')
  if (error) throw error

  logger.info('land_registry: property stats refreshed')
}
```

### 8.3 — Create backend/src/services/policeApi.js

```js
// Police API crime data ingestion
// Free, no API key. Rate limit: 1 req/500ms (strictly enforced)

import axios from 'axios'
import db from '../db.js'
import { logger } from '../logger.js'

const BASE_URL = 'https://data.police.uk/api'
const RATE_LIMIT_MS = 600  // 600ms between requests (safe margin)

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Get crime data for a lat/lng point and date (YYYY-MM)
async function getCrimesForPoint(lat, lng, date) {
  const response = await axios.get(`${BASE_URL}/crimes-street/all-crime`, {
    params: { lat, lng, date },
    timeout: 15000,
  })
  return response.data
}

// Process a batch of districts (call nightly with 100 districts)
export async function ingestCrimeDataBatch(districts) {
  let processed = 0
  let failed = 0

  // Get 3 months ago (recent but not "this month" which may be incomplete)
  const date = new Date()
  date.setMonth(date.getMonth() - 2)
  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

  for (const district of districts) {
    try {
      // Get area centroid
      const { data: area } = await db
        .from('postcode_areas')
        .select('lat, lng, postcode_district')
        .eq('postcode_district', district)
        .single()

      if (!area?.lat || !area?.lng) {
        logger.warn({ district }, 'police: no centroid for district, skipping')
        failed++
        continue
      }

      const crimes = await getCrimesForPoint(area.lat, area.lng, dateStr)

      // Aggregate by category
      const byCategory = {}
      crimes.forEach(crime => {
        byCategory[crime.category] = (byCategory[crime.category] || 0) + 1
      })

      // Population estimate (rough — district-level estimates)
      const populationEstimate = 15000  // average UK postcode district population

      const crimeRate = (crimes.length / populationEstimate) * 1000

      await db.from('postcode_areas').update({
        crime_rate_per_1000: crimeRate,
        crime_categories: byCategory,
        crime_last_updated: new Date().toISOString().split('T')[0],
      }).eq('postcode_district', district)

      processed++
      logger.debug({ district, crimes: crimes.length, crimeRate }, 'police: district processed')

    } catch (err) {
      logger.error({ district, err: err.message }, 'police: district failed')
      failed++
    }

    // Rate limit: strictly one request per 600ms
    await sleep(RATE_LIMIT_MS)
  }

  return { processed, failed }
}
```

### 8.4 — Add ingest routes for property layer

Add to `backend/src/routes/ingest.js`:

```js
import { ingestLandRegistryYear, refreshPropertyStats } from '../services/landRegistry.js'
import { ingestCrimeDataBatch } from '../services/policeApi.js'

// POST /api/v1/ingest/land-registry
router.post('/land-registry', async (req, res, next) => {
  try {
    const currentYear = new Date().getFullYear()
    // Import last 3 years
    const results = []
    for (const year of [currentYear, currentYear - 1, currentYear - 2]) {
      const result = await ingestLandRegistryYear(year)
      results.push(result)
    }
    await refreshPropertyStats()
    res.json({ years: results })
  } catch (err) {
    next(err)
  }
})

// POST /api/v1/ingest/crime
router.post('/crime', async (req, res, next) => {
  try {
    // Get 100 districts that haven't been updated recently
    const { data: districts } = await db
      .from('postcode_areas')
      .select('postcode_district')
      .or('crime_last_updated.is.null,crime_last_updated.lt.' + new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .not('lat', 'is', null)
      .limit(100)

    const result = await ingestCrimeDataBatch(districts.map(d => d.postcode_district))
    res.json(result)
  } catch (err) {
    next(err)
  }
})

// POST /api/v1/ingest/family-scores
// Recalculates family scores for all districts with complete data
router.post('/family-scores', async (req, res, next) => {
  try {
    const { data: districts } = await db
      .from('postcode_areas')
      .select('postcode_district')
      .not('nursery_count_total', 'is', null)

    let calculated = 0
    for (const { postcode_district } of districts) {
      await db.rpc('calculate_family_score', { district: postcode_district })
      calculated++
    }

    res.json({ calculated })
  } catch (err) {
    next(err)
  }
})
```

### 8.5 — Build area search API endpoint

Add to `backend/src/routes/areas.js`:

```js
// GET /api/v1/areas/family-search
router.get('/family-search', async (req, res, next) => {
  try {
    const {
      postcode,
      radius_km = 15,
      min_family_score,
      max_median_price,
      min_nursery_pct,
      sort = 'family_score',
    } = req.query

    if (!postcode) return res.status(400).json({ error: 'postcode required' })

    const { lat, lng } = await geocodePostcode(postcode)

    let query = db
      .from('postcode_areas')
      .select(`
        postcode_district, local_authority, region,
        family_score, family_score_breakdown,
        nursery_count_total, nursery_count_outstanding,
        nursery_outstanding_pct, crime_rate_per_1000,
        imd_decile, flood_risk_level, lat, lng
      `)
      .not('lat', 'is', null)

    if (min_family_score) query = query.gte('family_score', Number(min_family_score))
    if (min_nursery_pct) query = query.gte('nursery_outstanding_pct', Number(min_nursery_pct))

    const { data: areas, error } = await query

    if (error) throw error

    // Filter by radius and add distance
    const { geocodePostcode: geocode } = await import('../services/geocoding.js')
    const searchPoint = { lat, lng }

    const filtered = areas
      .map(area => {
        const dist = haversineKm(searchPoint.lat, searchPoint.lng, area.lat, area.lng)
        return { ...area, distance_km: dist }
      })
      .filter(area => area.distance_km <= Number(radius_km))
      .sort((a, b) => {
        if (sort === 'family_score') return (b.family_score || 0) - (a.family_score || 0)
        if (sort === 'nursery_score') return (b.nursery_outstanding_pct || 0) - (a.nursery_outstanding_pct || 0)
        return a.distance_km - b.distance_km
      })

    res.json({ data: filtered, meta: { total: filtered.length, search_lat: lat, search_lng: lng } })
  } catch (err) {
    next(err)
  }
})

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat/2) ** 2 +
    Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLng/2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}
```

### 8.6 — Build area search frontend page

Create `app/find-an-area/page.tsx`:

Layout matching the panel spec:
- Left panel: filters (postcode anchor, radius, min family score slider, min nursery %, max price)
- Right panel: toggle map/list
- Map: area polygons or circles coloured by family score (green=high, red=low)
- List: AreaCard components

Create `components/AreaCard.tsx`:
- Postcode district (large)
- Family Score gauge (circular, coloured)
- Nursery quality %
- Crime level badge
- Flood risk badge
- Average property price
- "View area" link → /nurseries-in/[district]

Update homepage to show two paths:
- "Find a nursery near me" (existing)
- "Find an area to move to" (new → /find-an-area)

### 8.7 — Add to worker cron jobs

```js
// Monthly: refresh Land Registry data (1st of month, 1am)
cron.schedule('0 1 1 * *', async () => {
  logger.info('cron: refreshing Land Registry data')
  try {
    const currentYear = new Date().getFullYear()
    await ingestLandRegistryYear(currentYear)
    await refreshPropertyStats()
  } catch (err) {
    logger.error({ err: err.message }, 'cron: Land Registry refresh failed')
  }
})

// Nightly: 100 districts of crime data (takes ~1 hour)
cron.schedule('0 1 * * *', async () => {
  logger.info('cron: refreshing crime data batch')
  // (call ingest/crime endpoint internally)
})

// Nightly: recalculate family scores for districts updated today
cron.schedule('0 5 * * *', async () => {
  logger.info('cron: recalculating family scores')
  // (call ingest/family-scores endpoint)
})
```

### 8.8 — Commit

```bash
git add -A
git commit -m "feat: phase 8 — property layer, crime data, family score, area search"
git push origin main
```

### 8.9 — Tell Byron what to do next

```
✅ Phase 8 complete! NurseryFinder is now a family relocation platform.

Parents can now:
- Find nurseries near them (original product)
- Search areas by Family Score (new)
- See property price trends by district
- See crime data and flood risk
- Compare areas side by side

Monetisation is now clear:
1. Nursery enhanced listings (nurseries pay to claim + add photos/fees)
2. Rightmove/Zoopla affiliate deal (you now have traffic to show them)
3. Mortgage broker referrals from the "find an area" feature
4. Conveyancer referrals for movers

Next actions:
1. Press outreach — "only site that combines nursery Ofsted data with area safety scores"
2. Approach Rightmove/Zoopla with your traffic data for affiliate deal
3. Email nurseries with Outstanding grade offering free enhanced listings
4. Submit to Product Hunt

You've built the full product. Well done.
```
