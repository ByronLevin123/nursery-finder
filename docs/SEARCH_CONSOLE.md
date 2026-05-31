# Google Search Console integration

This connects NurseryMatch to the Google Search Console API so organic search
**clicks** and **impressions** appear on the provider and admin analytics
dashboards, alongside the first-party activity stats.

> **Why the numbers won't match.** A Search Console "click" is the entry from a
> Google search result to the site — counted once, on the landing page. A
> "Profile view" is an on-site pageview of a nursery profile. One Google click
> can become several profile views (or zero), and direct / referral / social
> traffic never appears in Search Console at all. Search Console data also lags
> 2–3 days. The dashboards say this in-context; don't expect the figures to
> reconcile 1:1.

The feature is **off by default** — the Google cards stay hidden until the
environment variables below are set, so the dashboards render exactly as before
until you switch it on.

---

## 1. Confirm your Search Console property type

The most important value is `GSC_SITE_URL`, and it must match how the property
is **verified** in [Search Console](https://search.google.com/search-console)
*exactly*. There are two kinds:

| Property type | `GSC_SITE_URL` value | Notes |
|---------------|----------------------|-------|
| **Domain** (recommended) | `sc-domain:nurserymatch.com` | Covers all subdomains + http/https. Verified via a DNS TXT record. |
| **URL-prefix** | `https://nurserymatch.com/` | Exact origin only. Note the **trailing slash** and the scheme. |

Open Search Console → the property selector (top-left). A Domain property shows
just `nurserymatch.com`; a URL-prefix property shows the full `https://…` URL.
If you have both, prefer the Domain property.

---

## 2. Create OAuth credentials (one-time, ~10 min)

You only need a **read-only** refresh token. Reuse the existing Google Cloud
project you set up for the Ads / Places APIs if you have one.

1. **Google Cloud Console → APIs & Services → Library** → search
   "**Search Console API**" → **Enable**.
2. **APIs & Services → OAuth consent screen**
   - If not already configured: user type **External**, fill app name + your
     email, **Save**.
   - Under **Scopes**, you don't need to pre-add anything (we request the scope
     at token time). Under **Test users**, add the Google account that owns the
     Search Console property.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**
   - Application type: **Web application**.
   - Authorised redirect URIs: add `https://developers.google.com/oauthplayground`
     (so you can mint the token in the next step).
   - **Create** → copy the **Client ID** and **Client secret**.

> You can reuse `GOOGLE_ADS_CLIENT_ID` / `GOOGLE_ADS_CLIENT_SECRET` if those are
> already set — the backend falls back to them when the `GSC_*` ones are blank.
> But the **refresh token is scope-specific**, so you still need to generate a
> new one for `webmasters.readonly` below.

---

## 3. Generate the refresh token

Using the [OAuth 2.0 Playground](https://developers.google.com/oauthplayground):

1. Click the **gear icon** (top-right) → tick **Use your own OAuth credentials**
   → paste the **Client ID** and **Client secret** from step 2.
2. In the left panel, **Step 1**, paste this scope into the "input your own
   scopes" box and click **Authorise APIs**:
   ```
   https://www.googleapis.com/auth/webmasters.readonly
   ```
3. Sign in as the account that owns the Search Console property and grant access.
4. **Step 2** → **Exchange authorization code for tokens**.
5. Copy the **Refresh token** (starts with `1//…`). This is long-lived.

> If the consent screen is still in **Testing** mode, refresh tokens can expire
> after 7 days. For a stable token, either **Publish** the OAuth consent screen
> (no Google verification is required for an internal read-only scope you own),
> or use a service account with domain delegation (more involved — ask if you
> want that route instead).

---

## 4. Set the environment variables

On the backend host (Railway), set:

```bash
# Must match the verified property EXACTLY — see the table in step 1.
GSC_SITE_URL=sc-domain:nurserymatch.com

# Client id/secret — omit these two if GOOGLE_ADS_CLIENT_ID/SECRET are already set.
GSC_CLIENT_ID=xxxx.apps.googleusercontent.com
GSC_CLIENT_SECRET=GOCSPX-xxxx

# The webmasters.readonly-scoped refresh token from step 3.
GSC_REFRESH_TOKEN=1//xxxx
```

Redeploy / restart the API. That's it — the Google cards appear on:

- **Provider analytics** (`/provider/analytics`) — site-wide + per-nursery.
- **Admin dashboard** (`/admin`) — site-wide totals.

---

## 5. Verify

```bash
# Admin-only endpoint (needs an admin bearer token). Returns site totals
# + the top nursery profiles by organic clicks.
curl -s https://nursery-finder-api.railway.app/api/v1/admin/search-console/site \
  -H "Authorization: Bearer <ADMIN_TOKEN>" | jq
```

Expected when configured:

```json
{
  "configured": true,
  "window_days": 28,
  "site": { "clicks": 53, "impressions": 1840, "ctr": 2.88, "position": 14.2 },
  "nurseries": [ { "urn": "EY123456", "clicks": 7, "impressions": 210, "ctr": 3.33, "position": 9.1 } ]
}
```

If `configured` is `false`, one of the four env vars is missing. If it's `true`
but `site` is `null` / all zeros, Google simply has no data for that property /
window yet (newly verified properties take a few days to populate).

---

## How it works (for maintainers)

- `backend/src/services/searchConsole.js` — the API client. OAuth2
  refresh-token flow (same pattern as `googleAdsService.js`), results cached
  6 hours (Search Console only updates ~daily), per-nursery rows aggregated by
  parsing the `/nursery/{urn}` page path. Average position is impression-weighted
  so aggregation across pages is statistically sound. Every export returns
  `null` / an empty `Map` when unconfigured — it never throws into a request.
- `backend/src/routes/searchConsole.js` — admin-only `GET /site`.
- `backend/src/routes/providerAnalytics.js` — adds `search_console` to each
  nursery and a top-level `search_console` block to `/analytics`.

The trailing window is 28 days, set via `GSC_WINDOW_DAYS` in
`providerAnalytics.js` (the admin endpoint accepts `?days=` 1–90).
