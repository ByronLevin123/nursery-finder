# NurseryMatch — Complete Backlog & Roadmap

Last updated: 2026-06-28

---

## DEPLOYMENT STATUS

All code merged to `main` and auto-deploying via Render (backend) + Vercel (frontend).

**Latest PRs on main (all deployed):**

| PR | What | Status |
|----|------|--------|
| #74 | Google Analytics 4 support | Deployed |
| #73 | Security hardening (4 fixes) | Deployed |
| #72 | Trust proxy reverted to 1 for Render | Deployed |
| #71 | Rate limit bumped 300→600 | Deployed |
| #70 | Map markers clickable on desktop | Deployed |
| #69 | Quiz below search, smart search default | Deployed |
| #68 | 8 bugs from code review | Deployed |
| #67 | AI advisor, referral, exit popup, drip emails, dynamic SEO | Deployed |
| #66 | Scotland/Wales CSV URL input | Deployed |
| #65 | Scotland ingest CSV format fix | Deployed |
| #64 | Retargeting pixels + marketing crons | Deployed |
| #57 | Marketing Hub | Deployed |
| #56 | Scotland/Wales, city pages, AI search, social content | Deployed |
| #55 | soft_play category fix | Deployed |
| #54 | Critical bugs (N+1, race condition, domain bypass) | Deployed |
| #53 | Google Ads + AdSense | Deployed |
| #52 | Data pipeline + CI/CD + admin runbook | Deployed |
| #50 | Childminder ingest fix | Deployed |
| #49 | Admin stats 500 fix | Deployed |

---

## COMPLETED (this session — 26 PRs merged)

### Bug Fixes
- [x] Admin dashboard 500 (Supabase .catch() bug)
- [x] Childminder ingest (REDACTED addresses no longer skipped)
- [x] School geocoding added to nightly cron
- [x] N+1 query in enquiries route
- [x] Visit booking race condition (optimistic locking)
- [x] Domain validation bypass in overlays
- [x] soft_play promotion category mismatch
- [x] Press kit placeholder bio
- [x] Map markers not clickable on desktop (icon scale was 0)
- [x] Rate limit 429 (bumped 300→600, trust proxy correct for Render)
- [x] Marketing Hub field name mismatch (content_type→type)
- [x] Empty profileIds when posting to Buffer
- [x] Platform hardcoded as 'twitter' for all posts
- [x] Buffer status 'posted' even on null response
- [x] Scotland ingest duplicate date fallback
- [x] Dead ternary in Google Ads headline builder
- [x] Drip email greeting 'Hi null' → 'Hi there'

### Features Built
- [x] "Run All Steps" data pipeline with DAG ordering
- [x] CI/CD post-deploy validation workflow
- [x] Admin runbook (docs/ADMIN_RUNBOOK.md)
- [x] Google Ads conversion tracking + AdSense
- [x] Google Analytics 4 support
- [x] Scotland + Wales childcare data support
- [x] City landing pages (20 UK cities)
- [x] AI search optimization (llms.txt, GPT config, AI crawler robots.txt)
- [x] Marketing Hub (AI content generator, Buffer social, Google Ads)
- [x] Retargeting pixels (Meta Pixel, Google Remarketing)
- [x] Automated marketing crons (provider outreach, social posting, blog generation)
- [x] Social/outreach content pack (docs/SOCIAL_OUTREACH_CONTENT.md)
- [x] Promotion seeding script
- [x] AI nursery advisor (floating chat panel with Claude)
- [x] Exit-intent popup (quiz CTA on desktop)
- [x] Referral tracking (UTM-tagged share links)
- [x] Parent signup drip emails (Day 1, 3, 7)
- [x] Dynamic search page SEO titles
- [x] Social proof stats strip on homepage
- [x] Quiz moved below search, smart search default on

### Security
- [x] Full security review — no critical vulnerabilities
- [x] Reviews require authentication (was anonymous)
- [x] Shared shortlist token rate-limited
- [x] Public CORS restricted to GET only
- [x] API key query parameter removed

