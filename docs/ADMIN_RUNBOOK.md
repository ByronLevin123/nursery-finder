# NurseryMatch — Admin Runbook

Covers routine operations, troubleshooting, and data maintenance.
For incidents see `docs/INCIDENT_RESPONSE.md`. For support triage see `docs/SUPPORT_TRIAGE.md`.

Last reviewed: 2026-05-29

---

## 1. Regular Data Refresh

### Monthly full data cycle (1st of month)

The worker cron runs Ofsted at 2am on the 1st automatically. Verify and fill gaps:

- [ ] Check it ran: Admin > Data Ingest > Ofsted Import > History
- [ ] If it didn't run or failed: click **Run All Steps** (or run Ofsted Import manually)
- [ ] Expected time: ~20–30 minutes for the full cycle
- [ ] Spot check: search for "SW11" and verify nursery count is reasonable (~50+)

**Run All Steps** chains everything in the right order:
```
Layer 0: Ofsted + Schools + Crime + IMD + Google (parallel)
Layer 1: Geocode Nurseries + Geocode Schools
Layer 2: Aggregate Areas
Layer 3: Family Scores
Layer 4: Snapshot Reports
```

### Weekly checks (Monday morning, 10 minutes)

- [ ] Admin dashboard — check data quality warnings
- [ ] "Nurseries without location" should be trending down (run Geocode if >5%)
- [ ] Review any pending claims (Admin > Claims)
- [ ] Review any flagged reviews (Admin > Reviews)
- [ ] Check Sentry for new errors (link in Admin > Status)

### Nightly cron jobs (automated — just verify)

| Job | Schedule | What it does |
|-----|----------|-------------|
| Geocoding | 3am daily | 500 nurseries + 200 schools |
| Google Places | 4am daily | Enrich 100 nurseries with ratings/photos |
| Google refresh | Sun 5am | Re-check 200 stale nurseries |
| Dimension scores | 4:30am daily | Recompute quality/cost/availability scores |
| Family scores | 5am daily | Recompute district family scores |
| Reports snapshot | 6am daily | Capture metrics for trend charts |
| Drip emails | Every 15min | Process signup email sequences |
| Visit reminders | 8am daily | Notify parents about tomorrow's visits |
| Saved search alerts | 9am daily | New-nursery alerts for saved searches |

**How to verify cron jobs ran:**
1. Admin > Data Ingest > click "History" next to any step
2. Or SQL: `SELECT * FROM job_runs ORDER BY started_at DESC LIMIT 20;`

---

## 2. Troubleshooting Ingest Failures

### Ofsted returns 0 records

