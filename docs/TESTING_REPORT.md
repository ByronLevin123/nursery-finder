# NurseryMatch — Comprehensive Testing Report

**Date:** 2026-05-24
**Scope:** Unit, functional, security, performance, infrastructure audit

---

## 1. Test Suite Results

### Backend (50 files, 401 tests)
| Check | Result |
|-------|--------|
| Unit tests | **401 passed, 0 failed** |
| ESLint | 0 errors, 18 warnings (all unused variables) |
| Prettier | 7 files need formatting |
| npm audit | 20 vulnerabilities (15 moderate, 5 high) — all in transitive dependencies (`uuid` in `node-cron`, `ws`) |

### Frontend (15 files, 117 tests)
| Check | Result |
|-------|--------|
| Unit tests | **117 passed, 0 failed** |
| Next.js lint | 0 errors, 10 warnings (React Hook dependency arrays) |
| TypeScript typecheck | **0 errors** |
| Production build | **Compiles successfully** |
| npm audit | 20 vulnerabilities (same `uuid`/`ws` tree) |

### Verdict: All tests pass. No blocking issues.

---

## 2. Security Audit

### 2a. Secrets Scan
| Finding | Severity | Status |
|---------|----------|--------|
| No hardcoded API keys or secrets in source code | N/A | Clean |
| `frontend/.env.production` tracked in git (Supabase anon key, Google Maps key) | Low | These are public keys, but best practice is to not track env files |
| Admin credentials shared in chat session | **High** | Change `ADMIN_PASS` on Render immediately |

### 2b. Authentication & Authorization
| Check | Status |
|-------|--------|
| Admin routes protected by `requireRole('admin')` at router level | Secure |
| Ingest routes protected by basicAuth + admin fallback | Secure |
| Write endpoints require `requireAuth` or `requireVerifiedEmail` | Secure |
| Provider endpoints check subscription tier + nursery ownership | Secure |
| Turnstile CAPTCHA on enquiry form (graceful degradation) | Secure |
| Login lockout: 5 failures in 15min per email | Secure |

### 2c. Input Validation & Injection
| Check | Status |
|-------|--------|
| Supabase client uses parameterized queries throughout | No SQL injection risk |
| `dangerouslySetInnerHTML` — 23 uses, all for JSON-LD schemas and server-rendered markdown | Safe — no user input flows in |
| Review validation: rating 1-5, title 3-120 chars, body 20-4000 chars | Properly constrained |
| Body parser limit: 8MB (for base64 photo uploads) | Acceptable |

### 2d. CORS & Headers
| Check | Status |
|-------|--------|
| Helmet security headers (HSTS, X-Frame-Options DENY, nosniff, XSS protection) | Configured |
| Public API endpoints: open CORS (`origin: '*'`) for LLM/GPT access | By design |
| Authenticated endpoints: restricted to allowlisted origins | Configured |
| `FRONTEND_URL` required for CORS — **must be set on Render** | Action needed |
| CSP configured in `frontend/vercel.json` with allowlisted domains | Configured |

### 2e. Rate Limiting
| Endpoint | Limit |
|----------|-------|
| Public API (search, areas, properties) | 300 req / 15 min per IP |
| Review submissions | Custom limiter |
| Provider auth/registration | Custom limiter |
| Assistant/AI endpoints | Custom limiter |

### Verdict: Security posture is strong. Two actions needed: change admin password, remove `.env.production` from git tracking.

---

## 3. Functional Analysis (Code Review)

### 3a. Search Flow
- **Architecture:** Frontend → `POST /api/v1/nurseries/smart-search` → postcodes.io geocoding → Supabase RPC `search_nurseries_near` (PostGIS)
- **Known issue:** 0/26,600 nurseries are geocoded. Location-based search returns empty results.
- **Fix:** Run geocoding batch: `curl -X POST .../api/v1/ingest/geocode -u admin:pass`
- Autocomplete has a graceful fallback from RPC to ILIKE when trigram extension unavailable

### 3b. Auth Flow
- **Architecture:** Supabase Auth → JWT → `SessionProvider.tsx` fetches role from `GET /api/v1/profile`
- **Known issue:** If `NEXT_PUBLIC_API_URL` not set on Vercel, all API calls fail silently. Role defaults to 'customer', blocking admin access.
- **Fix:** Set `NEXT_PUBLIC_API_URL=https://nursery-finder-6u7r.onrender.com` on Vercel

### 3c. Admin Dashboard
- Protected at router level: `router.use(requireRole('admin'))`
- User role confirmed as 'admin' in database
- Dashboard functional once API URL is configured

### 3d. Billing (Stripe)
- Webhook endpoint registered before JSON body parser (correct for signature verification)
- Stripe keys not yet configured (billing features inactive until set)

### 3e. Data Integrity
- All tables recreated via combined migration
- Nursery data intact (26,600 records)
- User-generated data lost (profiles, reviews, enquiries, claims, promotions)
- `_migration_guard` table created to prevent future accidental destructive migrations

---

## 4. Performance Analysis

### 4a. Frontend Bundle Sizes
| Page | First Load JS | Assessment |
|------|--------------|------------|
| Homepage | 168 kB | Good |
| Search | 169 kB | Good |
| Nursery profile | 181 kB | Good |
| Provider reports | **256 kB** | Largest page — monitor |
| Quiz | 153 kB | Good |
| Admin pages | 130-155 kB | Good |
| Shared JS (all pages) | 84.6 kB | Good |

No pages exceed 300kB. Provider reports (256kB) is the largest — likely due to charting library.

### 4b. Backend Caching
- Cache-Control headers properly configured:
  - Search: 5 min
  - Nursery detail: 1 hour
  - Area data: 1 hour
  - Billing tiers: 1 day