### Infrastructure
- [x] Google Search Console — verified, indexing
- [x] Bing Webmaster Tools — verified, sitemap submitted
- [x] Sentry — deployed (backend + frontend)
- [x] Database migrations 057-059

---

## PHASE 1: IMMEDIATE — DO THIS NOW

### Database (Supabase SQL Editor)
- [ ] Verify migration 058 ran (DROP FUNCTION + recreate search_nurseries_near)
- [ ] Run migration 055 (postcode_areas columns for aggregate/family functions)
- [ ] Run migration 004 (refresh_postcode_area_nursery_stats function)
- [ ] Run migration 009 (calculate_all_family_scores function)
- [ ] Verify admin_reports_cache table exists (migration 034)

### Data Population (Admin Dashboard > Data Ingest)
- [ ] Run Ofsted Import (includes childminders now)
- [ ] Run Geocode Nurseries (2-3 times, 2000/batch)
- [ ] Run Schools Import
- [ ] Run Geocode Schools (5-10 times, 100/batch)
- [ ] Import Scotland data (paste CSV URL into admin panel)
- [ ] Import Wales data (download from careinspectorate.wales)
- [ ] Run Geocode Nurseries again (for Scotland/Wales)
- [ ] Run Aggregate Areas
- [ ] Run Family Scores
- [ ] Run Crime Data
- [ ] Run IMD Data
- [ ] Run Google Places Sync
- [ ] Run Snapshot Reports

### Env Vars — Vercel (frontend)
| Var | Value | Status |
|-----|-------|--------|
| `NEXT_PUBLIC_GA4_ID` | `G-1GGW975MQY` | Set now |
| `NEXT_PUBLIC_BING_VERIFICATION` | Your verification code | Done |
| `NEXT_PUBLIC_SENTRY_DSN` | Your Sentry DSN | Done |
| `NEXT_PUBLIC_GOOGLE_ADS_ID` | `AW-XXXXXXXXX` | When ready |
| `NEXT_PUBLIC_ADSENSE_ID` | `ca-pub-XXXXXXXXX` | When approved |
| `NEXT_PUBLIC_META_PIXEL_ID` | From Meta Events Manager | When ready |
| `NEXT_PUBLIC_GOOGLE_REMARKETING_ID` | Same as Ads ID | When ready |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | For Street View | When ready |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | From Cloudflare | Optional |

### Env Vars — Render (backend)
| Var | Status | Priority |
|-----|--------|----------|
| `SENTRY_DSN` | Done | - |
| `ANTHROPIC_API_KEY` | **Set now** — AI advisor won't work without it | Critical |
| `BUFFER_API_TOKEN` | Need Buffer account | For social posting |
| `GOOGLE_ADS_*` (6 vars) | Need Google Ads API access | For ad management |
| `RESEND_AUDIENCE_ID` | From Resend dashboard | For newsletter |
| `TURNSTILE_SECRET_KEY` | From Cloudflare | Optional |

### External Accounts to Create
| Service | What for | Priority |
|---------|----------|----------|
| **Buffer** | Auto social posting (cron already built) | High |
| **Google Ads** | Paid campaigns + conversion tracking | High |
| **Meta Business** | Facebook/Instagram retargeting pixel | Medium |
| **Google AdSense** | Display ads for revenue (needs traffic first) | Later |

### Marketing Actions
- [ ] Post Instagram content (5 posts ready in docs/SOCIAL_OUTREACH_CONTENT.md)
- [ ] Post in UK parenting Facebook groups
- [ ] Post on Mumsnet/Netmums forums
- [ ] Post tweets from content pack
- [ ] Send provider outreach emails
- [ ] Email parenting bloggers
- [ ] Run promotion seeding script (`node scripts/seed-promotions.js`)

