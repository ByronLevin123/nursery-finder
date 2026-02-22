# Phase 0 — Project Setup

**Paste into Claude Code:** `Read phases/PHASE_0_SETUP.md and execute it`

---

## What this phase does

Verifies your machine is ready, initialises the project with the correct structure,
sets up git, and creates all config files. Takes about 20 minutes.

---

## Tasks

### 0.1 — Verify machine dependencies

Check the following are installed and print the versions:
```
node --version     # must be v18 or higher
npm --version
git --version
```

If Node.js is missing, stop and tell Byron to install it from https://nodejs.org
(LTS version). Do not proceed until Node v18+ is confirmed.

### 0.2 — Initialise git

From the project root (`nursery-finder/`):
```bash
git init
git add CLAUDE.md START_HERE.md phases/
git commit -m "chore: initialise nursery-finder project"
```

### 0.3 — Create .gitignore at project root

```
# Dependencies
node_modules/
.pnp
.pnp.js

# Environment files — NEVER commit these
.env
.env.local
.env.production
.env.*.local
backend/.env
frontend/.env.local

# Build outputs
dist/
build/
.next/
out/

# Logs
*.log
npm-debug.log*

# OS files
.DS_Store
Thumbs.db

# Editor
.vscode/settings.json
.idea/

# Test coverage
coverage/
```

### 0.4 — Create backend/.env.example

```bash
# Supabase — get these from supabase.com → your project → Settings → API
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_KEY=your-service-role-key-here

# Server
PORT=3001
NODE_ENV=development

# Admin protection — choose strong values
ADMIN_USER=admin
ADMIN_PASS=change-this-to-something-strong

# Ingest protection — random string
INGEST_SECRET=change-this-to-random-string

# Error tracking — get free DSN from sentry.io
SENTRY_DSN=https://your-dsn@sentry.io/project-id

# Alerts
ALERT_EMAIL=your@email.com
```

### 0.5 — Create frontend/.env.example

```bash
# API — local development
NEXT_PUBLIC_API_URL=http://localhost:3001

# Supabase — same values as backend (anon key only — never put service key here)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 0.6 — Create scripts/first-import.sh

```bash
#!/bin/bash
# Run this once after first deployment to import all Ofsted data
# Usage: ADMIN_USER=admin ADMIN_PASS=yourpass API_URL=https://your-api.railway.app bash scripts/first-import.sh

set -e

API_URL=${API_URL:-http://localhost:3001}
ADMIN_USER=${ADMIN_USER:-admin}
ADMIN_PASS=${ADMIN_PASS:-admin}

echo "=== NurseryFinder First Import ==="
echo "API: $API_URL"
echo ""

echo "Step 1: Checking API health..."
curl -s "$API_URL/api/v1/health" | python3 -m json.tool
echo ""

echo "Step 2: Importing Ofsted register (this takes 5-10 minutes)..."
curl -s -X POST "$API_URL/api/v1/ingest/ofsted" \
  -u "$ADMIN_USER:$ADMIN_PASS" \
  -H "Content-Type: application/json" | python3 -m json.tool
echo ""

echo "Step 3: Starting geocoding batch (first of many nightly runs)..."
curl -s -X POST "$API_URL/api/v1/ingest/geocode" \
  -u "$ADMIN_USER:$ADMIN_PASS" \
  -H "Content-Type: application/json" | python3 -m json.tool
echo ""

echo "=== Import complete! ==="
echo "Geocoding will continue automatically every night at 3am."
echo "Full dataset geocoded in approximately 25 days."
```

Make it executable:
```bash
chmod +x scripts/first-import.sh
```

### 0.7 — Final commit

```bash
git add -A
git commit -m "chore: phase 0 — project scaffolding complete"
```

### 0.8 — Tell Byron what to do next

Print these exact instructions:

```
✅ Phase 0 complete!

Next steps before Phase 1:

1. Create your Supabase project:
   → Go to https://supabase.com
   → Sign up / log in
   → Click "New project"
   → Name it: nursery-finder
   → Note your database password somewhere safe
   → Wait ~2 minutes for it to provision

2. Get your Supabase credentials:
   → In your project: Settings → API
   → Copy: Project URL, anon/public key, service_role key
   → You'll need these in Phase 3

3. Come back and run Phase 1:
   → Type: Read phases/PHASE_1_DATABASE.md and execute it
```
