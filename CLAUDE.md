# NurseryFinder — Master Project Context

> Claude Code reads this file at the start of every session.
> Never delete or rename this file.

---

## What we are building

**NurseryFinder** — a UK nursery comparison website that lets parents find and evaluate
Ofsted-rated nurseries near them. Phase 1 is a nursery search and profile product.
Phase 8 adds a family relocation layer (area intelligence + property prices).

**Live URL targets:**
- Frontend: Vercel (nursery-finder.vercel.app → custom domain later)
- Backend API: Railway (nursery-finder-api.railway.app)
- Database: Supabase (PostgreSQL + PostGIS)

---

## Tech stack (do not deviate from this)

| Layer | Technology | Why |
|-------|-----------|-----|
| Database | Supabase (PostgreSQL + PostGIS) | Geo queries, free tier, built-in auth |
| Backend | Node.js 20 + Express | Familiar, fast, good PostGIS client support |
| Frontend | Next.js 14 (App Router) | SSR/SSG for SEO — critical for nursery pages |
| Maps | Leaflet + react-leaflet | Free, no API key needed |
| Logging | pino + pino-http | Structured JSON logs for Railway |
| Error tracking | Sentry (free tier) | Error alerts without building custom tooling |
| Analytics | Plausible | GDPR-compliant, cookieless, no custom build needed |
| Auth (Phase 6) | Supabase Auth | Already in our stack, magic link login |
| Styling | Tailwind CSS | Utility-first, fast to build, good defaults |

---

## Project structure

```
nursery-finder/
├── CLAUDE.md                    ← you are here (read every session)
├── START_HERE.md                ← onboarding for Byron
├── phases/                      ← phase briefs (read before each phase)
│   ├── PHASE_0_SETUP.md
│   ├── PHASE_1_DATABASE.md
│   ├── PHASE_2_COMPLIANCE.md
│   ├── PHASE_3_BACKEND.md
│   ├── PHASE_4_FRONTEND.md
│   ├── PHASE_5_DEPLOY.md
│   ├── PHASE_6_V2.md
│   ├── PHASE_7_SEO.md
│   └── PHASE_8_PROPERTY.md
├── database/
│   └── migrations/              ← numbered SQL files, never edit old ones
│       └── 001_initial_schema.sql
├── backend/                     ← Express API
│   ├── src/
│   │   ├── index.js             ← API entry point
│   │   ├── worker.js            ← cron job entry point (separate process)
│   │   ├── db.js                ← Supabase client
│   │   ├── routes/
│   │   │   ├── nurseries.js
│   │   │   ├── ingest.js
│   │   │   ├── areas.js
│   │   │   └── health.js
│   │   ├── services/
│   │   │   ├── ofstedIngest.js
│   │   │   ├── geocoding.js
│   │   │   └── cache.js
│   │   └── middleware/
│   │       ├── auth.js
│   │       └── errorHandler.js
│   ├── .env.example
│   ├── package.json
│   └── Dockerfile
├── frontend/                    ← Next.js app
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx             ← homepage
│   │   ├── search/page.tsx
│   │   ├── nursery/[urn]/page.tsx
│   │   └── shortlist/page.tsx
│   ├── components/
│   ├── lib/
│   │   └── api.ts
│   ├── .env.example
│   └── package.json
└── scripts/
    ├── first-import.sh
    └── generate-sitemap.js
```

---

## Non-negotiable rules (always follow these)

### Code quality
- Every API route has a try/catch — no unhandled promise rejections
- All secrets in environment variables — never hardcode keys
- All backend routes prefixed `/api/v1/` — versioned from day one
- Use pino logger for every significant event (import start/end, errors, warnings)
- Run `npm install` after adding any dependency

### Database
- Never edit migration files after they are committed
- New schema changes = new numbered migration file (002, 003, etc.)
- Always use the generated `location` geometry column for geo queries — never ST_MakePoint inline in queries
- Partial index on active nurseries with location for all search queries

### Security
- `/api/v1/ingest/*` and `/admin` always protected by express-basic-auth
- Never log API keys or secrets
- Rate limit all public endpoints: 100 req/15min per IP

### Compliance (UK GDPR + OGL)
- OglAttribution component on every page that shows Ofsted data
- StaleGradeBanner on any nursery with inspection older than 4 years
- EnforcementBanner on any nursery with enforcement_notice = true
- Privacy page linked from every page footer
- No custom analytics — use Plausible script tag only

### Git
- Commit after every phase completes
- Commit message format: `feat: phase N — description`
- Never commit .env files (they are in .gitignore)

---

## Key external APIs (all free, no signup unless noted)

| API | Endpoint | Notes |
|-----|----------|-------|
| Postcodes.io geocoding (single) | GET https://api.postcodes.io/postcodes/{postcode} | Free, no key |
| Postcodes.io geocoding (bulk) | POST https://api.postcodes.io/postcodes | 100 per request, free, no key |
| Police crime data | https://data.police.uk/api/ | Free, no key, rate limit 1 req/500ms |
| Environment Agency flood | https://environment.data.gov.uk/flood-monitoring/ | Free, no key |
| Ofsted register | https://www.gov.uk/government/statistical-data-sets/monthly-management-information-ofsteds-early-years-register | CSV, scrape page for current link |
| Land Registry price paid | http://prod.publicdata.landregistry.gov.uk/pp-{year}.csv | Free, large files — stream only |
| Plausible analytics | https://plausible.io | £9/month, add script tag to Next.js |

---

## Environment variables reference

### Backend (.env)
```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...   # never expose this to frontend
PORT=3001
ADMIN_USER=admin
ADMIN_PASS=choose-a-strong-password
INGEST_SECRET=choose-a-random-string
SENTRY_DSN=https://xxx@sentry.io/xxx
ALERT_EMAIL=byron@youremail.com
NODE_ENV=development
```

### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

---

## Current build status

Update this section as phases complete:

- [x] Phase 0 — Setup complete
- [x] Phase 1 — Database schema created
- [x] Phase 2 — Compliance components built
- [x] Phase 3 — Backend API built
- [x] Phase 4 — Frontend built (4 screens)
- [x] Phase 5 — Deployment config created
- [x] Phase 6 — User accounts built
- [x] Phase 7 — SEO pages + sitemap built
- [x] Phase 8 — Property layer built

---

## Decision log (why we made certain choices)

| Decision | Reason |
|----------|--------|
| Next.js not Vite | Server-side rendering for nursery profile pages = SEO = free traffic |
| Leaflet not Google Maps | Free, no API key, no per-load billing |
| Plausible not custom analytics | GDPR compliant by design, saves building event pipeline |
| Postcodes.io bulk endpoint | 50k nurseries geocoded in 25 days vs 3 years with single calls |
| Generated geometry column | Correct PostGIS pattern — expression indexes on non-geometry columns don't work |
| Separate API + worker processes | Long-running imports must not block API response threads |
| Land Registry not Rightmove | Rightmove requires commercial contract. Land Registry is free and complete. |
| Supabase Auth (Phase 6) | Already in our stack — no extra service needed |
