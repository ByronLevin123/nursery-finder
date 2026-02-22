# Phase 3 — Backend API

**Paste into Claude Code:** `Read phases/PHASE_3_BACKEND.md and execute it`

---

## What this phase does

Builds the complete Express API including Ofsted data ingestion, bulk geocoding,
nursery search, and all supporting middleware. Two entry points: API server and
worker (cron jobs run separately). Takes 2–3 hours.

---

## Tasks

### 3.1 — Initialise backend

```bash
cd backend
npm init -y
npm install express @supabase/supabase-js axios cheerio csv-parser \
  cors dotenv helmet express-rate-limit express-basic-auth \
  node-cache pino pino-http @sentry/node node-cron nodemailer
npm install -D nodemon
```

Update package.json scripts:
```json
{
  "scripts": {
    "start": "node src/index.js",
    "dev": "nodemon src/index.js",
    "worker": "node src/worker.js",
    "worker:dev": "nodemon src/worker.js"
  },
  "type": "module"
}
```

### 3.2 — Create backend/src/db.js

```js
// Supabase client — used by all services
// Uses service key for backend operations (bypasses Row Level Security)

import { createClient } from '@supabase/supabase-js'

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in environment')
}

const db = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  {
    auth: { persistSession: false },
    db: { schema: 'public' },
  }
)

export default db
```

### 3.3 — Create backend/src/services/cache.js

```js
// In-memory cache for search results and geocoding
// Saves repeated PostGIS queries for the same search

import NodeCache from 'node-cache'

// Search results: 1 hour TTL
export const searchCache = new NodeCache({ stdTTL: 3600, checkperiod: 600 })

// Postcode geocoding: 24 hour TTL (postcodes don't change)
export const geocodeCache = new NodeCache({ stdTTL: 86400, checkperiod: 3600 })

export function searchCacheKey(params) {
  const { postcode, radiusKm, grade, funded2yr, funded3yr } = params
  return `search:${postcode}:${radiusKm}:${grade || 'any'}:${funded2yr}:${funded3yr}`
}
```

### 3.4 — Create backend/src/services/geocoding.js

```js
// Geocoding service using Postcodes.io
// Uses BULK endpoint — 100 postcodes per request, free, no API key

import axios from 'axios'
import { geocodeCache } from './cache.js'
import db from '../db.js'
import { logger } from '../logger.js'

const POSTCODES_IO_BULK = 'https://api.postcodes.io/postcodes'
const BATCH_SIZE = 100
const BATCH_DELAY_MS = 500

// Geocode a single postcode (for search queries — uses cache)
export async function geocodePostcode(postcode) {
  const cleaned = postcode.trim().toUpperCase().replace(/\s+/g, ' ')
  const cached = geocodeCache.get(cleaned)
  if (cached) return cached

  const response = await axios.get(`${POSTCODES_IO_BULK}/${encodeURIComponent(cleaned)}`)

  if (response.data.status !== 200 || !response.data.result) {
    throw new Error(`Postcode not found: ${postcode}`)
  }

  const { latitude, longitude } = response.data.result
  const result = { lat: latitude, lng: longitude }
  geocodeCache.set(cleaned, result)
  return result
}

// Bulk geocode nurseries with null location — run nightly
export async function geocodeNurseriesBatch(limit = 500) {
  const { data: nurseries, error } = await db
    .from('nurseries')
    .select('id, postcode')
    .eq('registration_status', 'Active')
    .is('lat', null)
    .not('postcode', 'is', null)
    .limit(limit)

  if (error) throw error
  if (!nurseries?.length) {
    logger.info('geocoding: no nurseries to geocode')
    return { geocoded: 0, failed: 0 }
  }

  logger.info({ count: nurseries.length }, 'geocoding: starting batch')

  // Split into chunks of BATCH_SIZE
  const chunks = []
  for (let i = 0; i < nurseries.length; i += BATCH_SIZE) {
    chunks.push(nurseries.slice(i, i + BATCH_SIZE))
  }

  let totalGeocoded = 0
  let totalFailed = 0

  for (const chunk of chunks) {
    const postcodes = chunk.map(n => n.postcode)

    try {
      // Bulk request — one call for 100 postcodes
      const response = await axios.post(POSTCODES_IO_BULK, { postcodes })
      const results = response.data.result

      const updates = []
      for (const result of results) {
        if (result.result) {
          updates.push({
            id: chunk.find(n => n.postcode === result.query)?.id,
            lat: result.result.latitude,
            lng: result.result.longitude,
          })
        } else {
          totalFailed++
          logger.warn({ postcode: result.query }, 'geocoding: postcode not found')
        }
      }

      // Bulk update in one DB call
      for (const update of updates) {
        if (update.id) {
          await db
            .from('nurseries')
            .update({ lat: update.lat, lng: update.lng })
            .eq('id', update.id)
          totalGeocoded++
        }
      }

      logger.info({ geocoded: totalGeocoded }, 'geocoding: chunk complete')

    } catch (err) {
      logger.error({ err: err.message }, 'geocoding: chunk failed')
      totalFailed += chunk.length
    }

    // Respect Postcodes.io rate limits
    await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS))
  }

  return { geocoded: totalGeocoded, failed: totalFailed }
}
```

