# Phase 2 — Compliance & Legal Layer

**Paste into Claude Code:** `Read phases/PHASE_2_COMPLIANCE.md and execute it`

---

## What this phase does

Builds the compliance infrastructure that must exist before any user data is collected.
UK GDPR, OGL attribution, safeguarding banners, and admin route protection.
Takes about 1 hour.

---

## Tasks

### 2.1 — Initialise the Next.js frontend

```bash
cd frontend
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*"
```

Accept all defaults. Then install additional dependencies:
```bash
npm install axios react-leaflet leaflet
npm install -D @types/leaflet
```

### 2.2 — Create app/privacy/page.tsx

Full privacy policy page. Content:

**Title:** Privacy Policy — NurseryFinder

**Sections to include:**

1. **Who we are** — NurseryFinder is an independent website. We are registered as a data controller with the ICO (UK).

2. **What data we collect**
   - Nursery search queries (postcode, filters) — anonymised, no personal data stored
   - Fee submissions — anonymous, no name or email collected
   - Feedback forms — your email address (optional), stored for 30 days then deleted
   - Website analytics — we use Plausible Analytics which is cookieless and collects no personal data

3. **What we do NOT collect**
   - No tracking cookies
   - No advertising profiles
   - No third-party analytics that track you across websites

4. **Ofsted data**
   - Inspection data is sourced from the Ofsted Early Years Register, published under the Open Government Licence v3.0
   - We are not affiliated with Ofsted or the UK Government

5. **Your rights** — Under UK GDPR you have the right to access, correct, or delete any personal data we hold. Email: privacy@nurseryfinder.co.uk

6. **Data retention** — Feedback emails deleted after 30 days. Analytics data retained for 90 days (no personal data).

Style: clean, readable, use Tailwind prose classes. Link from every page footer.

### 2.3 — Create components/OglAttribution.tsx

```tsx
// OGL Attribution — required on every page displaying Ofsted data
// Ofsted data is published under Open Government Licence v3.0

export default function OglAttribution() {
  return (
    <p className="text-xs text-gray-500 mt-4 border-t border-gray-200 pt-4">
      Inspection data sourced from the{' '}
      <a
        href="https://www.gov.uk/government/statistical-data-sets/monthly-management-information-ofsteds-early-years-register"
        target="_blank"
        rel="noopener noreferrer"
        className="underline hover:text-gray-700"
      >
        Ofsted Early Years Register
      </a>
      , licensed under the{' '}
      <a
        href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/"
        target="_blank"
        rel="noopener noreferrer"
        className="underline hover:text-gray-700"
      >
        Open Government Licence v3.0
      </a>
      . NurseryFinder is independent of Ofsted and the UK Government.
    </p>
  )
}
```

### 2.4 — Create components/StaleGradeBanner.tsx

```tsx
// Shows when a nursery's Ofsted inspection is more than 4 years old
// inspection_date_warning field is auto-computed by the database

interface Props {
  lastInspectionDate: string | null
  inspectionDateWarning: boolean
}

export default function StaleGradeBanner({ lastInspectionDate, inspectionDateWarning }: Props) {
  if (!inspectionDateWarning) return null

  const formatted = lastInspectionDate
    ? new Date(lastInspectionDate).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'long', year: 'numeric'
      })
    : 'unknown'

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-md p-4 mb-4">
      <div className="flex items-start gap-3">
        <span className="text-amber-500 text-lg flex-shrink-0">⚠️</span>
        <div>
          <p className="text-amber-800 font-medium text-sm">
            Inspection data may be out of date
          </p>
          <p className="text-amber-700 text-sm mt-1">
            This nursery was last inspected on {formatted} — over 4 years ago.
            The grade shown may not reflect current quality. We recommend checking the
            full Ofsted report and visiting the nursery before making a decision.
          </p>
        </div>
      </div>
    </div>
  )
}
```

### 2.5 — Create components/EnforcementBanner.tsx

