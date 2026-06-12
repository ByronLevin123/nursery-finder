# NurseryMatch — Deployment Runbook (Render + Vercel + Supabase)

> Stack: **Vercel** (frontend), **Render** (backend API + worker), **Supabase** (DB).
> No Railway. Follow top-to-bottom for a clean, robust go-live.

---

## A. Set secrets first (so the deploy comes up healthy)

### A1. Render — env var group `nurserymatch-backend`
Render dashboard → Env Groups → `nurserymatch-backend` (created by the blueprint).
Set every value once; both the API and the worker read from this group.

| Key | Needed for | Notes |
|-----|-----------|-------|
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY` | everything | Supabase → Settings → API |
| `FRONTEND_URL` | email links, CORS | `https://nurserymatch.com` |
| `ADMIN_USER`, `ADMIN_PASS` | `/admin`, ingest | strong values |
| `INGEST_SECRET`, `REVIEW_IP_SECRET` | ingest / reviews | random strings |
| `SENTRY_DSN` | error tracking | sentry.io project DSN |
| `RESEND_API_KEY`, `EMAIL_FROM` | all email + digests | resend.com |
| `RESEND_AUDIENCE_ID` | newsletter | optional |
| `ANTHROPIC_API_KEY` | AI content + summaries | console.anthropic.com |
| `TURNSTILE_SECRET_KEY` | spam protection | Cloudflare Turnstile |
| `GOOGLE_PLACES_API_KEY` | ratings/photos enrichment | Google Cloud |
| `PROPERTYDATA_API_KEY` | property stats | optional |
| `BUFFER_API_TOKEN` | social posting | developers.buffer.com |
| `BUFFER_ORGANIZATION_ID` | social posting | optional (defaults to first org) |
| `GOOGLE_ADS_*` (6 keys) | ad campaigns | optional until you run ads |
| `STRIPE_*` (5 keys) | billing | required only for paid tiers |
| `SELF_PING_URL` (worker only) | keep API warm | set to API `/api/v1/health`, optional |

### A2. Vercel — Project → Settings → Environment Variables
| Key | Notes |
|-----|-------|
| `NEXT_PUBLIC_API_URL` | `https://nursery-finder-api.onrender.com` |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key only |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | `nurserymatch.com` → enables analytics |
| `NEXT_PUBLIC_SENTRY_DSN` | frontend error tracking |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | pair with backend `TURNSTILE_SECRET_KEY` |
| `NEXT_PUBLIC_GOOGLE_ADS_ID` | `AW-XXXXXXXXX` → conversion tracking |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Street View |
| `NEXT_PUBLIC_ADSENSE_ID`, `NEXT_PUBLIC_BING_VERIFICATION` | optional |

> All of these degrade gracefully: a blank value simply disables that feature,
> it does not break the app.

---

## B. Merge & deploy (order matters)

1. **Merge PR #58 → `main`.** This triggers Vercel prod + Render auto-deploy.
2. **Apply the Render blueprint** (`render.yaml`). Render will show a plan diff:
   - **creates** `nursery-finder-worker` (a paid `starter` worker — required for
     digests/reminders/drip/etc. to run),
   - **removes** the 6 old `cron-*` services (the worker now covers them; this
     prevents double-runs). Review and apply.
3. **Run the migrations** (section C) in Supabase.
4. CI + the **Post-Deploy Validation** workflow smoke-test production automatically.

> ⚠️ The worker is a **paid Render instance** (Render has no free workers). It is
> what makes the email/engagement jobs actually run. If you skip it, those jobs
> won't fire (the data-refresh jobs would also stop, since the old crons are
> removed).

---

## C. Supabase migrations

### Option 1 — migration runner (recommended)
From `backend/`, with `DATABASE_URL` set to the Supabase Postgres URI
(Supabase → Settings → Database → Connection string → URI):

```bash
# First time on the EXISTING prod DB: apply the new ones manually (Option 2),
# then adopt the tracker so old migrations are never re-run:
npm run migrate:baseline      # records all current files as applied (runs no SQL)

# From then on:
npm run migrate:status        # list applied / pending
npm run migrate               # apply pending migrations in order (transactional)
```

> ⚠️ Run `migrate:baseline` **once**, only after your DB already matches the
> latest migration — it marks files applied without executing them, so it must
> not be used to skip migrations you actually still need.

### Option 2 — SQL editor (manual), in order
Apply any not yet applied:
- `059_marketing_hub.sql` (shipped in #57)
- `060_marketing_hub_fe_alignment.sql`
- `061_marketing_post_image.sql`
- `062_schema_migrations.sql` (the tracking table)
- `063_daily_active_visitors.sql` (DAU growth tracker RPC)

**Audit — what's still missing?** Paste this and apply anything that reports MISSING:

```sql
select 'marketing_posts.image_url' as object,
       case when exists (
         select 1 from information_schema.columns
         where table_schema='public' and table_name='marketing_posts' and column_name='image_url'
       ) then 'OK' else '❌ MISSING (run 061)' end as status
union all
select 'marketing_content.content_type',
       case when exists (
         select 1 from information_schema.columns
         where table_schema='public' and table_name='marketing_content' and column_name='content_type'
       ) then 'OK' else '❌ MISSING (run 060)' end
union all
select 'marketing_posts table',
       case when to_regclass('public.marketing_posts') is not null
       then 'OK' else '❌ MISSING (run 059)' end;
```

---

## D. Buffer / Instagram setup

1. In Buffer, connect your channels (Instagram, Facebook, X, LinkedIn).
2. Get a personal API token at https://developers.buffer.com → set `BUFFER_API_TOKEN`.
3. In the admin → Marketing Hub → Social Media tab, confirm your channels list.
4. **Instagram requires an image.** In the post form, set the **Image URL** to a
   public **JPG/PNG** (e.g. a generated graphic hosted at `https://nurserymatch.com/...`).
   The app blocks Instagram posts that have no image.
   - Note: the SVGs in `frontend/public/instagram/` are templates, not directly
     postable to IG — export them to PNG/JPG and host them first.
5. Verify field names against the live Buffer GraphQL API on your first real post
   (the public docs blocked automated verification during development).

---

## E. Post-deploy verification checklist

- [ ] `GET /api/v1/health` returns 200 (Render API up)
- [ ] Admin → Jobs panel starts showing `job_runs` rows as crons fire
- [ ] Admin → Marketing Hub → Social: channels load; a test post reaches Buffer
- [ ] A test Instagram post with an image succeeds
- [ ] Plausible dashboard receives a pageview
- [ ] Sentry receives a test event (frontend + backend)
- [ ] Enquiry form submits with Turnstile enabled

---

## F. Still outstanding (tracked in ROADMAP.md)

- Social analytics sync (impressions/engagement currently always 0)
- AI Content tab "Post to Buffer" needs a channel picker
- `job_runs` retention/prune job
- Admin job-health summary widget
- Solicitor review of Terms/Privacy before scaling paid acquisition
