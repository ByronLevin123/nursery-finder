# Phase 5 — Deploy to Production

**Paste into Claude Code:** `Read phases/PHASE_5_DEPLOY.md and execute it`

---

## What this phase does

Deploys the backend to Railway and the frontend to Vercel. Runs the first
Ofsted data import. Verifies everything works on live URLs. Takes 1–2 hours.

---

## Tasks

### 5.1 — Create backend/Dockerfile

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy source code
COPY src/ ./src/

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3001/api/v1/health || exit 1

# Start API (not worker — worker is a separate Railway service)
CMD ["node", "src/index.js"]
```

### 5.2 — Create backend/Dockerfile.worker

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production
COPY src/ ./src/

# Worker process — cron jobs only
CMD ["node", "src/worker.js"]
```

### 5.3 — Create railway.json (backend API service)

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "backend/Dockerfile"
  },
  "deploy": {
    "startCommand": "node src/index.js",
    "healthcheckPath": "/api/v1/health",
    "healthcheckTimeout": 30,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

### 5.4 — Create frontend/vercel.json

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/" }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
      ]
    }
  ]
}
```

### 5.5 — Create scripts/check-deploy.sh

A script Byron can run to verify everything is working after deploy:

```bash
#!/bin/bash
# Verify deployment is healthy
# Usage: API_URL=https://your-api.railway.app bash scripts/check-deploy.sh

API_URL=${API_URL:-http://localhost:3001}

echo "🔍 Checking NurseryFinder deployment..."
echo ""

# Health check
echo "1. API Health..."
HEALTH=$(curl -s "$API_URL/api/v1/health")
echo $HEALTH | python3 -m json.tool 2>/dev/null || echo $HEALTH
echo ""

# Search test
echo "2. Nursery search (SW11)..."
SEARCH=$(curl -s -X POST "$API_URL/api/v1/nurseries/search" \
  -H "Content-Type: application/json" \
  -d '{"postcode":"SW11","radius_km":2}')
TOTAL=$(echo $SEARCH | python3 -c "import sys,json; d=json.load(sys.stdin); print(f\"Found: {d['meta']['total']} nurseries\")" 2>/dev/null)
echo $TOTAL
echo ""

echo "✅ Deployment check complete"
```

### 5.6 — Tell Byron the Railway deployment steps

Print these instructions exactly:

```
== DEPLOYING BACKEND TO RAILWAY ==

1. Create a Railway account at railway.app (free)

2. Install Railway CLI:
   npm install -g @railway/cli

3. Login:
   railway login

4. Create a new project:
   railway init

   Name it: nursery-finder

5. Create two services in Railway dashboard:
   - Click "Add Service" → "Empty service" → name it "api"
   - Click "Add Service" → "Empty service" → name it "worker"

6. Link your local code to Railway:
   railway link

7. Set environment variables for the API service in Railway dashboard:
   (Go to your project → api service → Variables → Add these)

   SUPABASE_URL          = https://your-project.supabase.co
   SUPABASE_ANON_KEY     = your-anon-key
   SUPABASE_SERVICE_KEY  = your-service-role-key
   ADMIN_USER            = admin
   ADMIN_PASS            = your-strong-password
   INGEST_SECRET         = your-random-string
   NODE_ENV              = production
   PORT                  = 3001

8. Set the same variables for the worker service
   (worker needs SUPABASE_URL, SUPABASE_SERVICE_KEY, NODE_ENV)

9. Deploy:
   railway up

10. Get your API URL from Railway dashboard → api service → Settings → Domain
    It will look like: https://nursery-finder-api-production.up.railway.app

```

### 5.7 — Tell Byron the Vercel deployment steps

```
== DEPLOYING FRONTEND TO VERCEL ==

1. Push your code to GitHub first:
   git remote add origin https://github.com/yourusername/nursery-finder.git
   git push -u origin main

2. Go to vercel.com and sign in

3. Click "Add New Project" → Import your GitHub repo

4. Set the root directory to: frontend

5. Set environment variables in Vercel:
   (Project Settings → Environment Variables)

   NEXT_PUBLIC_API_URL              = https://your-railway-api-url.railway.app
   NEXT_PUBLIC_SUPABASE_URL         = https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY    = your-anon-key

6. Click Deploy

7. Your frontend will be live at: https://nursery-finder.vercel.app

8. To add a custom domain later: Project Settings → Domains → Add your domain

```

### 5.8 — Run the first Ofsted import

Once Railway API is live:

```
== FIRST DATA IMPORT ==

Run this from your terminal:

API_URL=https://your-railway-url.railway.app \
ADMIN_USER=admin \
ADMIN_PASS=your-password \
bash scripts/first-import.sh

This will:
1. Import ~50,000 active nurseries from Ofsted (takes 10-15 minutes)
2. Start geocoding (continues automatically every night at 3am)
3. Full geocoding completed in ~25 days of nightly runs

You can check progress anytime:
curl https://your-railway-url.railway.app/api/v1/health
```

### 5.9 — Production readiness checklist

Verify these before sharing publicly:

```
Pre-launch checklist — verify each item:

Frontend:
[ ] Homepage loads at your Vercel URL
[ ] Postcode search returns results
[ ] Nursery profile pages load correctly
[ ] Stale grade banner appears for old inspections
[ ] Enforcement banner appears for flagged nurseries
[ ] Privacy page is accessible at /privacy
[ ] OGL attribution visible on every page with Ofsted data
[ ] Footer links to privacy policy
[ ] Shortlist saves and persists in browser

Backend:
[ ] /api/v1/health returns { status: "ok", nursery_count: > 0 }
[ ] Search returns results with lat/lng populated
[ ] Admin routes protected (try /api/v1/ingest/ofsted without credentials — should get 401)

Data:
[ ] At least 1,000 nurseries geocoded (check health endpoint)
[ ] At least one nursery visible on map in a test search

Analytics:
[ ] Sign up at plausible.io (£9/month)
[ ] Update data-domain in app/layout.tsx to your real domain
[ ] Verify events arriving in Plausible dashboard after visiting site
```

### 5.10 — Update CLAUDE.md build status

Update the build status section in CLAUDE.md to mark phases 0-5 complete.

### 5.11 — Commit

```bash
git add -A
git commit -m "feat: phase 5 — production deployment config, Railway + Vercel"
git push origin main
```

### 5.12 — Tell Byron what to do next

```
✅ Phase 5 complete! NurseryFinder is live.

Your app is at: https://nursery-finder.vercel.app
Your API is at: https://your-railway-url.railway.app

IMPORTANT — do before sharing publicly:
1. Run the first Ofsted import using scripts/first-import.sh
2. Sign up at plausible.io and activate analytics
3. Register as a data controller at ico.org.uk (£40/year, UK GDPR requirement)

NEXT STEPS after you have 500 users:
→ Phase 6: User accounts + fee data
→ Type: Read phases/PHASE_6_V2.md and execute it

For now, share your link with friends and family who have children
and ask them to use it and give you feedback. That feedback drives Phase 6.
```
