# NurseryMatch — Complete Application Backlog & Roadmap

Last updated: 2026-06-28

---

## APPLICATION OVERVIEW

| Metric | Value |
|--------|-------|
| Backend routes | 43 modules, 10,186 LOC |
| Frontend pages | 67 pages, all functional |
| Database migrations | 60 numbered SQL files |
| Backend tests | 411 passing (100%) |
| Frontend tests | 117 passing (100%) |
| Backend services | 43 service modules |
| Cron jobs | 16 scheduled (all implemented) |
| Documentation files | 10 in /docs |
| Phases completed | All 8 original phases + extensions |

---

## DEPLOYMENT STATUS

All code on `main`, auto-deploys via Render (backend) + Vercel (frontend).
26 PRs merged this session (#49-#75).

---

## PHASE 0: CRITICAL — DO NOW

### Database Migrations (Supabase SQL Editor)
- [ ] Run `DROP FUNCTION search_nurseries_near(...)` then migration 058
- [ ] Run migration 055 (postcode_areas columns)
- [ ] Run migration 004 (refresh_postcode_area_nursery_stats function)
- [ ] Run migration 009 (calculate_all_family_scores function)
- [ ] Verify admin_reports_cache table exists

### Data Population (Admin > Data Ingest)
- [ ] Ofsted Import (27k+ nurseries + childminders)
- [ ] Geocode Nurseries (run 2-3x, 2000/batch)
- [ ] Schools Import (30k schools from GIAS)
- [ ] Geocode Schools (run 5-10x, 100/batch)
- [ ] Scotland import (paste CSV URL in admin panel)
- [ ] Wales import (download from careinspectorate.wales)
- [ ] Geocode again (for Scotland/Wales records)
- [ ] Aggregate Areas
- [ ] Family Scores
- [ ] Crime Data
- [ ] IMD Data
- [ ] Google Places Sync
- [ ] Snapshot Reports

### Environment Variables — Render (backend)
| Var | Priority | Status |
|-----|----------|--------|
| `SUPABASE_URL` | Required | Should be set |
| `SUPABASE_ANON_KEY` | Required | Should be set |
| `SUPABASE_SERVICE_KEY` | Required | Should be set |
| `ADMIN_USER` / `ADMIN_PASS` | Required | Should be set |
| `ANTHROPIC_API_KEY` | **Critical** | AI advisor broken without it |
| `SENTRY_DSN` | Set | Done |
| `RESEND_API_KEY` | Needed for emails | Set when ready |
| `RESEND_AUDIENCE_ID` | Newsletter | Set when ready |
| `STRIPE_SECRET_KEY` | Billing | Set when ready |
| `STRIPE_WEBHOOK_SECRET` | Billing | Set when ready |
| `GOOGLE_PLACES_API_KEY` | Photos/ratings | Set when ready |
| `BUFFER_API_TOKEN` | Social posting | Need Buffer account |
| `GOOGLE_ADS_*` (6 vars) | Ad management | Need Google Ads account |
| `TURNSTILE_SECRET_KEY` | Spam protection | Optional |
| `PROPERTYDATA_API_KEY` | Property data | Optional |

### Environment Variables — Vercel (frontend)
| Var | Priority | Status |
|-----|----------|--------|
| `NEXT_PUBLIC_API_URL` | Required | Should be set |
| `NEXT_PUBLIC_SUPABASE_URL` | Required | Should be set |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Required | Should be set |
| `NEXT_PUBLIC_GA4_ID` | `G-1GGW975MQY` | **Set now** |
| `NEXT_PUBLIC_BING_VERIFICATION` | Done | Done |
| `NEXT_PUBLIC_SENTRY_DSN` | Done | Done |
| `NEXT_PUBLIC_GOOGLE_ADS_ID` | When ready | Need account |
| `NEXT_PUBLIC_ADSENSE_ID` | When approved | Need traffic first |
| `NEXT_PUBLIC_META_PIXEL_ID` | When ready | Need Meta Business |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Street View | When ready |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Optional | Pair with backend |

### Security — Immediate
- [ ] Run `npm audit fix` in backend (20 vulnerabilities — axios, undici, qs)
- [ ] Run `npm audit fix` in frontend (17 vulnerabilities)
- [ ] Test email sending after any nodemailer update

---

## PHASE 1: LAUNCH & FIRST USERS (Weeks 1-2)

### Marketing Launch
- [ ] Post 5 Instagram posts (ready in docs/SOCIAL_OUTREACH_CONTENT.md)
- [ ] Post in 5+ UK parenting Facebook groups
- [ ] Post on Mumsnet/Netmums forums
- [ ] Post 5 tweets
- [ ] Send 10 provider outreach emails manually
- [ ] Email 5 parenting bloggers
- [ ] Run promotion seeding script (`node scripts/seed-promotions.js`)
- [ ] Set up Buffer account → connect social channels
- [ ] Create Google Ads campaign (£10/day, ad copy in content pack)

### External Accounts
- [ ] Buffer (social posting automation)
- [ ] Google Ads (paid acquisition)
- [ ] Meta Business (Facebook/Instagram pixel)
- [ ] Google AdSense (when traffic warrants)

### Developer Platform & AI Integrations
- [x] Create Custom GPT (done — docs/CUSTOM_GPT_SETUP.md)
- [ ] List API on RapidAPI
- [ ] Submit to Product Hunt
- [ ] List on Public APIs (github.com/public-apis/public-apis)
- [ ] Publish Postman collection for NurseryMatch API
- [ ] Create Claude MCP server config file for Claude Desktop users
- [ ] List on MCP directories (glama.ai/mcp/servers, mcp.so, smithery.ai)
- [ ] Add MCP setup instructions to /developers page
- [ ] Create embeddable nursery search widget (JS snippet for third-party sites)
- [ ] Pitch to property platforms (Rightmove/Zoopla) for "nearby nurseries" widget
- [ ] Pitch to council/NHS family services portals for nursery search embedding
- [ ] Contact parenting app developers to integrate NurseryMatch API

### GitHub Housekeeping
- [ ] Add `PRODUCTION_API_URL` secret for deploy validation
- [ ] Merge Dependabot PRs #44, #45 (safe minor/patch bumps)

---

## PHASE 2: FIRST 1,000 USERS (Weeks 2-4)

### Growth Features
- [ ] "First time here?" onboarding modal for new visitors
- [ ] "Share" button on nursery cards in search results
- [ ] Provider count on homepage ("Join X nurseries")
- [ ] Review and publish auto-generated blog drafts (Admin > Marketing)

### SEO & Content
- [ ] Expand 3 shortest blog guides to 1500+ words
- [ ] Add internal links from guides to search/comparison pages
- [ ] Add "Resources" section to footer
- [ ] Add LocalBusiness schema to district/area pages

### Data Quality
- [ ] Verify childminder count (~40k expected)
- [ ] Check "Nurseries without location" — should be <5%
- [ ] Verify school progression data on nursery profiles
- [ ] Run Google Places sync for photos/ratings

### Provider Acquisition
- [ ] Source nursery email addresses (Issue #46)
- [ ] Monitor automated provider outreach cron (daily 10am)
- [ ] Track claim conversion rate

---

## PHASE 3: GROWTH & MONETISATION (Months 2-3)

### Revenue
- [ ] Apply for Google AdSense
- [ ] Onboard first 10 paying providers (Pro @ £29/month)
- [ ] Sell local promotions to kids activity businesses
- [ ] Set up Stripe live keys + webhooks

### Performance
- [ ] Self-host OSRM for travel time (Docker — free demo won't scale)
- [ ] Code-split `/provider/reports` page (256kB → ~150kB with next/dynamic)
- [ ] Migrate nursery profile images to next/image
- [ ] Add skeleton loaders for TestimonialCarousel + search results
- [ ] Establish Lighthouse CI baseline

### Platform Improvements
- [ ] Wire review sentiment analysis to UI (reviewNlp.js exists)
- [ ] Provider bulk enquiry export (CSV)
- [ ] Provider analytics comparison over time
- [ ] Nursery photo OG images for social shares
- [ ] "Nurseries near me" browser GPS search
- [ ] Web push notifications for saved search alerts

### Code Quality
- [ ] Fix 10 React Hook dependency warnings (stale closures)
- [ ] Add E2E test suite (Playwright) — search → profile → enquiry
- [ ] Add DOMPurify to blog markdown renderer
- [ ] Prettier formatting pass on backend (7 files)

### Testing
- [ ] E2E tests (Playwright) — critical user flows
- [ ] API load testing (k6 or Artillery)
- [ ] OWASP ZAP security scan
- [ ] Accessibility audit (WCAG 2.1 AA)

---

## PHASE 4: SCALE (Months 3-6)

### Geographic Expansion
- [ ] Northern Ireland childcare data (HSC Trusts)
- [ ] Republic of Ireland (Tusla)

### Mobile
- [ ] Progressive Web App (PWA) or React Native app

### Partnerships
- [ ] Mortgage broker referral program
- [ ] Property portal affiliate (Rightmove/Zoopla)
- [ ] API reseller / white-label for councils
- [ ] A/B testing infrastructure

### Marketing Automation
- [ ] Buffer scheduling UI (not just auto-post)
- [ ] Google Ads automated bid management
- [ ] Advertiser self-service portal
- [ ] Referral incentive program (reward parents who share)

### Infrastructure
- [ ] Staging environment (separate Render + Vercel)
- [ ] Database backup drill
- [ ] Centralized log aggregation
- [ ] APM for slow query detection
- [ ] Automated database migration runner

### Compliance
- [ ] ICO data controller registration (UK GDPR requirement)
- [ ] Cookie consent flow for retargeting pixels (Meta/Google)
- [ ] Lawyer review of terms/privacy for Scotland/Wales
- [ ] DPIA review for marketing automation + retargeting
- [ ] Formal accessibility audit (WCAG 2.1 AA)

---

## PHASE 5: FUTURE VISION (6+ months)

- [ ] France expansion (PMI data, French translation)
- [ ] Multi-language support (Welsh, French via Next.js i18n)
- [ ] Enhanced AI nursery advisor (multi-turn, context-aware)
- [ ] Parent community features (forums, area groups)
- [ ] Nursery waitlist management for providers
- [ ] Video virtual nursery tours
- [ ] Childcare voucher provider integration
- [ ] Annual "Best Nurseries" awards program

---

## OPEN ISSUES

| # | Title | Priority |
|---|-------|----------|
| #46 | Provider emails — Ofsted CSV sets email to null | Medium |

## DEPENDABOT PRs

| # | Package | Risk |
|---|---------|------|
| #44 | Backend minor/patch bumps | Low — safe to merge |
| #45 | Frontend minor/patch bumps | Low — safe to merge |
| #2 | actions/setup-node 4→6 | Low |
| #3 | actions/checkout 4→6 | Low |
| #5 | dotenv 16→17 | Medium |
| #6 | pino-pretty 10→13 | Medium |
| #7 | vitest 2→4 | High — breaking changes |
| #8 | express 4→5 | High — breaking changes |
| #10 | tailwindcss 3→4 | High — breaking changes |
| #11 | eslint 8→10 | High — breaking changes |
| #12 | eslint-config-next 14→16 | High — breaking changes |
| #13 | react-dom types | Low |

---

## ARCHITECTURE REFERENCE

```
nursery-finder/
├── backend/                    43 routes, 43 services, 411 tests
│   ├── src/routes/             API endpoints (Express)
│   ├── src/services/           Business logic
│   ├── src/middleware/         Auth, rate limiting, error handling
│   ├── test/                   Vitest test suite
│   └── Dockerfile
├── frontend/                   67 pages, 40+ components, 117 tests
│   ├── app/                    Next.js App Router pages
│   ├── components/             Reusable React components
│   ├── lib/                    API client, analytics, preferences
│   └── test/                   Jest + React Testing Library
├── database/migrations/        60 numbered SQL files
├── docs/                       10 operational documents
├── scripts/                    Deploy checks, data seeding
├── .github/workflows/          CI, deploy validation, Lighthouse
└── CLAUDE.md                   Project context (read every session)
```

## KEY URLS

| Resource | URL |
|----------|-----|
| Frontend | nurserymatch.com |
| Backend API | nursery-finder-api on Render |
| API Docs | /api/docs (Swagger UI) |
| Admin | /admin |
| Sitemap | /sitemap.xml |
| LLMs.txt | /llms.txt |
| OpenAPI | /api/openapi.json |
| GPT spec | /api/openapi-gpt.json |