### 3.5 — Create backend/src/services/ofstedIngest.js

```js
// Ofsted Early Years Register ingestion
// The CSV filename changes monthly — we scrape the page to find the current link

import axios from 'axios'
import * as cheerio from 'cheerio'
import csv from 'csv-parser'
import { Readable } from 'stream'
import db from '../db.js'
import { logger } from '../logger.js'

const OFSTED_PAGE_URL =
  'https://www.gov.uk/government/statistical-data-sets/monthly-management-information-ofsteds-early-years-register'

const BATCH_SIZE = 200

// Parse Ofsted date format: DD/MM/YYYY → YYYY-MM-DD
function parseOfstedDate(str) {
  if (!str?.trim()) return null
  const [d, m, y] = str.trim().split('/')
  if (!d || !m || !y) return null
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

// Scrape the GOV.UK page to find the current CSV download URL
async function findCurrentCsvUrl() {
  logger.info('ofsted: fetching register page to find current CSV URL')
  const { data: html } = await axios.get(OFSTED_PAGE_URL, {
    headers: { 'User-Agent': 'NurseryFinder/1.0 (data@nurseryfinder.co.uk)' }
  })
  const $ = cheerio.load(html)

  // Find CSV download links on the page
  let csvUrl = null
  $('a[href$=".csv"], a[href*=".csv"]').each((_, el) => {
    const href = $(el).attr('href')
    if (href && href.toLowerCase().includes('early_year')) {
      // Take the first (most recent) early years CSV link
      if (!csvUrl) {
        csvUrl = href.startsWith('http') ? href : `https://www.gov.uk${href}`
      }
    }
  })

  if (!csvUrl) {
    throw new Error('Could not find Early Years Register CSV on GOV.UK page. Check the page manually.')
  }

  logger.info({ csvUrl }, 'ofsted: found CSV URL')
  return csvUrl
}

// Map one CSV row to our schema
function mapRow(row) {
  const grade = row['Overall Effectiveness']?.trim() || null
  // Only include valid Ofsted grades
  const validGrades = ['Outstanding', 'Good', 'Requires Improvement', 'Inadequate']

  return {
    urn: row['URN']?.trim(),
    name: row['Provider Name']?.trim(),
    provider_type: row['Provider Type']?.trim(),
    registration_status: row['Registration Status']?.trim(),
    address_line1: row['Address 1']?.trim() || null,
    address_line2: row['Address 2']?.trim() || null,
    town: row['Town']?.trim() || null,
    postcode: row['Postcode']?.trim().toUpperCase() || null,
    local_authority: row['Local Authority']?.trim() || null,
    region: row['Region']?.trim() || null,
    phone: row['Telephone Number']?.trim() || null,
    email: row['Email Address']?.trim() || null,
    ofsted_overall_grade: validGrades.includes(grade) ? grade : null,
    last_inspection_date: parseOfstedDate(row['Inspection Date']),
    inspection_report_url: row['Web Link']?.trim() || null,
    enforcement_notice: !!(row['Action']?.trim()),
    total_places: parseInt(row['Registered places']) || null,
    places_funded_2yr: parseInt(row['Places Funded 2yr']) || null,
    places_funded_3_4yr: parseInt(row['Places Funded 3 or 4yr']) || null,
  }
}

