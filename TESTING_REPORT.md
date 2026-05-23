# NurseryMatch — Testing & Security Report
Date: 2026-05-23

---

## Test Results

| Suite | Tests | Files | Status |
|-------|-------|-------|--------|
| Frontend (Vitest) | 117/117 passed | 15 test files | All passing |
| Backend (Vitest) | 401/401 passed | 50 test files | All passing |

**Total: 518/518 tests passing (100%)**

---

## Dependency Audit

### Backend — 20 vulnerabilities

| Severity | Count | Key Packages |
|----------|-------|--------------|
| Critical | 0 | — |
| High | 5 | axios (15 advisories), path-to-regexp, picomatch, undici, nodemailer |
| Moderate | 15 | brace-expansion, esbuild/vite (dev only), follow-redirects, postcss, qs/express, uuid, ws |

**Most impactful:** `axios 1.x` has 15 advisories (SSRF, prototype pollution, CRLF injection, DoS). Fix available via `npm audit fix`.

**Action required:**
- `npm audit fix` resolves axios, brace-expansion, follow-redirects, path-to-regexp, picomatch, postcss, qs, undici, ws
- `npm audit fix --force` needed for nodemailer (breaking: 8.0.4 -> 8.0.7) and uuid/node-cron

### Frontend — 17 vulnerabilities

| Severity | Count | Key Packages |
|----------|-------|--------------|
| Critical | 1 | next 14.1.0 (26 advisories — SSRF, cache poisoning, DoS, auth bypass, XSS) |
| High | 10 | axios, fast-uri, flatted, glob, minimatch, picomatch |
| Moderate | 6 | brace-expansion, follow-redirects, postcss, uuid, ws |

**Most impactful:** `next 14.1.0` is critically outdated with 26 known vulnerabilities including authorization bypass (CVE GHSA-f82v-jwr5-mffw), SSRF, and multiple DoS vectors. Upgrading to Next.js 14.2.35+ resolves all.

---

## Security Findings

### Strengths

1. **Helmet.js active** — full suite of security headers applied: CSP, HSTS, X-Frame-Options (DENY), X-Content-Type-Options, Referrer-Policy, X-XSS-Protection
2. **Redundant security headers** — manual layer on top of Helmet ensures X-Frame-Options DENY and HSTS even if Helmet defaults change
3. **Rate limiting configured** — 300 req/15min per IP on all public endpoints (nurseries, areas, properties, overlays, schools, public markdown)
4. **CORS properly scoped** — public read-only endpoints allow `origin: *`; auth-protected routes restricted to known origins (nurserymatch.com, Vercel preview, localhost in dev)
5. **Admin routes role-gated** — all `/api/v1/admin/*` routes use `requireRole('admin')` middleware
6. **Ingest routes protected** — `/api/v1/ingest/*` uses `express-basic-auth` with env-var credentials
7. **No hardcoded secrets found** — grep for `sk_live`, `sk_test`, and hardcoded passwords returned zero results
8. **All secrets in env vars** — SUPABASE keys, STRIPE keys, ADMIN credentials, SENTRY DSN all sourced from `process.env`
9. **`.env` files gitignored** — six patterns in `.gitignore` covering `.env`, `.env.local`, `.env.production`, `backend/.env`, `frontend/.env.local`
10. **No actual `.env` files in repo** — confirmed no `.env` files exist outside of `.env.example` templates
11. **Parameterized queries** — all database access via Supabase client `.from()` / `.rpc()` (no raw SQL string concatenation)
12. **SQL LIKE escaping** — admin search uses `escapeLike()` utility to prevent LIKE injection
13. **HTML escaping in emails** — `escapeHtml()` used on all user-derived data in email templates
14. **Trust proxy set to 1** — correctly trusts only the first proxy hop for accurate client IP in rate limiting
15. **Graceful shutdown** — SIGTERM/SIGINT handlers with 10s drain timeout
16. **Global error handlers** — unhandledRejection and uncaughtException are caught and logged
17. **Structured logging** — pino with request ID tracking, PII redaction in serializers
18. **Sentry integration** — error tracking with Express error handler setup
19. **Request ID correlation** — X-Request-Id propagated in responses for support debugging
20. **Frontend env vars scoped** — only `NEXT_PUBLIC_*` vars exposed to client code; one safe `NODE_ENV` check in ErrorBoundary

### Findings

