# Phase 6 — V2: User Accounts, Fee Data & Nursery Claiming

**Paste into Claude Code:** `Read phases/PHASE_6_V2.md and execute it`

**Gate: Only start this phase after 500 real users have used the app.**

---

## What this phase does

Adds user accounts via Supabase Auth (magic link — no password needed),
migrates shortlist from localStorage to the database, activates the fee
crowd-sourcing system, and builds the nursery claiming flow.

---

## Tasks

### 6.1 — Enable Supabase Auth

Tell Byron:
```
Before running this phase, enable Supabase Auth:
1. Go to your Supabase project
2. Click "Authentication" in left sidebar
3. Click "Providers" → enable "Email" provider
4. Set "Confirm email" to ON (magic link, no password)
5. In "Email Templates" customise the magic link email with your branding
6. Copy your Supabase anon key — it's already in your .env
```

### 6.2 — Create database/migrations/002_user_accounts.sql

```sql
-- Migration 002: User accounts, shortlists, and saved searches
-- Run in Supabase SQL Editor after 001 is complete

-- Enable Row Level Security on shortlists
ALTER TABLE user_shortlists ENABLE ROW LEVEL SECURITY;

-- Policy: users can only see their own shortlist
CREATE POLICY "Users see own shortlist" ON user_shortlists
  FOR ALL USING (auth.uid() = user_id);

-- Policy: users can insert to their own shortlist
CREATE POLICY "Users add to own shortlist" ON user_shortlists
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Saved searches table
CREATE TABLE IF NOT EXISTS saved_searches (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  postcode      TEXT NOT NULL,
  radius_km     INTEGER DEFAULT 5,
  grade_filter  TEXT,
  funded_2yr    BOOLEAN DEFAULT FALSE,
  funded_3yr    BOOLEAN DEFAULT FALSE,
  alert_on_new  BOOLEAN DEFAULT FALSE,  -- email when new nursery matches
  name          TEXT,                    -- user-given name, e.g. "Near work"
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own searches" ON saved_searches
  FOR ALL USING (auth.uid() = user_id);
```

### 6.3 — Install Supabase Auth client in frontend

```bash
cd frontend
npm install @supabase/supabase-js @supabase/auth-helpers-nextjs
```

Create `lib/supabase.ts`:
```typescript
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
```

### 6.4 — Create app/login/page.tsx

Magic link login — no password:

```tsx
'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/shortlist` }
    })
    if (!error) setSent(true)
    setLoading(false)
  }

  if (sent) return (
    <div className="max-w-md mx-auto px-4 py-16 text-center">
      <p className="text-2xl mb-4">✉️ Check your email</p>
      <p className="text-gray-600">
        We sent a magic link to <strong>{email}</strong>.
        Click it to sign in — no password needed.
      </p>
    </div>
  )

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold mb-2">Sign in to NurseryFinder</h1>
      <p className="text-gray-600 mb-8">Save your shortlist across devices. No password needed.</p>
      <form onSubmit={handleLogin} className="flex flex-col gap-4">
        <input
          type="email" required value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="your@email.com"
          className="px-4 py-3 border-2 border-gray-300 rounded-xl"
        />
        <button type="submit" disabled={loading}
          className="py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50">
          {loading ? 'Sending...' : 'Send magic link'}
        </button>
      </form>
    </div>
  )
}
```

### 6.5 — Migrate shortlist from localStorage to Supabase

Update `lib/shortlist.ts`:
- If user is logged in: read/write from `user_shortlists` Supabase table
- If not logged in: use localStorage as before (still works)
- On login: merge localStorage shortlist into user's database shortlist

### 6.6 — Activate fee crowd-sourcing display

The fee submission form (FeeModal) was built in Phase 4. Now activate display:

In NurseryCard and nursery profile: already shows `fee_avg_monthly` if `fee_report_count >= 3`.
This goes live automatically once the backend has fee data.

Add a "Fee data" section to the search page filters:
- Toggle: "Show fees" (only shows nurseries with ≥3 fee reports)

### 6.7 — Build nursery claiming flow

Create `app/claim/[urn]/page.tsx`:
- Requires login (redirect to /login if not authenticated)
- Shows nursery name and address
- Form: claimant's role (owner/manager/staff), confirmation checkbox
- On submit: POST to `/api/v1/nurseries/${urn}/claim`
- Verification: backend sends email to nursery's registered email from Ofsted data
- If nursery email is null in data: ask claimant to email proof to verify@nurseryfinder.co.uk

Add to backend:
```
POST /api/v1/nurseries/:urn/claim
- Requires authenticated user (Supabase JWT validation)
- Inserts into nursery_claims table
- Sends verification email to nursery's registered email
- Returns { status: 'pending_verification' }
```

Add "Is this your nursery?" CTA to nursery profile page (below contact details).

### 6.8 — Add saved searches UI

In user account area (`app/account/page.tsx`):
- List saved searches with postcode and filters
- "Run search" button (navigates to /search with params)
- "Get alerts" toggle (sets alert_on_new = true)
- Delete search button

### 6.9 — Commit

```bash
git add -A
git commit -m "feat: phase 6 — user accounts, fee data, nursery claiming"
```

### 6.10 — Tell Byron what to do next

```
✅ Phase 6 complete!

Users can now:
- Sign in with magic link (no password)
- Save shortlist across devices
- See crowd-sourced fee data (once 3+ reports exist per nursery)
- Claim their nursery

Your monetisation path is now open:
- Claimed nurseries can pay for enhanced listings (add photos, description, fees)
- Verified nurseries get a "Claimed" badge

Next: SEO — build the pages that bring free traffic.
→ Type: Read phases/PHASE_7_SEO.md and execute it
```