export async function ingestOfstedRegister() {
  const startTime = Date.now()
  let imported = 0
  let skipped = 0
  let errors = 0

  // Step 1: Find the current CSV URL
  const csvUrl = await findCurrentCsvUrl()

  // Step 2: Download CSV
  logger.info({ csvUrl }, 'ofsted: downloading CSV')
  const response = await axios.get(csvUrl, {
    responseType: 'arraybuffer',
    headers: { 'User-Agent': 'NurseryFinder/1.0 (data@nurseryfinder.co.uk)' }
  })

  // Step 3: Parse CSV
  const records = []
  await new Promise((resolve, reject) => {
    Readable.from(Buffer.from(response.data).toString('utf-8'))
      .pipe(csv())
      .on('data', row => {
        // Only import Active providers to save space
        if (row['Registration Status']?.trim() === 'Active') {
          const mapped = mapRow(row)
          if (mapped.urn) records.push(mapped)
        } else {
          skipped++
        }
      })
      .on('end', resolve)
      .on('error', reject)
  })

  logger.info({ total: records.length, skipped }, 'ofsted: CSV parsed, starting upsert')

  // Step 4: Upsert in batches
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE)
    const { error } = await db
      .from('nurseries')
      .upsert(batch, {
        onConflict: 'urn',
        ignoreDuplicates: false,
      })

    if (error) {
      logger.error({ error: error.message, batchStart: i }, 'ofsted: batch upsert failed')
      errors += batch.length
    } else {
      imported += batch.length
    }

    if (i % 2000 === 0) {
      logger.info({ imported, remaining: records.length - i }, 'ofsted: progress')
    }
  }

  const duration = Date.now() - startTime
  logger.info({ imported, skipped, errors, duration_ms: duration }, 'ofsted: ingest complete')
  return { imported, skipped, errors, duration_ms: duration }
}
```

### 3.6 — Create backend/src/logger.js

```js
import pino from 'pino'

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  ...(process.env.NODE_ENV !== 'production' && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true }
    }
  })
})
```

### 3.7 — Create backend/src/middleware/auth.js

```js
import basicAuth from 'express-basic-auth'

// Protect admin and ingest routes with HTTP Basic Auth
export const adminAuth = basicAuth({
  users: {
    [process.env.ADMIN_USER || 'admin']: process.env.ADMIN_PASS || 'changeme'
  },
  challenge: true,
  realm: 'NurseryFinder Admin',
})
```

### 3.8 — Create backend/src/middleware/errorHandler.js

```js
import { logger } from '../logger.js'

export function errorHandler(err, req, res, next) {
  logger.error({ err: err.message, path: req.path, method: req.method }, 'unhandled error')

  const status = err.status || err.statusCode || 500
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : err.message

  res.status(status).json({ error: message, status })
}

export function notFound(req, res) {
  res.status(404).json({ error: 'Not found', status: 404 })
}
```

### 3.9 — Create backend/src/routes/health.js

```js
import express from 'express'
import db from '../db.js'

const router = express.Router()

router.get('/', async (req, res) => {
  try {
    // Quick DB check
    const { count } = await db
      .from('nurseries')
      .select('*', { count: 'exact', head: true })
      .eq('registration_status', 'Active')

    const { count: geocoded } = await db
      .from('nurseries')
      .select('*', { count: 'exact', head: true })
      .eq('registration_status', 'Active')
      .not('lat', 'is', null)

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      database: 'connected',
      nursery_count: count,
      geocoded_count: geocoded,
    })
  } catch (err) {
    res.status(503).json({ status: 'error', error: err.message })
  }
})

export default router
```

### 3.10 — Create backend/src/routes/nurseries.js

```js
import express from 'express'
import db from '../db.js'
import { geocodePostcode } from '../services/geocoding.js'
import { searchCache, searchCacheKey } from '../services/cache.js'
import { logger } from '../logger.js'

const router = express.Router()

