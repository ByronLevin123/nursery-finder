# NurseryMatch — Complete Backlog & Roadmap

Last updated: 2026-06-28

---

## CURRENT STATUS

### Completed (this session)
- [x] Fixed admin dashboard 500 (Supabase .catch() bug)
- [x] Fixed childminder ingest (REDACTED addresses no longer skipped)
- [x] Fixed school geocoding not in nightly cron
- [x] Fixed N+1 query in enquiries route
- [x] Fixed visit booking race condition (optimistic locking)
- [x] Fixed domain validation bypass in overlays
- [x] Fixed soft_play promotion category mismatch
- [x] Fixed press kit placeholder bio
- [x] Added "Run All Steps" data pipeline with DAG ordering
- [x] Added CI/CD post-deploy validation workflow
- [x] Added admin runbook (docs/ADMIN_RUNBOOK.md)
- [x] Added Google Ads conversion tracking + AdSense
- [x] Added Scotland + Wales childcare data support
- [x] Added city landing pages (20 UK cities)
- [x] Added AI search optimization (llms.txt, GPT config)
- [x] Added Marketing Hub (AI content, Buffer, Google Ads)
- [x] Added retargeting pixels (Meta Pixel, Google Remarketing)
- [x] Added automated marketing crons (provider outreach, social posting, blog generation)
- [x] Added social/outreach content pack
- [x] Added promotion seeding script
- [x] Database migrations 057-059 run
- [x] Google Search Console — verified, indexing
- [x] Bing Webmaster Tools — verified, sitemap submitted
- [x] Sentry — deployed (backend + frontend)
- [x] Data ingest — running

### In Progress
- [ ] Data ingest completing (Ofsted, schools, geocoding)
- [ ] Google/Bing indexing pages

---

## PHASE 1: IMMEDIATE (This week)

### Data Population
- [ ] Verify Ofsted ingest completed successfully
- [ ] Verify all nurseries geocoded (run Geocode Nurseries until 0 remaining)
- [ ] Verify schools imported and geocoded
- [ ] Import Scotland data (download CSV from careinspectorate.com)
- [ ] Import Wales data (download CSV from careinspectorate.wales)
- [ ] Geocode Scotland/Wales nurseries
- [ ] Run Aggregate Areas + Family Scores
- [ ] Run promotion seeding script (`node scripts/seed-promotions.js`)

### External Accounts
- [ ] Create Buffer account → connect Instagram, Facebook, Twitter, LinkedIn
- [ ] Set `BUFFER_API_TOKEN` in Railway
- [ ] Create Google Ads account → set up first campaign (£10/day)
- [ ] Set `NEXT_PUBLIC_GOOGLE_ADS_ID` in Vercel
- [ ] Create Meta Business account → create Pixel
- [ ] Set `NEXT_PUBLIC_META_PIXEL_ID` in Vercel
- [ ] Set `RESEND_AUDIENCE_ID` in Railway (for newsletter)

### Marketing Launch
- [ ] Post Instagram content (5 posts in content pack)
- [ ] Post in 5+ UK parenting Facebook groups
- [ ] Post on Mumsnet/Netmums forums
- [ ] Post 5 tweets from content pack
- [ ] Send 10 provider outreach emails manually
- [ ] Email 5 parenting bloggers
- [ ] Submit sitemap to Google Search Console ✅
- [ ] Submit sitemap to Bing ✅

### GitHub
- [ ] Add `PRODUCTION_API_URL` secret for deploy validation workflow
- [ ] Merge Dependabot PRs #44, #45 (minor/patch bumps)

---

## PHASE 2: FIRST 1,000 USERS (Weeks 2-4)

### Growth Features
- [ ] Add aggregate social proof to homepage ("X,000 parents searched this month")
- [ ] Add "Share" button to nursery cards in search results (not just profile pages)
- [ ] Add referral tracking with UTM links ("Share with a friend")
- [ ] Add exit-intent popup on homepage with quiz CTA
- [ ] Add "First time here?" onboarding modal for new visitors
- [ ] Set up parent signup drip email (Day 1: welcome, Day 3: top guides, Day 7: nurseries near you)

### SEO & Content
- [ ] Expand 3 shortest blog guides to 1500+ words
- [ ] Add internal links from guides to search/comparison pages
- [ ] Add "Resources" section to footer linking top 3 guides
- [ ] Review and publish auto-generated blog drafts (Admin > Marketing)
- [ ] Add LocalBusiness schema to district/area pages
- [ ] Dynamic search page titles based on query (e.g., "Nurseries in SW11" not generic)

### Data Quality
- [ ] Verify childminder count is reasonable (should be ~40k after ingest fix)
- [ ] Check "Nurseries without location" in admin — should be <5%
- [ ] Run Google Places sync for ratings/photos enrichment
- [ ] Verify school progression data shows on nursery profiles