1. Check if GOV.UK changed the CSV URL — visit
   [gov.uk/government/statistical-data-sets](https://www.gov.uk/government/statistical-data-sets/childcare-providers-and-inspections-management-information)
2. Download the CSV manually and check column headers match `ofstedIngest.js`
3. If GOV.UK is down: wait and retry — existing data remains usable
4. The URL auto-detection is in `backend/src/services/ofstedIngest.js` (`findCurrentCsvUrl`)

### Geocoding stuck / returning 0

1. All nurseries already geocoded? Check "Nurseries without location" — if 0, that's fine
2. Postcodes.io down? Free public service, occasional outages — wait and retry
3. Check Railway logs for "geocoding failed" messages
4. Manual fix: `POST /api/v1/ingest/geocode?limit=500`

### Schools ingest fails

1. Default GIAS CSV URL may have changed — it's in `backend/src/services/schoolsIngest.js`
2. Download from [get-information-schools.service.gov.uk/Downloads](https://get-information-schools.service.gov.uk/Downloads)
3. Supply the CSV URL via the admin panel or in the request body

### Crime/IMD data fails

1. Police API or ONS may be rate-limited or down
2. These are non-critical — family scores will use stale data
3. Retry in a few hours: `POST /api/v1/ingest/crime` or `POST /api/v1/ingest/imd`

### Google Places sync failing

1. Check `GOOGLE_PLACES_API_KEY` is valid (Admin > Status)
2. Check Google Cloud Console for quota/billing issues
3. Not critical — nurseries display fine without Google ratings

---

## 3. Database Maintenance

### Data quality checks (run in Supabase SQL editor)

```sql
-- Nurseries without locations (should be <5% of total)
SELECT COUNT(*) AS no_location FROM nurseries WHERE lat IS NULL AND registration_status = 'Active';

-- Total active nurseries by provider type
SELECT provider_type, COUNT(*) FROM nurseries
WHERE registration_status = 'Active' GROUP BY provider_type ORDER BY count DESC;

-- Districts with no family score
SELECT district FROM postcode_areas WHERE family_score IS NULL LIMIT 20;

-- Nurseries with stale Google data (>90 days)
SELECT COUNT(*) FROM nurseries
WHERE google_updated_at < NOW() - INTERVAL '90 days' AND registration_status = 'Active';

-- Most recent job runs
SELECT job_type, status, started_at, completed_at,
  EXTRACT(EPOCH FROM (completed_at - started_at))::int AS seconds
FROM job_runs ORDER BY started_at DESC LIMIT 20;

-- Active subscriptions and MRR
SELECT tier, COUNT(*),
  SUM(CASE WHEN tier='pro' THEN 29 WHEN tier='premium' THEN 79 ELSE 0 END) AS mrr
FROM provider_subscriptions WHERE status = 'active' GROUP BY tier;
```

### Fix missing locations

1. Run **Geocode Nurseries** from admin panel (2000 per batch)
2. For specific nurseries without valid postcodes:
   ```sql
   SELECT urn, name, postcode FROM nurseries WHERE lat IS NULL LIMIT 20;
   -- Fix the postcode, then re-run geocoding
   UPDATE nurseries SET postcode = 'XX1 1XX' WHERE urn = '123456';
   ```

### Check for duplicates

```sql
SELECT postcode, name, COUNT(*) FROM nurseries
GROUP BY postcode, name HAVING COUNT(*) > 1;
```

---

## 4. Billing / Stripe Troubleshooting

### Webhook failures

1. Stripe Dashboard > Developers > Webhooks > your endpoint
2. Check "Recent deliveries" for failures
3. Common cause: `STRIPE_WEBHOOK_SECRET` rotated or missing
4. Fix: update the secret in Railway env vars, restart service
5. Replay failed events from Stripe dashboard

### Subscription not provisioning after checkout

1. Check Stripe > Payments > find the checkout session
2. Check if webhook was received (Stripe > Webhooks > deliveries)
3. If webhook failed: fix config and replay the event
4. If webhook succeeded but DB not updated: check Railway logs for errors around `checkout.session.completed`
5. Manual fix: INSERT into `provider_subscriptions` via Supabase SQL

### Refund process

1. Stripe Dashboard > Payments > find the charge > Refund
2. Update subscription status:
   ```sql
   UPDATE provider_subscriptions SET status = 'cancelled' WHERE user_id = '<id>';
   ```

---

## 5. Scheduled Maintenance

### Database migrations

1. Write migration file: `database/migrations/NNN_description.sql`
2. Test in Supabase SQL editor on a staging project first
3. Run in production Supabase SQL editor
4. Deploy backend code that depends on the new schema
5. Verify: `curl https://nursery-finder-api.railway.app/api/v1/health`

### Rollback procedure

- **Backend**: Railway > Deployments > Rollback to previous
- **Frontend**: Vercel > Deployments > Promote previous
- **Database**: No easy rollback — always test migrations first
- Full details: `docs/INCIDENT_RESPONSE.md` Section 4

### Zero-downtime deploys

Railway and Vercel both deploy with zero downtime by default. For database migrations that might cause brief issues, do them during UK early morning (before 7am).

---

## 6. Quick Reference

### Admin panel pages

| Page | URL | What it does |
|------|-----|-------------|
| Dashboard | /admin | Stats, data quality, ingest buttons |
| Claims | /admin/claims | Approve/reject nursery claims |
| Reviews | /admin/reviews | Moderate user reviews |
| Invites | /admin/invites | Provider outreach campaigns |
| Promotions | /admin/promotions | Manage promoted listings |
| Status | /admin/status | Service health checks |

### API endpoints for manual operations

| Task | Command |
|------|---------|
| Full data refresh | `curl -X POST -u admin:pass $API_URL/api/v1/ingest/full-cycle` |
| Ofsted only | `curl -X POST -u admin:pass $API_URL/api/v1/ingest/ofsted` |
| Geocode nurseries | `curl -X POST -u admin:pass $API_URL/api/v1/ingest/geocode?limit=2000` |
| Geocode schools | `curl -X POST -u admin:pass $API_URL/api/v1/overlays/schools/geocode` |
| Health check | `curl $API_URL/api/v1/health` |