// POST /api/v1/nurseries/search
// Body: { postcode, radius_km, grade, funded_2yr, funded_3yr, page, limit }
router.post('/search', async (req, res, next) => {
  try {
    const {
      postcode,
      radius_km = 5,
      grade = null,
      funded_2yr = false,
      funded_3yr = false,
      page = 1,
      limit = 20,
    } = req.body

    if (!postcode) {
      return res.status(400).json({ error: 'postcode is required' })
    }

    // UK postcode validation
    const postcodeRegex = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i
    if (!postcodeRegex.test(postcode.trim())) {
      return res.status(400).json({ error: 'Invalid UK postcode format' })
    }

    // Check cache first
    const cacheKey = searchCacheKey({ postcode, radiusKm: radius_km, grade, funded2yr: funded_2yr, funded3yr: funded_3yr })
    const cached = searchCache.get(cacheKey)
    if (cached) {
      return res.json({ ...cached, cached: true })
    }

    // Geocode postcode
    const { lat, lng } = await geocodePostcode(postcode)

    // Call PostGIS stored function
    const { data, error } = await db.rpc('search_nurseries_near', {
      search_lat: lat,
      search_lng: lng,
      radius_km: Number(radius_km),
      grade_filter: grade || null,
      funded_2yr: Boolean(funded_2yr),
      funded_3yr: Boolean(funded_3yr),
    })

    if (error) throw error

    // Paginate in JS (PostGIS returns max 100)
    const pageNum = Math.max(1, Number(page))
    const limitNum = Math.min(50, Math.max(1, Number(limit)))
    const start = (pageNum - 1) * limitNum
    const paginated = data.slice(start, start + limitNum)

    const result = {
      data: paginated,
      meta: {
        total: data.length,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(data.length / limitNum),
        search_lat: lat,
        search_lng: lng,
      }
    }

    searchCache.set(cacheKey, result)
    logger.info({ postcode, radius_km, results: data.length }, 'search completed')
    res.json(result)

  } catch (err) {
    if (err.message?.includes('not found')) {
      return res.status(404).json({ error: 'Postcode not found' })
    }
    next(err)
  }
})

// GET /api/v1/nurseries/:urn
router.get('/:urn', async (req, res, next) => {
  try {
    const { data, error } = await db
      .from('nurseries')
      .select('*')
      .eq('urn', req.params.urn)
      .single()

    if (error || !data) {
      return res.status(404).json({ error: 'Nursery not found' })
    }

    res.json(data)
  } catch (err) {
    next(err)
  }
})

// POST /api/v1/nurseries/compare — must be before /:urn route
router.post('/compare', async (req, res, next) => {
  try {
    const { urns } = req.body
    if (!Array.isArray(urns) || urns.length < 2 || urns.length > 5) {
      return res.status(400).json({ error: 'Provide 2–5 URNs to compare' })
    }

    const { data, error } = await db
      .from('nurseries')
      .select('*')
      .in('urn', urns)

    if (error) throw error
    res.json({ data })
  } catch (err) {
    next(err)
  }
})

// POST /api/v1/nurseries/fees — submit anonymous fee
router.post('/fees', async (req, res, next) => {
  try {
    const { nursery_id, fee_per_month, hours_per_week, age_group } = req.body

    if (!nursery_id || !fee_per_month) {
      return res.status(400).json({ error: 'nursery_id and fee_per_month required' })
    }
    if (fee_per_month < 100 || fee_per_month > 5000) {
      return res.status(400).json({ error: 'fee_per_month must be between 100 and 5000' })
    }

    const { error } = await db.from('nursery_fees').insert({
      nursery_id, fee_per_month, hours_per_week, age_group
    })

    if (error) throw error

    // Refresh aggregate on nursery
    const { data: fees } = await db
      .from('nursery_fees')
      .select('fee_per_month')
      .eq('nursery_id', nursery_id)

    if (fees?.length >= 3) {
      const avg = Math.round(fees.reduce((s, f) => s + f.fee_per_month, 0) / fees.length)
      await db.from('nurseries').update({
        fee_avg_monthly: avg,
        fee_report_count: fees.length
      }).eq('id', nursery_id)
    }

    res.json({ success: true, message: 'Fee submitted anonymously. Thank you!' })
  } catch (err) {
    next(err)
  }
})

export default router
```

### 3.11 — Create backend/src/routes/ingest.js

```js
import express from 'express'
import { ingestOfstedRegister } from '../services/ofstedIngest.js'
import { geocodeNurseriesBatch } from '../services/geocoding.js'
import { adminAuth } from '../middleware/auth.js'
import { logger } from '../logger.js'

const router = express.Router()

// All ingest routes require admin auth
router.use(adminAuth)

// POST /api/v1/ingest/ofsted
router.post('/ofsted', async (req, res, next) => {
  try {
    logger.info('ingest: starting Ofsted register import')
    const result = await ingestOfstedRegister()
    res.json(result)
  } catch (err) {
    logger.error({ err: err.message }, 'ingest: Ofsted import failed')
    next(err)
  }
})

