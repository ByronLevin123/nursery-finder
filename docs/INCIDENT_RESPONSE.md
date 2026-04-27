# NurseryMatch — Incident response runbook

What to do when production breaks. Written for a solo on-call (Byron) so
the steps are pragmatic, not enterprise.

Last reviewed: 2026-04-27

---

## 1 · Before you do anything

1. **Acknowledge** that there's an incident. Don't fix in the dark.
2. **Open a comms channel** — even if it's a note to yourself in
   Notion/Apple Notes. Capture the timestamp and what users are seeing.
3. **Set the status page** to "investigating" if the outage is visible
   to users. UptimeRobot lets you do this in two clicks.

---

## 2 · Triage (5 min)

Run through these tabs in order. Stop at the first one that explains the
symptom.

| Tab | URL | What to look for |
|---|---|---|
| **Status page** | https://stats.uptimerobot.com/… | Health endpoint up/down? |
| **Sentry** | https://sentry.io/organizations/… | Spike in errors? Which service? |
| **Render logs** | https://dashboard.render.com → backend → Logs | 5xx, OOM, deploy failure |
| **Vercel deployments** | https://vercel.com/… | Recent deploy failed or rolled back? |
| **Supabase status** | https://status.supabase.com | Their incident? |
| **Resend / Stripe / Cloudflare status** | each provider's status page | Third-party outage? |

Most outages are one of:
- A bad deploy (Render or Vercel) → roll back
- A third-party provider (Supabase, Stripe, Resend) → wait + post status
- A traffic spike hitting a rate limit or DB connection cap → scale or
  loosen the limit
- An expired secret / DNS record → fix the config

---

## 3 · Common scenarios

### "Site is down / 500 errors"

1. Visit `https://nursery-finder-6u7r.onrender.com/api/v1/health` —
   if 200, frontend issue; if 5xx, backend issue.
2. Check Render → Logs for the last 5 minutes. Filter on `level:error`.
3. If the 5xx started after a deploy: **roll back** in Render
   (Deployments → previous deploy → Rollback).
4. If DB is down: check Supabase status, run the connection check via
   `psql` or the Supabase SQL editor.

### "Search / Find-an-Area returning 429"

The IP-based rate limiter (300/15min/IP) is firing. Most likely cause:
`trust proxy` setting was lost (so all users share one IP bucket).

1. Check `backend/src/app.js` line ~83 — `app.set('trust proxy', 1)` must
   be present.
2. Restart the Render service. The in-memory rate-limit map clears on
   restart, granting everyone fresh budget.
3. If still 429-ing under low traffic, check the rate limit config and
   bump if needed.

### "Password reset email never arrives"

1. Confirm Resend domain is still verified at resend.com → Domains.
2. Check Render env: `EMAIL_FROM` must end in `@nurserymatch.com` (a
   verified domain).
3. Check Supabase Auth → Logs for the auth attempt; the email send is
   triggered there if Supabase manages the email (default).
4. If Supabase is using its own email provider (default), check Supabase
   Auth Email Templates — Site URL must be `https://nurserymatch.com`.
5. As a workaround, generate a one-time recovery link from Supabase
   dashboard (Auth → Users → user → "Send password recovery").

### "Stripe webhook events failing"

1. Stripe Dashboard → Developers → Webhooks → endpoint → recent deliveries.
   See the response body of failed deliveries.
2. Check Render logs for `/api/v1/billing/webhook` requests.
3. Common cause: `STRIPE_WEBHOOK_SECRET` env var missing or rotated.
   Roll a new secret in Stripe and update Render env.
4. Replay failed events from the Stripe dashboard once fixed.

### "Database connections exhausted"

1. Confirm Supabase connection string in Render env points at the
   **Supavisor transaction-mode pooler** (not the direct Postgres host).
2. If yes, upgrade Supabase pooler tier or scale Render service down to
   shed load while you investigate.
3. Look for runaway queries in Supabase → Database → Query Performance.

### "Cookie banner / Turnstile / Sentry not loading"

1. Check `frontend/vercel.json` CSP header — does `connect-src` /
   `script-src` / `frame-src` include the third-party domain?
2. Browser console will show CSP violations. Add the domain to the
   relevant directive in `vercel.json` and redeploy.

### "AI assistant or smart search broken"

1. Confirm `ANTHROPIC_API_KEY` is set in Render env.
2. Check console.anthropic.com for usage / billing issues.
3. The site falls back gracefully — search still works without AI, just
   without the smart-intent parsing.

---

## 4 · Roll back

| Service | How |
|---|---|
| Vercel | Deployments → previous green → "Promote to Production" |
| Render | Service → Deployments → previous → "Rollback" |
| Supabase migrations | `npx supabase db reset` against a staging project + verify; never on prod without a backup |

---

## 5 · Communicate

If users were affected:

1. Post a **status page incident** with what's happening + ETA.
2. Tweet/post if you have an active channel and the outage was >15 min.
3. After resolution: **post-mortem note** in `docs/incidents/YYYY-MM-DD.md`
   with timeline, root cause, what fixed it, what you'll do to prevent
   recurrence. Keep it short — even 200 words is enough.

---

## 6 · After the dust settles

- [ ] Update status page to "resolved".
- [ ] Sentry: mark the issue as resolved (or pin it as a recurring one).
- [ ] If the bug was code-level: ship the fix to main, with a test that
      would've caught it.
- [ ] If the bug was config-level: document the config in `.env.example`
      so the next environment doesn't trip on it.
- [ ] Update this runbook if a new failure mode surfaced — add a
      Section 3 entry so the next-you knows what to do.

---

## Useful commands

```bash
# Hit health from a clean network
curl -s https://nursery-finder-6u7r.onrender.com/api/v1/health | jq

# Tail Render logs (requires render CLI)
render logs --tail backend-service-id

# Check DNS quickly
dig +short nurserymatch.com A
dig +short send.nurserymatch.com TXT
dig +short _dmarc.nurserymatch.com TXT

# Smoke the auth login mediator (replace email)
curl -sX POST https://nursery-finder-6u7r.onrender.com/api/v1/auth/lockout?email=YOU
```

---

## On-call contacts

- **Vercel** support: support page in dashboard
- **Render** support: dashboard → Help
- **Supabase** support: dashboard → Help; Discord for community
- **Stripe** support: dashboard → Help (24/7 chat for paying accounts)
- **Resend** support: support@resend.com
- **Cloudflare** support: dashboard → Support (free tier = community only)

---

## Service inventory

Keep this fresh — when you rotate a service, update here.

| Service | URL / ID | Where keys live |
|---|---|---|
| Frontend | nurserymatch.com | Vercel project |
| Backend API | nursery-finder-6u7r.onrender.com | Render service |
| Backend worker | (separate Render service) | Same env as API |
| Database | gybwptpntmpjjwmgfhnn.supabase.co | Supabase project |
| Email (transactional) | resend.com | RESEND_API_KEY |
| Newsletter audience | resend.com Audiences | RESEND_AUDIENCE_ID |
| Billing | stripe.com (live) | STRIPE_SECRET_KEY |
| AI | console.anthropic.com | ANTHROPIC_API_KEY |
| Spam protection | dash.cloudflare.com | TURNSTILE_*_KEY |
| Domain | namecheap.com | n/a |
| Inbound email | privateemail.com | n/a |
| Error tracking | sentry.io | SENTRY_DSN |
| Uptime + status | uptimerobot.com | n/a |
| Analytics | plausible.io | n/a |