### Provider Acquisition
- [ ] Add provider count to homepage trust strip ("Join X nurseries on NurseryMatch")
- [ ] Source nursery email addresses (Issue #46 — Ofsted CSV has none)
  - Option A: Google Places API enrichment (some have emails)
  - Option B: Manual CSV upload of nursery emails by region
  - Option C: Wait for organic claims via /for-providers page
- [ ] Monitor automated provider outreach cron results (daily 10am)

---

## PHASE 3: GROWTH & MONETISATION (Months 2-3)

### Revenue
- [ ] Apply for Google AdSense (needs established traffic first)
- [ ] Set `NEXT_PUBLIC_ADSENSE_ID` in Vercel when approved
- [ ] Onboard first 10 paying providers (Pro tier @ £29/month)
- [ ] Sell first local promotions to kids activity businesses
- [ ] Set up Stripe live keys + webhook for production billing

### Performance & Reliability
- [ ] Self-host OSRM for travel time (Docker) — free demo won't scale
- [ ] Code-split `/provider/reports` page (256kB bundle → use next/dynamic)
- [ ] Migrate nursery profile images to next/image for optimization
- [ ] Add skeleton loaders for TestimonialCarousel and search results
- [ ] Add Core Web Vitals monitoring
- [ ] Establish Lighthouse CI baseline and enable assertions
- [ ] Load test with concurrent users to verify fixes hold

### Platform Improvements
- [ ] Add review sentiment analysis (reviewNlp.js service exists, wire to UI)
- [ ] Add provider bulk enquiry export (CSV download)
- [ ] Add provider analytics comparison over time (not just snapshot)
- [ ] Add nursery photo OG images (use provider photos for social shares)
- [ ] Add "Nurseries near me" geolocation-based search (browser GPS)
- [ ] Add web push notifications for saved search alerts

### Code Quality
- [ ] Fix 10 React Hook dependency warnings (stale closure risk)
- [ ] Add E2E test suite (Playwright) for critical flows
- [ ] Run `npm audit fix` to patch remaining vulnerabilities
- [ ] Add image CDN for user-uploaded provider photos
- [ ] Prettier formatting pass on backend (7 files need cleanup)

---

## PHASE 4: SCALE (Months 3-6)

### Major Features
- [ ] Northern Ireland childcare data (Health & Social Care Trusts)
- [ ] Republic of Ireland (Tusla) — English only
- [ ] Mobile app (React Native or PWA)
- [ ] Mortgage broker referral partnerships
- [ ] Property portal affiliate integration (Rightmove/Zoopla)
- [ ] API reseller / white-label product for councils
- [ ] A/B testing infrastructure for emails and landing pages

### Marketing Automation Upgrades
- [ ] Buffer auto-posting → add scheduling UI (not just auto-post)
- [ ] Google Ads → automated bid management based on conversion data
- [ ] Advertiser self-service portal (local businesses create own promotions)
- [ ] Automated PR monitoring (track mentions of NurseryMatch)
- [ ] Referral incentive program (reward parents who share)
- [ ] Push notification campaigns via web push API

### Infrastructure
- [ ] Add staging environment (separate Railway + Vercel projects)
- [ ] Database backup drill (restore from Supabase backup)
- [ ] Centralized log aggregation (Railway logs are ephemeral)
- [ ] APM for slow query detection
- [ ] Rate limit monitoring and alerting
- [ ] Automated database migration runner (not manual SQL editor)

### Compliance & Legal
- [ ] ICO data controller registration (UK GDPR requirement)
- [ ] Cookie policy review (currently cookieless — may change with retargeting pixels)
- [ ] Lawyer review of terms/privacy for Scotland/Wales expansion
- [ ] DPIA review for new data processing (marketing automation, retargeting)

---

## PHASE 5: FUTURE VISION (6+ months)

- [ ] France expansion (PMI data, French translation)
- [ ] Multi-language support (Welsh, French via Next.js i18n)
- [ ] AI nursery matching advisor (conversational, beyond current quiz)
- [ ] Parent community features (forums, groups by area)
- [ ] Nursery waitlist management for providers
- [ ] Video virtual nursery tours
- [ ] Integration with childcare voucher providers
- [ ] Annual "Best Nurseries" awards program (PR + content)

---

## OPEN GITHUB ISSUES

| # | Title | Priority |
|---|-------|----------|
| #46 | Provider emails — Ofsted CSV sets email to null | Medium |

## OPEN DEPENDABOT PRs

| # | Type | Risk |
|---|------|------|
| #44 | Backend minor/patch bumps (grouped) | Low — safe to merge |
| #45 | Frontend minor/patch bumps (grouped) | Low — safe to merge |
| #2 | actions/setup-node 4→6 | Low |
| #3 | actions/checkout 4→6 | Low |
| #5 | dotenv 16→17 | Medium — check changelog |
| #6 | pino-pretty 10→13 | Medium |
| #7 | vitest 2→4 | High — breaking changes |
| #8 | express 4→5 | High — breaking changes |
| #10 | tailwindcss 3→4 | High — breaking changes |
| #11 | eslint 8→10 | High — breaking changes |
| #12 | eslint-config-next 14→16 | High — breaking changes |
| #13 | react-dom types bump | Low |