### GitHub
- [ ] Add `PRODUCTION_API_URL` secret for deploy validation workflow
- [ ] Merge Dependabot PRs #44, #45 (minor/patch bumps)

---

## PHASE 2: FIRST 1,000 USERS (Weeks 2-4)

### Growth Features
- [ ] Add "First time here?" onboarding modal for new visitors
- [ ] Add "Share" button to nursery cards in search results
- [ ] Add provider count to homepage ("Join X nurseries on NurseryMatch")

### SEO & Content
- [ ] Expand 3 shortest blog guides to 1500+ words
- [ ] Add internal links from guides to search/comparison pages
- [ ] Add "Resources" section to footer linking top 3 guides
- [ ] Review and publish auto-generated blog drafts (Admin > Marketing)
- [ ] Add LocalBusiness schema to district/area pages

### Data Quality
- [ ] Verify childminder count (~40k expected after ingest fix)
- [ ] Check "Nurseries without location" in admin — should be <5%
- [ ] Verify school progression data on nursery profiles

### Provider Acquisition
- [ ] Source nursery email addresses (Issue #46)
- [ ] Monitor automated provider outreach cron results

### Developer Platform
- [ ] List API on RapidAPI, Public APIs, API List, Postman Network
- [ ] Submit to Product Hunt
- [ ] Create Custom GPT and publish (docs/CUSTOM_GPT_SETUP.md)

---

## PHASE 3: GROWTH & MONETISATION (Months 2-3)

### Revenue
- [ ] Apply for Google AdSense
- [ ] Onboard first 10 paying providers (Pro @ £29/month)
- [ ] Sell first local promotions to kids activity businesses
- [ ] Set up Stripe live keys + webhook for production billing

### Performance & Reliability
- [ ] Self-host OSRM for travel time (Docker)
- [ ] Code-split `/provider/reports` page (256kB bundle)
- [ ] Migrate nursery profile images to next/image
- [ ] Add skeleton loaders for TestimonialCarousel and search results
- [ ] Establish Lighthouse CI baseline

### Platform Improvements
- [ ] Wire review sentiment analysis to UI (reviewNlp.js exists)
- [ ] Provider bulk enquiry export (CSV)
- [ ] Provider analytics comparison over time
- [ ] Nursery photo OG images for social shares
- [ ] "Nurseries near me" geolocation search (browser GPS)
- [ ] Web push notifications for saved search alerts

### Testing
- [ ] E2E test suite (Playwright) — search → profile → enquiry flow
- [ ] API load testing (k6 or Artillery)
- [ ] OWASP ZAP security scan
- [ ] Fix 10 React Hook dependency warnings

---

## PHASE 4: SCALE (Months 3-6)

### Expansion
- [ ] Northern Ireland childcare data
- [ ] Republic of Ireland (Tusla)
- [ ] Mobile app (React Native or PWA)

### Partnerships
- [ ] Mortgage broker referral program
- [ ] Property portal affiliate integration (Rightmove/Zoopla)
- [ ] API reseller / white-label for councils

### Marketing Automation
- [ ] Buffer scheduling UI (not just auto-post)
- [ ] Google Ads automated bid management
- [ ] Advertiser self-service portal
- [ ] Referral incentive program

### Infrastructure
- [ ] Staging environment (separate Render + Vercel projects)
- [ ] Database backup drill
- [ ] Centralized log aggregation
- [ ] APM for slow query detection
- [ ] Automated database migration runner

### Compliance
- [ ] ICO data controller registration (UK GDPR)
- [ ] Cookie policy review (retargeting pixels may need consent)
- [ ] Lawyer review of terms/privacy for Scotland/Wales
- [ ] DPIA for marketing automation + retargeting

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

## OPEN GITHUB ISSUES

| # | Title | Priority |
|---|-------|----------|
| #46 | Provider emails — Ofsted CSV sets email to null | Medium |

## OPEN DEPENDABOT PRs

| # | Type | Risk |
|---|------|------|
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
| #13 | react-dom types bump | Low |