```tsx
// Shows when a nursery has an active Ofsted enforcement notice
// enforcement_notice field populated from Ofsted register "Action" column

interface Props {
  enforcementNotice: boolean
  inspectionReportUrl?: string | null
}

export default function EnforcementBanner({ enforcementNotice, inspectionReportUrl }: Props) {
  if (!enforcementNotice) return null

  return (
    <div className="bg-red-50 border border-red-300 rounded-md p-4 mb-4">
      <div className="flex items-start gap-3">
        <span className="text-red-500 text-lg flex-shrink-0">🚨</span>
        <div>
          <p className="text-red-800 font-semibold text-sm">
            Ofsted enforcement notice issued
          </p>
          <p className="text-red-700 text-sm mt-1">
            Ofsted has issued an enforcement notice to this provider.
            This may indicate a serious concern about quality or safety.
            We strongly recommend reviewing the full Ofsted report and
            contacting Ofsted directly before considering this nursery.
          </p>
          {inspectionReportUrl && (
            <a
              href={inspectionReportUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-2 text-sm text-red-800 font-medium underline"
            >
              View full Ofsted report →
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
```

### 2.6 — Create components/GradeBadge.tsx

```tsx
// Coloured Ofsted grade badge used throughout the app

const GRADE_STYLES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  'Outstanding': {
    bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300',
    label: 'Outstanding'
  },
  'Good': {
    bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300',
    label: 'Good'
  },
  'Requires Improvement': {
    bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-300',
    label: 'Requires Improvement'
  },
  'Inadequate': {
    bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300',
    label: 'Inadequate'
  },
}

interface Props {
  grade: string | null
  size?: 'sm' | 'md' | 'lg'
}

export default function GradeBadge({ grade, size = 'md' }: Props) {
  const style = grade ? GRADE_STYLES[grade] : null
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' :
                    size === 'lg' ? 'text-base px-4 py-2' :
                    'text-sm px-3 py-1'

  if (!style) {
    return (
      <span className={`inline-flex items-center rounded-full border font-medium ${sizeClass} bg-gray-100 text-gray-600 border-gray-300`}>
        Not yet inspected
      </span>
    )
  }

  return (
    <span className={`inline-flex items-center rounded-full border font-medium ${sizeClass} ${style.bg} ${style.text} ${style.border}`}>
      {style.label}
    </span>
  )
}
```

### 2.7 — Create components/Footer.tsx

```tsx
// Site footer — appears on every page
// Links to privacy policy and includes OGL attribution

import OglAttribution from './OglAttribution'
import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="bg-gray-50 border-t border-gray-200 mt-12">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-start gap-6">
          <div>
            <p className="font-semibold text-gray-800">NurseryFinder</p>
            <p className="text-sm text-gray-500 mt-1">
              Find and compare Ofsted-rated nurseries across the UK
            </p>
          </div>
          <div className="flex gap-6 text-sm">
            <Link href="/privacy" className="text-gray-500 hover:text-gray-700">
              Privacy Policy
            </Link>
            <a
              href="mailto:hello@nurseryfinder.co.uk"
              className="text-gray-500 hover:text-gray-700"
            >
              Contact
            </a>
          </div>
        </div>
        <OglAttribution />
      </div>
    </footer>
  )
}
```

### 2.8 — Update app/layout.tsx

Add Footer to layout. Add Plausible analytics script. Add font and global metadata:

```tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Footer from '@/components/Footer'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: {
    template: '%s | NurseryFinder',
    default: 'NurseryFinder — Compare UK Nurseries by Ofsted Grade',
  },
  description: 'Find and compare Ofsted-rated nurseries near you. Search by postcode, filter by grade, and find funded places.',
  metadataBase: new URL('https://nurseryfinder.co.uk'),
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Plausible Analytics — GDPR compliant, cookieless */}
        <script
          defer
          data-domain="nurseryfinder.co.uk"
          src="https://plausible.io/js/plausible.js"
        />
      </head>
      <body className={inter.className}>
        <main className="min-h-screen">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  )
}
```

### 2.9 — Create frontend/.env.example

Already done in Phase 0 — verify it exists.

### 2.10 — Commit

```bash
cd ..
git add -A
git commit -m "feat: phase 2 — compliance layer, OGL attribution, safeguarding banners"
```

### 2.11 — Tell Byron what to do next

```
✅ Phase 2 complete!

Compliance infrastructure is in place:
- Privacy policy page at /privacy
- OGL attribution on all data pages
- Stale grade warning banner (auto-shows for inspections older than 4 years)
- Enforcement notice banner (auto-shows for flagged providers)
- Plausible analytics configured (activate at plausible.io when live)

Next: Build the backend API.
→ Type: Read phases/PHASE_3_BACKEND.md and execute it

Before that, make sure you have your Supabase credentials ready:
- Project URL
- Anon key
- Service role key
You'll create backend/.env from the example file in Phase 3.
```
