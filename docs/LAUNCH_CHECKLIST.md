# NurseryMatch — Launch checklist

**Source of truth for every manual task the user has to do in a dashboard or
external service.** Code work is tracked in git commits and the roadmap
(`/Users/byron.levin/.claude/plans/fuzzy-crunching-toucan.md`); this file
covers the things Claude can't do alone.

Tick items off as you complete them. New items get appended to the bottom
of the relevant section.

Last reviewed: 2026-04-27

---

## 🚨 Pre-launch blockers — must be done before going public

### Email pipeline (Resend)

- [ ] **Sign up for Resend** at resend.com (or confirm existing account).
- [ ] **Add `nurserymatch.com` as a domain** in Resend dashboard → Domains.
- [ ] **Add Resend's DNS records to Namecheap** (DKIM TXT, SPF TXT on
      `send.nurserymatch.com`, MX for `send.nurserymatch.com`). Resend shows
      the exact values to paste.
- [ ] **Click Verify** in Resend after DNS propagation (5–60 min).
- [ ] **Create a Resend Audience** (Marketing → Audiences → New) for
      newsletter signups. Copy the audience ID — looks like `aud_abc123…`.

### Render env vars (backend)

- [ ] `EMAIL_FROM=NurseryMatch <noreply@nurserymatch.com>`
- [ ] `FRONTEND_URL=https://nurserymatch.com`
- [ ] `RESEND_API_KEY=re_…` (from Resend dashboard)
- [ ] `RESEND_AUDIENCE_ID=aud_…` (from Resend audience created above)
- [ ] `SENTRY_DSN=https://…@sentry.io/…` (from Sentry project)
- [ ] `STRIPE_SECRET_KEY=sk_live_…` (from Stripe live keys, not test)
- [ ] `STRIPE_WEBHOOK_SECRET=whsec_…` (from Stripe → Developers →
      Webhooks → endpoint signing secret)
- [ ] `STRIPE_PRICE_PROVIDER_PRO=price_…` (Stripe → Products → Pro)
- [ ] `STRIPE_PRICE_PROVIDER_PREMIUM=price_…` (Stripe → Products → Premium)
- [ ] `ANTHROPIC_API_KEY=sk-ant-…` (from console.anthropic.com)
- [ ] `GOOGLE_PLACES_API_KEY=AIza…` (Google Cloud → Places API)
- [ ] `PROPERTYDATA_API_KEY=…` (propertydata.co.uk)
- [ ] `TURNSTILE_SECRET_KEY=0x…` (from Cloudflare Turnstile site, see below)
- [ ] `ALERT_EMAIL=byron@example.com` (where ops alerts go)

### Vercel env vars (frontend)

- [ ] `NEXT_PUBLIC_API_URL=https://nursery-finder-6u7r.onrender.com`
- [ ] `NEXT_PUBLIC_SUPABASE_URL=https://gybwptpntmpjjwmgfhnn.supabase.co`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY=…`
- [ ] `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIza…`
- [ ] `NEXT_PUBLIC_PLAUSIBLE_DOMAIN=nurserymatch.com` (enables analytics)
- [ ] `NEXT_PUBLIC_SENTRY_DSN=https://…@sentry.io/…`
- [ ] `NEXT_PUBLIC_TURNSTILE_SITE_KEY=0x4…` (from Cloudflare Turnstile site)

### Supabase Auth dashboard

- [ ] **Site URL** → `https://nurserymatch.com`
      (Project → Authentication → URL Configuration)
- [ ] **Redirect URLs allowlist** — add:
      ```
      https://nurserymatch.com/**
      https://www.nurserymatch.com/**
      http://localhost:3000/**
      ```
- [ ] **Email templates** — paste the four branded HTML templates I gave
      you earlier in chat, into Authentication → Email Templates:
  - [ ] Confirm signup
  - [ ] Magic Link
  - [ ] Reset Password
  - [ ] Change Email Address