- In-memory cache (node-cache) active for geocoding, nursery data

### 4c. Database Performance
- PostGIS GIST indexes on `nurseries.location` and `schools.location`
- Partial indexes on `registration_status = 'Active' AND location IS NOT NULL`
- Two-stage PostGIS queries (bounding box then exact distance) in search RPC
- Trigram indexes (pg_trgm) on `nurseries.name` and `nurseries.town` for fuzzy search

### Verdict: Performance foundations are solid. No immediate concerns.

---

## 5. Dependency Audit Summary

### Vulnerabilities Found (both frontend and backend share similar tree)
| Package | Severity | Issue | Fix Available |
|---------|----------|-------|---------------|
| `uuid` (via `node-cron`) | Moderate | Predictable UUIDs | Yes — `npm audit fix --force` (breaking) |
| `ws` | Moderate | Uninitialized memory disclosure | Yes — `npm audit fix` |

### Recommendation
Run `npm audit fix` in both directories for non-breaking fixes. The `node-cron` vulnerability requires a major version bump — test in staging first.

---

## 6. Outstanding Launch Actions

### CRITICAL (Must Do Before Launch)
| # | Action | Status |
|---|--------|--------|
| 1 | `NEXT_PUBLIC_API_URL` on Vercel | **NOT SET** — breaks all frontend API calls |
| 2 | `FRONTEND_URL` on Render | **NOT SET** — breaks CORS for authenticated requests |
| 3 | Geocode nurseries | **0/26,600 geocoded** — search by location broken |
| 4 | Sentry DSN (backend + frontend) | NOT SET |
| 5 | Stripe live keys + webhook | NOT SET |
| 6 | Plausible domain on Vercel | NOT SET |
| 7 | Change ADMIN_PASS on Render | Credentials exposed in chat |

### HIGH PRIORITY
| # | Action | Why |
|---|--------|-----|
| 8 | Supabase Pro upgrade ($25/mo) | Free tier pauses after 7 days inactive |
| 9 | Enable Supabase backups | **Critical after data loss incident** |
| 10 | Render Starter upgrade ($7/mo) | Eliminates cold starts |
| 11 | Supabase Auth redirect URLs | Auth won't work without nurserymatch.com in allowlist |
| 12 | UptimeRobot monitoring | 5-min health check |
| 13 | Google Search Console sitemap | Submit nurserymatch.com/sitemap.xml |

### MEDIUM PRIORITY
| # | Action | Why |
|---|--------|-----|
| 14 | Add Turnstile keys to Vercel/Render | Keys obtained, need to add to dashboards |
| 15 | Add Resend API key to Render | Key obtained |
| 16 | Supabase connection pooling (Supavisor) | Prevents exhaustion under load |
| 17 | Render background worker service | Cron jobs (emails, digests, Ofsted sync) |
| 18 | Legal review + ICO registration | See LAUNCH_CHECKLIST.md |

---

## 7. Infrastructure Robustness Recommendations

### 7a. Database Backup Strategy
1. **Immediately:** Upgrade Supabase to Pro → enables daily automatic backups (7-day retention)
2. **Enable PITR** (Point-in-Time Recovery) — restore to any second within retention window
3. **Monthly:** Manual backup exports via Supabase dashboard
4. **Document** restore procedure in `docs/INCIDENT_RESPONSE.md`

### 7b. Migration Safety (Prevent Future Data Loss)
1. Never put `DROP TABLE` for data tables in combined migration scripts
2. Use `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for schema changes on existing tables
3. The `_migration_guard` table (migration 036) should be checked before any destructive operation
4. **Always test migrations on a staging Supabase project before running on production**
5. Add a warning banner to `COMBINED_MIGRATION.sql`: "This drops ALL tables — only for fresh databases"

### 7c. Dev/Staging/Prod Separation

| Environment | Supabase | Backend | Frontend |
|-------------|----------|---------|----------|
| **Development** | Separate free project | localhost:3001 | localhost:3000 |
| **Staging** | Separate free project | Render preview | Vercel preview |
| **Production** | Pro plan (with PITR) | Render Starter | Vercel production |

**Workflow:** Code changes → test locally (dev) → push branch → preview deploys (staging) → merge to main → production deploys automatically.

### 7d. Monitoring Stack
| Tool | Purpose | Cost |
|------|---------|------|
| UptimeRobot | Uptime monitoring (5-min interval) | Free |
| Sentry | Error tracking + alerts | Free tier |
| Render metrics | CPU/memory/latency | Included |
| Supabase dashboard | DB health, connections, query stats | Included |
| Plausible | User analytics | ~$9/mo |

### 7e. Security Hardening
1. Remove `frontend/.env.production` from git: `git rm --cached frontend/.env.production`
2. Change admin password on Render immediately
3. Set up Sentry to catch production errors
4. Consider adding `npm audit` to CI pipeline as a non-blocking check

---

## 8. Summary

| Category | Grade | Notes |
|----------|-------|-------|
| Unit Tests | **A** | 518 tests (401 backend + 117 frontend), all passing |
| Type Safety | **A** | TypeScript strict mode, 0 errors |
| Build Health | **A** | Frontend compiles, no SSR errors |
| Security | **A-** | Strong auth/CORS/rate limiting; change exposed admin password |
| Performance | **A** | No oversized bundles, proper caching, PostGIS indexes |
| Infrastructure | **C** | No backups, no staging env, env vars missing in production |
| Data Integrity | **D** | User data lost, 0 geocoded nurseries, broken search |

**Top 3 Actions Right Now:**
1. Set `NEXT_PUBLIC_API_URL` and `FRONTEND_URL` on Vercel/Render
2. Run geocoding batch to enable location search
3. Upgrade Supabase to Pro and enable backups