// POST /api/v1/ingest/geocode
router.post('/geocode', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 500
    logger.info({ limit }, 'ingest: starting geocoding batch')
    const result = await geocodeNurseriesBatch(limit)
    res.json(result)
  } catch (err) {
    logger.error({ err: err.message }, 'ingest: geocoding failed')
    next(err)
  }
})

export default router
```

### 3.12 — Create backend/src/app.js

```js
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import pinoHttp from 'pino-http'
import { logger } from './logger.js'
import { errorHandler, notFound } from './middleware/errorHandler.js'
import healthRouter from './routes/health.js'
import nurseriesRouter from './routes/nurseries.js'
import ingestRouter from './routes/ingest.js'

const app = express()

// Security
app.use(helmet())
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST'],
}))

// Request logging
app.use(pinoHttp({ logger }))

// Rate limiting — public endpoints
app.use('/api/v1/nurseries', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later' }
}))

// Body parsing
app.use(express.json({ limit: '1mb' }))

// Routes
app.use('/api/v1/health', healthRouter)
app.use('/api/v1/nurseries', nurseriesRouter)
app.use('/api/v1/ingest', ingestRouter)

// 404 + error handling
app.use(notFound)
app.use(errorHandler)

export default app
```

### 3.13 — Create backend/src/index.js

```js
import 'dotenv/config'
import app from './app.js'
import { logger } from './logger.js'

const PORT = process.env.PORT || 3001

app.listen(PORT, () => {
  logger.info({ port: PORT, env: process.env.NODE_ENV }, 'NurseryFinder API started')
})
```

### 3.14 — Create backend/src/worker.js (separate cron process)

```js
import 'dotenv/config'
import cron from 'node-cron'
import { ingestOfstedRegister } from './services/ofstedIngest.js'
import { geocodeNurseriesBatch } from './services/geocoding.js'
import { logger } from './logger.js'

logger.info('NurseryFinder worker started')

// Geocode 500 nurseries every night at 3am
cron.schedule('0 3 * * *', async () => {
  logger.info('cron: starting nightly geocoding batch')
  try {
    const result = await geocodeNurseriesBatch(500)
    logger.info(result, 'cron: geocoding complete')
  } catch (err) {
    logger.error({ err: err.message }, 'cron: geocoding failed')
  }
})

// Re-sync Ofsted data on 1st of every month at 2am
cron.schedule('0 2 1 * *', async () => {
  logger.info('cron: starting monthly Ofsted sync')
  try {
    const result = await ingestOfstedRegister()
    logger.info(result, 'cron: Ofsted sync complete')
  } catch (err) {
    logger.error({ err: err.message }, 'cron: Ofsted sync failed')
  }
})
```

### 3.15 — Create backend/.env from example

Tell Byron:

```
Before starting the API, create your .env file:
1. Copy backend/.env.example to backend/.env
2. Fill in your Supabase values:
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_KEY=your-service-role-key
3. Set ADMIN_USER and ADMIN_PASS to something you'll remember
4. Leave SENTRY_DSN blank for now (add it after creating a free Sentry account)
```

### 3.16 — Test the API

```bash
cd backend
npm run dev
```

In a second terminal, test these endpoints:

```bash
# Health check
curl http://localhost:3001/api/v1/health

# Nursery search
curl -X POST http://localhost:3001/api/v1/nurseries/search \
  -H "Content-Type: application/json" \
  -d '{"postcode": "SW1A 1AA", "radius_km": 2}'

# Trigger geocoding (with admin credentials)
curl -X POST http://localhost:3001/api/v1/ingest/geocode \
  -u "admin:your-password"
```

### 3.17 — Commit

```bash
git add -A
git commit -m "feat: phase 3 — Express API with Ofsted ingestion and bulk geocoding"
```

### 3.18 — Tell Byron what to do next

```
✅ Phase 3 complete!

Your API is running at http://localhost:3001

Key endpoints:
- GET  /api/v1/health                    → database status
- POST /api/v1/nurseries/search          → search by postcode
- GET  /api/v1/nurseries/:urn            → single nursery
- POST /api/v1/ingest/ofsted             → import Ofsted data (admin)
- POST /api/v1/ingest/geocode            → geocode batch (admin)

Next: Build the frontend.
→ Type: Read phases/PHASE_4_FRONTEND.md and execute it
```