| # | Severity | Finding | Location | Recommendation |
|---|----------|---------|----------|----------------|
| 1 | **CRITICAL** | Next.js 14.1.0 has 26 known vulnerabilities including authorization bypass, SSRF, cache poisoning, and multiple DoS vectors | `frontend/package.json` | Upgrade to `next@14.2.35` or later immediately. This is the single highest-priority fix. |
| 2 | **HIGH** | `axios` has 15 known vulnerabilities (SSRF, prototype pollution, CRLF injection, DoS) in both backend and frontend | `backend/package.json`, `frontend/package.json` | Run `npm audit fix` in both packages to update to patched version |
| 3 | **HIGH** | `nodemailer` has 4 vulnerabilities (SMTP command injection, DoS, email routing confusion) | `backend/package.json` | Update to `nodemailer@8.0.7+` (`npm audit fix --force`) |
| 4 | **HIGH** | `undici` has 6 vulnerabilities (HTTP smuggling, WebSocket DoS, CRLF injection) | `backend/package.json` | Run `npm audit fix` to update |
| 5 | **MEDIUM** | Blog/guide markdown rendered via `dangerouslySetInnerHTML` without sanitization library | `frontend/app/guides/[slug]/page.tsx:156` | Content is admin-authored from filesystem markdown files (not user input), so risk is low. However, if blog content ever comes from user input or a CMS, add DOMPurify or similar. The custom `inlineFormat()` does basic URL protocol validation but does not escape HTML entities in text content. |
| 6 | **LOW** | 22 uses of `dangerouslySetInnerHTML` across frontend — all for JSON-LD structured data or admin-authored content | Multiple pages (layout.tsx, nursery/[urn], nurseries-in/[district], faq, guides, compare-nurseries, nurseries-in-town) | Acceptable pattern for JSON-LD `<script>` tags and static content. No user-controlled input flows into any of these. |
| 7 | **LOW** | `express` and `body-parser` depend on vulnerable `qs` (DoS with null entries in comma-format arrays) | `backend/package.json` (transitive) | Run `npm audit fix` to resolve |
| 8 | **LOW** | ESLint warnings: 10 React Hook dependency warnings in frontend build | `compare/page.tsx`, `MapLibreMap.tsx`, `SessionProvider.tsx`, `StreetViewPanorama.tsx`, `provider/[urn]/slots/page.tsx` | Fix missing useEffect/useCallback dependencies to prevent stale closure bugs |
| 9 | **INFO** | JSON body parsing allows up to 8MB (`express.json({ limit: '8mb' })`) | `backend/src/app.js:234` | Intentional for base64 photo uploads. Acceptable with rate limiting in place, but monitor for abuse. |
| 10 | **INFO** | Stripe webhook correctly placed before `express.json()` to receive raw body | `backend/src/app.js:227-231` | Good practice — no action needed |

---

## Performance

### Build Sizes

| Route | Size | First Load JS | Status |
|-------|------|---------------|--------|
| `/` (homepage) | 4.23 kB | 101 kB | OK |
| `/search` | 12.8 kB | 169 kB | OK |
| `/nursery/[urn]` | 25.1 kB | 181 kB | OK |
| `/compare` | 8.1 kB | 160 kB | OK |
| `/admin` | 9.38 kB | 154 kB | OK |
| `/quiz` | 7.45 kB | 153 kB | OK |
| `/shortlist` | 5.47 kB | 155 kB | OK |
| `/assistant` | 5.34 kB | 155 kB | OK |
| `/find-an-area` | 4.84 kB | 154 kB | OK |
| `/provider/reports` | **118 kB** | **256 kB** | **OVER THRESHOLD** |
| `/pricing` | 6.91 kB | 145 kB | OK |
| Shared JS (all pages) | — | 84.6 kB | OK |

**Pages over 200 kB first-load JS: 1**

`/provider/reports` at **256 kB** first-load JS (118 kB page-specific) exceeds the 200 kB threshold. This page likely bundles charting/reporting libraries. Consider:
- Dynamic importing chart components with `next/dynamic`
- Code-splitting report sections
- Lazy-loading data visualization libraries

All other pages are under 181 kB first-load JS, which is acceptable.

### Caching Strategy

| Resource | Cache Policy | TTL |
|----------|-------------|-----|
| Search results (API) | `Cache-Control: public, max-age=300` | 5 minutes |
| Nursery detail (API) | `Cache-Control: public, max-age=3600` | 1 hour |
| Area detail (API) | `Cache-Control: public, max-age=3600` | 1 hour |
| Billing tiers (API) | `Cache-Control: public, max-age=86400` | 24 hours |
| Health endpoint | `Cache-Control: no-cache` | None |
| Non-GET requests | `Cache-Control: no-store` | None |
| Search results (in-memory) | NodeCache | 1 hour (stdTTL: 3600) |
| Postcode geocoding (in-memory) | NodeCache | 24 hours (stdTTL: 86400) |
| Autocomplete (in-memory) | NodeCache | 60 seconds |
| Similar nurseries (in-memory) | NodeCache | 1 hour |
| Blog posts (in-memory) | Custom cache | 5 minutes |

Caching is well-structured with appropriate TTLs for data freshness vs. performance.

### Recommendations (Prioritized)

1. **[P0 — CRITICAL] Upgrade Next.js** — `next@14.1.0` to `14.2.35+`. This closes 26 CVEs including an authorization bypass that can affect middleware-based auth.

2. **[P0 — HIGH] Run `npm audit fix`** in both `backend/` and `frontend/`. This resolves axios, undici, qs, picomatch, brace-expansion, follow-redirects, postcss, ws, and path-to-regexp with non-breaking updates.

3. **[P1 — HIGH] Update nodemailer** to 8.0.7+ (breaking change — test email sending after upgrade). Fixes SMTP command injection and DoS vulnerabilities.

4. **[P2 — MEDIUM] Add HTML sanitization** to the guide/blog markdown renderer. Even though content is currently admin-authored, adding DOMPurify as a defense-in-depth measure prevents future XSS if content sources change.

5. **[P2 — MEDIUM] Reduce `/provider/reports` bundle size** — currently 256 kB first-load JS. Use `next/dynamic` with `ssr: false` for chart components.

6. **[P3 — LOW] Fix React Hook dependency warnings** — 10 warnings in 5 components. These can cause stale closure bugs in production.

7. **[P3 — LOW] Consider adding CSP nonce** for inline scripts. The current CSP from Helmet uses `'self'` for scripts but JSON-LD uses `dangerouslySetInnerHTML`. Next.js has built-in nonce support.

---

## Summary

The NurseryMatch codebase demonstrates strong security fundamentals: all 518 tests pass, secrets management is clean, auth/authz is properly layered, and the API has appropriate rate limiting, CORS, and security headers. The primary concern is **dependency freshness** — Next.js 14.1.0 is critically outdated and `axios` needs patching in both packages. Running `npm audit fix` in both directories and upgrading Next.js would resolve 35 of 37 total vulnerabilities.
