# NurseryMatch — Live Delivery Checklist

> **Purpose:** single source of truth for outstanding work, deployment, and
> go-live actions. Updated as items move. Owned jointly by Byron + Claude.
> Legend: ✅ done · 🟡 in progress · ⬜ not started · 👤 needs Byron (account/secret/click)

_Last updated: 2026-06-06 — branch `claude/activity-stats-google-alignment-aY72L` (PR #58)_

---

## 0. Deployment model (Render + Vercel + Supabase only — NO Railway)

- Frontend → **Vercel** (prod = `main`, preview = PR branches)
- Backend API + Worker → **Render** (Docker, from `main`)
- DB → **Supabase** (migrations applied manually in SQL editor)

---

## 1. Supabase migrations (run in order, in the SQL editor)

| Migration | What | Status |
|-----------|------|--------|
| `059_marketing_hub.sql` | Marketing Hub base tables | 👤 apply if not already (shipped in #57) |
| `060_marketing_hub_fe_alignment.sql` | UI-shaped columns + backfill | 👤 apply after merge |
| `061_marketing_post_image.sql` | `image_url` on marketing_posts (Instagram) | 👤 apply after merge |

Audit query (paste in SQL editor) reports what's still missing — see `DEPLOYMENT_RUNBOOK.md`.

---

## 2. Engineering backlog

### 2.1 Marketing / Buffer
- ✅ Buffer GraphQL service (channels + createPost), text posts
- ✅ FE ↔ BE contract aligned (migration 060)
- ✅ **Image posts (Instagram)** — `imageUrl` on createPost + UI field + storage (061)
- ✅ AI Content tab "Post to Buffer" — channel picker + optional image + success state
- ⬜ Social analytics sync (impressions/engagement stay 0) — **blocked: needs the
  verified Buffer analytics GraphQL query, only discoverable with a live token**
- 👤 Verify Buffer GraphQL field names against live API once token is set
- 👤 Buffer account: connect Instagram/Facebook/X channels; note IG needs an image + may use reminders vs direct publish

### 2.2 Jobs / scheduling (Render)
- ✅ `runTrackedJob` wraps crons → visible in admin Jobs panel
- ✅ Crime cron implemented; sitemap cron removed; weekly digests deduped
- ✅ **Render worker service** (render.yaml) so worker-only jobs actually run
- ✅ Scheduling consolidated on the worker (added `aggregate_areas`; retired overlapping Render crons → no double-runs)
- ✅ `job_runs` retention/prune job (daily, keepDays=30)
- ✅ Admin job-health summary endpoint (`GET /api/v1/admin/jobs/summary`)

### 2.3 Platform / housekeeping
- ✅ Pre-existing lint warnings cleared (eslint reports 0 problems)
- ⬜ Migration tracking table + runner — **needs a decision** (changes the manual
  Supabase SQL-editor workflow); not started to avoid an unrequested mechanism
- ⬜ `FRESH_INSTALL_MIGRATION.sql` regenerate vs 060/061 (low priority; only affects brand-new installs)

## 3. Integrations — wired in code ✅, need secrets set 👤

| Integration | Code status | Action for Byron |
|-------------|-------------|------------------|
| **Plausible** | ✅ script + custom events | Set `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` (Vercel) |
| **Sentry** | ✅ client/server/edge configs | Set `NEXT_PUBLIC_SENTRY_DSN` (Vercel) + `SENTRY_DSN` (Render) |
| **Cloudflare Turnstile** | ✅ widget + verify middleware (no-op until set) | Set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (Vercel) + `TURNSTILE_SECRET_KEY` (Render) |
| **Google Ads** | ✅ gtag + conversions + campaign API | Set `NEXT_PUBLIC_GOOGLE_ADS_ID` (Vercel) + `GOOGLE_ADS_*` (Render) |
| **Buffer** | ✅ service | Set `BUFFER_API_TOKEN` (+ optional `BUFFER_ORGANIZATION_ID`) (Render) |
| **Resend (email)** | ✅ email service | Set `RESEND_API_KEY` (Render) |
| **Anthropic (AI)** | ✅ claude service | Set `ANTHROPIC_API_KEY` (Render) |

## 4. Legal — pages exist ✅, content review 👤

- ✅ `/privacy`, `/terms`, `/refund`, `/about`, `/contact`, Cookie banner, OGL attribution, DPIA doc
- 👤 Solicitor review of Terms + Privacy before scaling paid acquisition

## 5. Go-live sequence (see DEPLOYMENT_RUNBOOK.md)

1. 👤 Set all secrets (section 3) in Render + Vercel
2. 👤 Merge PR #58 → `main`
3. 👤 Run migrations 059→061 in Supabase
4. 👤 Apply updated Render blueprint (creates worker service)
5. ✅ CI + post-deploy smoke test gate the deploy
6. 👤 Verify: admin Jobs panel populates; Buffer "test connection"; a test post to Instagram