### Cloudflare Turnstile (spam protection on enquiry form)

- [ ] Sign up / log in at https://dash.cloudflare.com → Turnstile.
- [ ] Create a new site for `nurserymatch.com` (also add `www.nurserymatch.com`).
- [ ] Copy the **Site Key** → set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` in Vercel.
- [ ] Copy the **Secret Key** → set `TURNSTILE_SECRET_KEY` in Render.
- [ ] Verify enquiry submissions show a Turnstile challenge after redeploy.

### Sentry

- [ ] Create org/project at sentry.io (free tier).
- [ ] Copy DSN → set `SENTRY_DSN` (backend) + `NEXT_PUBLIC_SENTRY_DSN` (frontend).
- [ ] Smoke test: trigger a forced 500 in production from each side, confirm
      events arrive in the Sentry dashboard.

### Stripe (provider billing)

- [ ] Switch Stripe dashboard to **live mode**.
- [ ] Create products + prices for Pro and Premium tiers; copy price IDs.
- [ ] Add a webhook endpoint pointing at
      `https://nursery-finder-6u7r.onrender.com/api/v1/billing/webhook`,
      subscribe to `checkout.session.completed`, `customer.subscription.*`,
      `invoice.*` events. Copy signing secret to Render.
- [ ] Run a real paid checkout end-to-end (your own card), then refund it.
      Confirm webhook events are received and idempotent (replay the same
      event ID from the dashboard, no double-write).
- [ ] **Stripe Tax** — toggle in Settings → Tax if you're VAT-registered.
      Otherwise skip (and document the threshold).

### Plausible Analytics — custom goals

Plausible auto-tracks pageviews; for funnel goals add these in Sites →
nurserymatch.com → Goals → Add goal → "Custom event":

- [ ] `Signup`
- [ ] `Newsletter Subscribe`
- [ ] `Enquiry Submit`
- [ ] `Provider Register`
- [ ] `Claim Submit`
- [ ] `Provider Checkout Success`
- [ ] (Optional) `Search`, `Quiz Complete`, `Shortlist Add`, `Compare Add`,
      `AI Assistant Query`

(Other event names defined in `frontend/lib/analytics.ts`.)

### Hosting plan upgrades

- [ ] **Render** → Backend service → Settings → Plan → upgrade to Starter
      ($7/mo). Free tier sleeps; cold starts will mask launch-traffic bugs.
- [ ] **Render** → confirm there's a separate **Background Worker** service
      running `backend/src/worker.js` (drip emails, weekly digests, Ofsted
      change detection). If absent, add one.
- [ ] **Supabase** → Project → Settings → Billing → upgrade to Pro ($25/mo).
      Free tier pauses after 7 days inactive — catastrophic post-launch.

### Database

- [ ] Verify Supabase auto-backups are running (Project → Database → Backups).
- [ ] Run a backup-restore drill: take a manual backup, restore to a
      scratch project, query a known row. Document any surprises in
      `docs/INCIDENT_RESPONSE.md`.
- [ ] Configure connection pooling: in Render env, point the Supabase
      connection string at the **Supavisor transaction-mode** pooler URL
      (Project → Settings → Database → Connection pooling → Transaction).
      Without this, a small burst can exhaust direct Postgres connections.

### Old domain cleanup (`comparethenursery.com`)

- [ ] Namecheap → Domain List → comparethenursery.com → **disable
      auto-renew**.
