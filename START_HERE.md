# NurseryFinder — Claude Code Project

## How to use this folder

This folder contains everything Claude Code needs to build your NurseryFinder app.
Each phase has its own file in `/phases/`. Work through them in order, one session at a time.

---

## One-time machine setup (do this first)

Install these if you don't have them:

1. **Node.js v20+** → https://nodejs.org (download the LTS version)
2. **Git** → https://git-scm.com/downloads
3. **Claude Code** → open Terminal and run:
   ```
   npm install -g @anthropic-ai/claude-code
   ```
4. **VS Code** (optional but recommended) → https://code.visualstudio.com

---

## How to start each phase

1. Open Terminal (Mac) or Command Prompt (Windows)
2. Navigate to this folder:
   ```
   cd path/to/nursery-finder
   ```
3. Start Claude Code:
   ```
   claude
   ```
4. Claude Code will read CLAUDE.md automatically
5. Type: `Read phases/PHASE_1_DATABASE.md and execute it`
6. Claude Code builds the phase. When done, move to the next phase.

---

## Phase order

| Phase | File | What happens |
|-------|------|-------------|
| 0 | PHASE_0_SETUP.md | Machine check, git init, Supabase setup instructions |
| 1 | PHASE_1_DATABASE.md | Database schema, PostGIS, stored functions |
| 2 | PHASE_2_COMPLIANCE.md | Privacy components, OGL attribution, admin auth |
| 3 | PHASE_3_BACKEND.md | Express API, Ofsted ingestion, geocoding |
| 4 | PHASE_4_FRONTEND.md | Next.js — 4 MVP screens |
| 5 | PHASE_5_DEPLOY.md | Railway + Vercel deployment, first data import |
| 6 | PHASE_6_V2.md | User accounts, fee data, nursery claiming |
| 7 | PHASE_7_SEO.md | Area pages, sitemap, structured data |
| 8 | PHASE_8_PROPERTY.md | Land Registry, crime data, Family Score |

---

## Before Phase 1: create your Supabase project

1. Go to https://supabase.com and create a free account
2. Click "New project" — name it `nursery-finder`
3. Choose a strong database password — save it somewhere safe
4. Wait ~2 minutes for the project to provision
5. Go to Settings → API and copy:
   - **Project URL** (looks like `https://xxxx.supabase.co`)
   - **anon/public key** (long string starting with `eyJ`)
   - **service_role key** (keep this secret — never commit to git)
6. You'll paste these into your `.env` file in Phase 3

---

## If something breaks

Just paste the error message into Claude Code and say "fix this".
Claude Code will diagnose and fix it. You never need to read the error yourself.