- [ ] Optionally add a 301 redirect to `nurserymatch.com` via DNS or
      Vercel rewrite (only if you've shared the old URL anywhere).

### Monitoring

- [ ] UptimeRobot free tier — add a monitor for
      `https://nursery-finder-6u7r.onrender.com/api/v1/health` (5-minute
      interval). Optionally enable the public status page.
- [ ] Add the status page URL to `docs/INCIDENT_RESPONSE.md`.

### Sitemap + indexing

- [ ] Google Search Console → Sitemaps → submit
      `https://nurserymatch.com/sitemap.xml`.
- [ ] URL Inspection → request indexing for `/`, `/search`, `/find-an-area`,
      `/guides`, `/about`, `/faq` (10/day cap). Spread over a few days.
- [ ] (Optional) Bing Webmaster Tools — add the site at
      https://www.bing.com/webmasters, copy the meta-tag verification
      content value into Vercel env as `NEXT_PUBLIC_BING_VERIFICATION`,
      redeploy, click Verify in Bing, then submit the sitemap.

### Legal / compliance (external clocks — start in Week 1)

- [ ] Brief a UK SRA-registered lawyer for a fixed-fee privacy + terms +
      provider terms package. ~£800–£1,500. Assume 2-week turnaround.
      Include in brief: homepage and About-page copy review, not just the
      legal pages.
- [ ] Register as a data controller with the ICO (~£52/yr, 30-min form).
- [ ] When lawyer feedback arrives → apply edits to `frontend/app/privacy/page.tsx`
      and `frontend/app/terms/page.tsx`.
- [ ] DPIA template exists at `docs/DPIA.md` — fill in the assessment
      worksheet sections, share with lawyer for sign-off.
- [ ] Insurance — get quotes for Professional Indemnity + Cyber Liability
      from Hiscox or Superscript. ~£400–£800/yr. Bind in Week 5, not Week 6.

### Visual assets

- [ ] Brief designer for: favicon SVG, OG image PNG (1200×630), email logo
      (hosted PNG), PWA icons (192×192 and 512×512). Assume 1-week turnaround.
- [ ] When delivered:
  - [ ] Replace `frontend/public/favicon.svg`.
  - [ ] Replace `frontend/app/opengraph-image.tsx`.
  - [ ] Add `frontend/public/icon-192.png` + `frontend/public/icon-512.png`.
  - [ ] Update `frontend/public/manifest.json` to reference both PNG icons.
  - [ ] Host the email logo on Vercel `/public` and reference its full URL
        in `backend/src/services/emailService.js` shell template.

---

## 🟡 Strong launch — for credibility, not strictly blocking

### Marketing

- [ ] Manually onboard 50–100 nurseries (cold-start solver). Reach out
      via email/LinkedIn. Track in a spreadsheet.
- [ ] Create branded social accounts and claim usernames:
  - [ ] Twitter/X
  - [ ] LinkedIn page
  - [ ] BlueSky
  - [ ] Instagram (if you'll post photos)
- [ ] After social accounts exist, populate the `SOCIAL_PROFILES` array
      in `frontend/lib/schema.ts` so Google's Knowledge Graph picks up
      the links via schema.org `sameAs`.
- [ ] **Press kit page exists at `/press`** — but two TODOs to fill:
  - [ ] Replace the founder-bio placeholder in
        `frontend/app/press/page.tsx` (Byron's actual 2-3 sentences).
  - [ ] Drop a logo SVG and 3-4 screenshots into
        `frontend/public/press-kit/`, then remove the "(pending)" link
        markers in `/press`.
- [ ] Write 3 launch blog posts (queue at least one in advance).

### Operations

- [ ] Set up `support@nurserymatch.com` mailbox in PrivateEmail and
      forward to your day-to-day inbox. See `docs/SUPPORT_TRIAGE.md`.
- [ ] Set up `legal@nurserymatch.com` for DMCA / takedown requests
      (referenced on /dmca page).
- [ ] (Optional) Live chat — Crisp free tier — when you can absorb the
      support load.

---

## 🟢 Post-launch optimisation

These can wait until you're past launch and have real traffic to inform
decisions. Tracked in the roadmap, not here.

---

## How to update this file

When you complete a task, replace `- [ ]` with `- [x]`. When a new manual
task surfaces from a code change, add it under the relevant section with
context about *why* it's needed.
