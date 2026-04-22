'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

/**
 * Admin-only documentation page.
 *
 * Deep reference of every feature, route, email, cron job and external
 * data source in the NurseryMatch platform. Intended as a living
 * operating manual for admins — keep it accurate as the app evolves.
 *
 * Auth is enforced by the admin layout (AdminLayout checks role === 'admin'
 * before rendering any child page).
 */

interface Section {
  id: string
  title: string
}

const SECTIONS: Section[] = [
  { id: 'overview', title: 'Overview' },
  { id: 'architecture', title: 'Architecture' },
  { id: 'user-roles', title: 'User roles & auth' },
  { id: 'parent-features', title: 'Parent features' },
  { id: 'provider-features', title: 'Provider features' },
  { id: 'admin-features', title: 'Admin features' },
  { id: 'ai-features', title: 'AI features' },
  { id: 'emails', title: 'Email system' },
  { id: 'cron-jobs', title: 'Cron jobs & workers' },
  { id: 'external-data', title: 'External data sources' },
  { id: 'api-surface', title: 'API surface' },
  { id: 'env-vars', title: 'Environment variables' },
  { id: 'deployments', title: 'Deployments' },
]

export default function AdminDocsPage() {
  const [activeId, setActiveId] = useState<string>(SECTIONS[0].id)

  // Scroll-spy: highlight the TOC item for whichever section is in view.
  useEffect(() => {
    const handler = () => {
      const y = window.scrollY + 140
      let current = SECTIONS[0].id
      for (const s of SECTIONS) {
        const el = document.getElementById(s.id)
        if (el && el.offsetTop <= y) current = s.id
      }
      setActiveId(current)
    }
    handler()
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  return (
    <div className="max-w-6xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Platform documentation</h1>
        <p className="text-gray-600 mt-2">
          Operating manual for NurseryMatch. Every feature, route and integration.
        </p>
      </header>

      <div className="flex gap-8">
        {/* Sticky TOC */}
        <aside className="hidden lg:block w-56 shrink-0">
          <nav className="sticky top-4 space-y-1">
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className={`block px-3 py-1.5 text-sm rounded-md transition ${
                  activeId === s.id
                    ? 'bg-indigo-50 text-indigo-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                {s.title}
              </a>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <article className="min-w-0 flex-1 space-y-12 pb-24">
          <Overview />
          <Architecture />
          <UserRoles />
          <ParentFeatures />
          <ProviderFeatures />
          <AdminFeatures />
          <AIFeatures />
          <Emails />
          <CronJobs />
          <ExternalData />
          <ApiSurface />
          <EnvVars />
          <Deployments />
        </article>
      </div>
    </div>
  )
}

/* --- Section components --- */

function SectionHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="text-2xl font-bold text-gray-900 scroll-mt-24 border-b border-gray-200 pb-2">
      {children}
    </h2>
  )
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-2">{children}</h3>
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="px-1.5 py-0.5 bg-gray-100 text-gray-800 rounded text-sm font-mono">
      {children}
    </code>
  )
}

function Path({ children }: { children: React.ReactNode }) {
  return <code className="text-sm font-mono text-indigo-700">{children}</code>
}

function Overview() {
  return (
    <section className="space-y-3">
      <SectionHeading id="overview">Overview</SectionHeading>
      <p className="text-gray-700 leading-relaxed">
        NurseryMatch is a UK nursery comparison and discovery platform. It helps parents find and
        evaluate Ofsted-rated nurseries near them, claim and manage listings as providers, and gives
        admins tools to moderate content and measure platform health.
      </p>
      <p className="text-gray-700 leading-relaxed">
        The product combines authoritative data (Ofsted, postcodes, land registry, police, flood,
        IMD) with user-generated content (reviews, Q&amp;A, shortlists) and an optional paid
        provider tier for enhanced listings and enquiry capture.
      </p>
      <SubHeading>Three user experiences</SubHeading>
      <ul className="list-disc pl-6 space-y-1 text-gray-700">
        <li><b>Parents / guests</b> — search, compare, shortlist, read reviews, take the quiz. All free.</li>
        <li><b>Providers</b> — nursery owners / managers who claim a listing, respond to enquiries, upload photos, subscribe for premium visibility.</li>
        <li><b>Admins</b> — moderate reviews and claims, view revenue and growth reports, manage promotions, support users.</li>
      </ul>
    </section>
  )
}

function Architecture() {
  return (
    <section className="space-y-3">
      <SectionHeading id="architecture">Architecture</SectionHeading>
      <div className="grid md:grid-cols-2 gap-4">
        <Card title="Frontend">
          Next.js 14 (App Router) on Vercel. SSR/SSG for SEO-critical pages (nursery profiles,
          district pages). Tailwind for styling. Plausible for analytics.
        </Card>
        <Card title="Backend API">
          Express.js on Render (<Path>nursery-finder-6u7r.onrender.com</Path>). Pino JSON logs.
          Rate limits on all public routes. OpenAPI spec at <Path>/api/openapi.json</Path>.
        </Card>
        <Card title="Database">
          Supabase Postgres + PostGIS. Row-level security for user data. Generated{' '}
          <Code>location</Code> geometry columns for geo queries (never ST_MakePoint inline).
        </Card>
        <Card title="Auth">
          Supabase Auth (magic link + password). Session provider in
          <Path> frontend/components/SessionProvider.tsx</Path> syncs user + role from
          <Path> /api/v1/profile</Path>.
        </Card>
        <Card title="Email">
          Resend for transactional email. Shared HTML shell in
          <Path> backend/src/services/emailService.js</Path>. 13 lifecycle templates.
        </Card>
        <Card title="Background jobs">
          Separate worker process (<Path>backend/src/worker.js</Path>) running node-cron.
          Handles drip sequences, weekly digests, Ofsted change detection.
        </Card>
      </div>
    </section>
  )
}

function UserRoles() {
  return (
    <section className="space-y-3">
      <SectionHeading id="user-roles">User roles &amp; auth</SectionHeading>
      <p className="text-gray-700">
        Every authenticated user has a role in <Code>user_profiles.role</Code>. Access control is
        a mix of <b>frontend route guards</b> (e.g. <Path>admin/layout.tsx</Path>) and{' '}
        <b>backend middleware</b> (<Path>backend/src/middleware/auth.js</Path>).
      </p>
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-y border-gray-200">
          <tr>
            <th className="text-left p-2 font-semibold">Role</th>
            <th className="text-left p-2 font-semibold">Access</th>
            <th className="text-left p-2 font-semibold">Middleware gate</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          <tr>
            <td className="p-2 font-mono text-xs">customer</td>
            <td className="p-2">Parent UI: search, shortlist, compare, reviews, enquiries, quiz, dashboard.</td>
            <td className="p-2"><Code>requireAuth</Code></td>
          </tr>
          <tr>
            <td className="p-2 font-mono text-xs">provider</td>
            <td className="p-2">All customer access + provider dashboard, nursery editor, analytics, billing.</td>
            <td className="p-2"><Code>requireRole(&apos;provider&apos;)</Code></td>
          </tr>
          <tr>
            <td className="p-2 font-mono text-xs">admin</td>
            <td className="p-2">Everything, plus moderation, reports, promotions, user management.</td>
            <td className="p-2"><Code>requireRole(&apos;admin&apos;)</Code></td>
          </tr>
        </tbody>
      </table>
      <SubHeading>Login / signup routes</SubHeading>
      <ul className="list-disc pl-6 space-y-1 text-gray-700">
        <li><Path>/login</Path> — email + password or magic link</li>
        <li><Path>/provider/register</Path> — provider sign-up flow, creates account + claim + sends magic link</li>
        <li><Path>/claim?urn=...</Path> — claim an existing listing by URN</li>
        <li>Password reset: <Code>supabase.auth.resetPasswordForEmail</Code> from the login page, redirects to <Path>/login</Path> with Supabase tokens in the URL hash.</li>
      </ul>
    </section>
  )
}

function ParentFeatures() {
  return (
    <section className="space-y-3">
      <SectionHeading id="parent-features">Parent features</SectionHeading>

      <SubHeading>Search (<Path>/search</Path>)</SubHeading>
      <ul className="list-disc pl-6 space-y-1 text-gray-700">
        <li>Postcode / place / nursery-name smart search with autocomplete suggestions</li>
        <li>Google Maps with colored markers by Ofsted grade</li>
        <li>Filters: radius (1–20km), Ofsted grade, availability, min rating, provider type, funded 2yr / 3yr</li>
        <li>Travel-time filter: walk/cycle/drive within N minutes (OSRM routing)</li>
        <li>Personal preferences panel: match scoring + exclusion based on what matters to you</li>
        <li>Sort: relevance, distance, score, cost (low/high), rating</li>
        <li>Save search (signed-in users only) with optional alerts</li>
        <li>Promotions interleaved every 5 results (admin-managed sponsored content)</li>
      </ul>

      <SubHeading>Nursery profile (<Path>/nursery/[urn]</Path>)</SubHeading>
      <ul className="list-disc pl-6 space-y-1 text-gray-700">
        <li>Ofsted grade, inspection date, staleness banner if &gt;4 years old</li>
        <li>Enforcement notice banner when applicable (compliance requirement)</li>
        <li>Google Places data: ratings, reviews, photos, opening hours</li>
        <li>Fees, funded places, capacity, age range, session types</li>
        <li>Photos (provider-uploaded) and Street View panorama</li>
        <li>Parent reviews + moderated Q&amp;A</li>
        <li>Nearby activities (admin promotions near this location)</li>
        <li>Shortlist + Compare buttons, Contact / enquiry form</li>
        <li>AI-generated nursery summary (first visit cached)</li>
      </ul>

      <SubHeading>Shortlist (<Path>/shortlist</Path>) &amp; Compare (<Path>/compare</Path>)</SubHeading>
      <ul className="list-disc pl-6 space-y-1 text-gray-700">
        <li>Heart nurseries to save them. No free-tier limit.</li>
        <li>Side-by-side table with fees, grade, capacity, travel time from your postcode</li>
        <li>Print view + email to self/partner (<Path>/api/v1/email/shortlist</Path>, <Path>/comparison</Path>)</li>
        <li>Pair URL <Path>/compare-nurseries/[urnA]/vs/[urnB]</Path> for direct shareable comparisons</li>
      </ul>

      <SubHeading>Quiz (<Path>/quiz</Path>)</SubHeading>
      <p className="text-gray-700">
        Preference-capture flow. Answers populate <Code>preferences.ts</Code> (location, budget,
        must-haves, deal-breakers), then scores and ranks nurseries in search results.
      </p>

      <SubHeading>Dashboard (<Path>/dashboard</Path>)</SubHeading>
      <ul className="list-disc pl-6 space-y-1 text-gray-700">
        <li>Saved searches with alert toggles</li>
        <li>Recommended nurseries based on preferences + home postcode</li>
        <li>&quot;Activities near you&quot; (promotions feed)</li>
        <li>Recent enquiries status</li>
      </ul>

      <SubHeading>Area intelligence</SubHeading>
      <ul className="list-disc pl-6 space-y-1 text-gray-700">
        <li><Path>/find-an-area</Path> — interactive area finder with family-friendliness scoring</li>
        <li><Path>/nurseries-in/[district]</Path> — postcode-district SEO pages</li>
        <li><Path>/nurseries-in-town/[town]</Path> — town SEO pages</li>
        <li><Path>/property-search</Path> — Land Registry price-paid data by district</li>
      </ul>
    </section>
  )
}

function ProviderFeatures() {
  return (
    <section className="space-y-3">
      <SectionHeading id="provider-features">Provider features</SectionHeading>

      <SubHeading>Sign-up &amp; claim</SubHeading>
      <ul className="list-disc pl-6 space-y-1 text-gray-700">
        <li><Path>/provider/register</Path> — multi-step form: details → find nursery → evidence → sent magic link</li>
        <li>Creates Supabase auth user + <Code>user_profiles</Code> + <Code>nursery_claims</Code> row (status: pending)</li>
        <li>Admin approves via <Path>/admin/claims</Path> — triggers <Code>renderProviderWelcomeEmail</Code></li>
      </ul>

      <SubHeading>Onboarding (<Path>/provider/onboarding</Path>)</SubHeading>
      <p className="text-gray-700">
        Guided checklist: upload photos, set fees, set opening hours, set capacity, enable
        enquiry notifications. Progress bar persists across sessions.
      </p>

      <SubHeading>Provider dashboard (<Path>/provider</Path>)</SubHeading>
      <ul className="list-disc pl-6 space-y-1 text-gray-700">
        <li>Quick stats: views, enquiries, shortlists, compares (this week / all time)</li>
        <li>Recent enquiries list with unread badge</li>
        <li>Analytics chart: traffic over last 30 days</li>
      </ul>

      <SubHeading>Nursery editor (<Path>/provider/[urn]/edit</Path>)</SubHeading>
      <p className="text-gray-700">
        Long-form editor for the provider-controlled fields: description, opening hours, fees,
        funded place count, session patterns, age range, photos, contact details. Ofsted data
        itself is read-only.
      </p>

      <SubHeading>Availability slots (<Path>/provider/[urn]/slots</Path>)</SubHeading>
      <p className="text-gray-700">
        Weekly availability grid. Toggled slots feed into <Code>has_availability</Code> filter
        and the availability chip on the nursery card.
      </p>

      <SubHeading>Enquiries (<Path>/provider/enquiries</Path>)</SubHeading>
      <ul className="list-disc pl-6 space-y-1 text-gray-700">
        <li>Inbox-style list of parent enquiries</li>
        <li>Reply-by-email fires a message that the parent receives with the nursery as reply-to</li>
        <li>Response time tracked for the provider&apos;s badge (&quot;replies within X hours&quot;)</li>
      </ul>

      <SubHeading>Analytics (<Path>/provider/analytics</Path>)</SubHeading>
      <p className="text-gray-700">
        Deeper charts: views by day, source mix, conversion funnel (view → shortlist → enquiry),
        comparison to area average.
      </p>

      <SubHeading>Reports (<Path>/provider/reports</Path>)</SubHeading>
      <p className="text-gray-700">
        30/90-day trend charts (enquiries, profile views) with CSV export per chart. Data comes
        from <Path>/api/v1/provider/reports</Path>.
      </p>

      <SubHeading>Billing (<Path>/provider/billing</Path>)</SubHeading>
      <ul className="list-disc pl-6 space-y-1 text-gray-700">
        <li>Current tier + &quot;Upgrade / downgrade&quot; Stripe Checkout buttons</li>
        <li>&quot;Manage billing&quot; opens Stripe Customer Portal for invoices + payment methods</li>
        <li>Invoice history summary</li>
      </ul>
    </section>
  )
}

function AdminFeatures() {
  return (
    <section className="space-y-3">
      <SectionHeading id="admin-features">Admin features</SectionHeading>
      <p className="text-gray-700">
        All admin routes live under <Path>/admin/*</Path> and are gated by
        <Path> admin/layout.tsx</Path> (role === admin). Admin API endpoints are separately
        gated by <Code>requireRole(&apos;admin&apos;)</Code> on the backend.
      </p>

      <table className="w-full text-sm border-y border-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="text-left p-2 font-semibold">Page</th>
            <th className="text-left p-2 font-semibold">What it does</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          <tr>
            <td className="p-2"><Path>/admin</Path></td>
            <td className="p-2">Platform overview: total users, nurseries, claims, MRR, enquiries this month. Health at a glance.</td>
          </tr>
          <tr>
            <td className="p-2"><Path>/admin/users</Path></td>
            <td className="p-2">Find any user by email. View role, signup date, last seen. Change role, disable account.</td>
          </tr>
          <tr>
            <td className="p-2"><Path>/admin/claims</Path></td>
            <td className="p-2">Pending nursery claims queue. Approve → triggers provider welcome email. Reject with reason.</td>
          </tr>
          <tr>
            <td className="p-2"><Path>/admin/reviews</Path></td>
            <td className="p-2">Review moderation: approve, edit, delete. Profanity filter flags suspicious content.</td>
          </tr>
          <tr>
            <td className="p-2"><Path>/admin/enquiries</Path></td>
            <td className="p-2">All enquiries across the platform. Filter by status, provider, date range.</td>
          </tr>
          <tr>
            <td className="p-2"><Path>/admin/subscriptions</Path></td>
            <td className="p-2">Active Stripe subscriptions list. Cancel, refund, view customer.</td>
          </tr>
          <tr>
            <td className="p-2"><Path>/admin/reports</Path></td>
            <td className="p-2">Charts: MRR trend, user growth (parents vs providers), nursery coverage, claim funnel. CSV export.</td>
          </tr>
          <tr>
            <td className="p-2"><Path>/admin/promotions</Path></td>
            <td className="p-2">CRUD for admin-managed ads (activities, gear, tutors). Category, location, radius, date range.</td>
          </tr>
          <tr>
            <td className="p-2"><Path>/admin/invites</Path></td>
            <td className="p-2">Batch invite nurseries to claim their listing. CSV upload of URNs → email drip.</td>
          </tr>
          <tr>
            <td className="p-2"><Path>/admin/docs</Path></td>
            <td className="p-2">This page.</td>
          </tr>
        </tbody>
      </table>
    </section>
  )
}

function AIFeatures() {
  return (
    <section className="space-y-3">
      <SectionHeading id="ai-features">AI features</SectionHeading>
      <p className="text-gray-700">
        Anthropic Claude powers three features. All calls happen server-side via
        <Code>ANTHROPIC_API_KEY</Code>; results are cached to keep cost predictable.
      </p>
      <SubHeading>AI Family Move Assistant (<Path>/assistant</Path>)</SubHeading>
      <p className="text-gray-700">
        Conversational area finder. User types natural language (&quot;family of 4, budget £800k,
        good secondary schools, 30 min commute to Waterloo&quot;) → Claude calls area-data tools
        and returns ranked districts with reasoning.
      </p>
      <SubHeading>Smart nursery summary</SubHeading>
      <p className="text-gray-700">
        On the nursery profile, Claude synthesises Ofsted report + Google reviews + parent Q&amp;A
        into a 3-sentence &quot;what parents say&quot; section. Cached per URN for 30 days.
      </p>
      <SubHeading>Search intent parsing</SubHeading>
      <p className="text-gray-700">
        Smart search in the search bar uses Claude to distinguish postcodes, place names, and
        nursery names, so parents can type anything without choosing a filter.
      </p>
    </section>
  )
}

function Emails() {
  return (
    <section className="space-y-3">
      <SectionHeading id="emails">Email system</SectionHeading>
      <p className="text-gray-700">
        All transactional email flows through Resend. Templates share a branded shell
        (<Path>backend/src/services/emailService.js</Path>) with preheader, tagline and
        consistent footer. Sender is <Code>EMAIL_FROM</Code>; unsubscribe link goes to
        <Path> /account?tab=notifications</Path>.
      </p>
      <table className="w-full text-sm border-y border-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="text-left p-2 font-semibold">Template</th>
            <th className="text-left p-2 font-semibold">Trigger</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          <tr><td className="p-2">Welcome</td><td className="p-2">New user signup</td></tr>
          <tr><td className="p-2">Welcome drip day 3</td><td className="p-2">Drip queue 3 days after signup</td></tr>
          <tr><td className="p-2">Welcome drip day 7</td><td className="p-2">Drip queue 7 days after signup</td></tr>
          <tr><td className="p-2">Weekly digest (basic)</td><td className="p-2">Cron — new nurseries near user postcode</td></tr>
          <tr><td className="p-2">Weekly digest (enhanced)</td><td className="p-2">Cron — nurseries + Ofsted changes + Q&amp;A answers + reviews</td></tr>
          <tr><td className="p-2">Re-engagement</td><td className="p-2">Cron — users inactive 30+ days</td></tr>
          <tr><td className="p-2">Saved search alert</td><td className="p-2">New matches on a user&apos;s saved search</td></tr>
          <tr><td className="p-2">Ofsted rating change</td><td className="p-2">Shortlisted nursery&apos;s Ofsted grade changes</td></tr>
          <tr><td className="p-2">Provider invite</td><td className="p-2">Admin batch invite via <Path>/admin/invites</Path></td></tr>
          <tr><td className="p-2">Provider welcome</td><td className="p-2">Admin approves a claim</td></tr>
          <tr><td className="p-2">Provider payment confirmation</td><td className="p-2">Stripe subscription charge succeeds</td></tr>
          <tr><td className="p-2">Provider enquiry notification (instant)</td><td className="p-2">Parent submits an enquiry</td></tr>
          <tr><td className="p-2">Provider enquiry digest</td><td className="p-2">Weekly cron — summary for providers</td></tr>
          <tr><td className="p-2">Parent shortlist email</td><td className="p-2">User hits &quot;email me my shortlist&quot;</td></tr>
          <tr><td className="p-2">Parent comparison email</td><td className="p-2">User hits &quot;email this comparison&quot;</td></tr>
          <tr><td className="p-2">Claim approved</td><td className="p-2">Admin approves a claim (same flow as provider welcome)</td></tr>
        </tbody>
      </table>
      <p className="text-gray-700 mt-3">
        Supabase sends 4 separate auth emails (confirm signup, magic link, reset password, change
        email). Those templates live in the <b>Supabase dashboard → Authentication → Email
        Templates</b>, not in this codebase. Keep them branded separately.
      </p>
    </section>
  )
}

function CronJobs() {
  return (
    <section className="space-y-3">
      <SectionHeading id="cron-jobs">Cron jobs &amp; workers</SectionHeading>
      <p className="text-gray-700">
        Background work runs in a separate process (<Path>backend/src/worker.js</Path>) so long
        jobs never block API responses. Deployed as a Render background worker.
      </p>
      <table className="w-full text-sm border-y border-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="text-left p-2 font-semibold">Job</th>
            <th className="text-left p-2 font-semibold">Schedule</th>
            <th className="text-left p-2 font-semibold">What it does</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          <tr><td className="p-2">Welcome drip</td><td className="p-2 font-mono text-xs">every hour</td><td className="p-2">Sends day-3 and day-7 welcome emails</td></tr>
          <tr><td className="p-2">Weekly digest</td><td className="p-2 font-mono text-xs">Mon 9am</td><td className="p-2">Fresh nurseries near each user&apos;s postcode</td></tr>
          <tr><td className="p-2">Enhanced weekly digest</td><td className="p-2 font-mono text-xs">Mon 10am</td><td className="p-2">Ofsted changes + Q&amp;A + reviews on shortlists</td></tr>
          <tr><td className="p-2">Saved search alerts</td><td className="p-2 font-mono text-xs">daily 8am</td><td className="p-2">New matches on saved searches</td></tr>
          <tr><td className="p-2">Re-engagement</td><td className="p-2 font-mono text-xs">weekly</td><td className="p-2">Users inactive 30+ days</td></tr>
          <tr><td className="p-2">Ofsted change detector</td><td className="p-2 font-mono text-xs">daily</td><td className="p-2">Diff new Ofsted data vs stored, trigger rating-change emails</td></tr>
          <tr><td className="p-2">Provider enquiry digest</td><td className="p-2 font-mono text-xs">Mon 9am</td><td className="p-2">Weekly provider summary of parent enquiries</td></tr>
          <tr><td className="p-2">Ofsted ingest</td><td className="p-2 font-mono text-xs">monthly</td><td className="p-2">Scrape Ofsted register CSV, upsert nurseries, geocode new ones</td></tr>
          <tr><td className="p-2">Postcodes geocoding</td><td className="p-2 font-mono text-xs">on-demand</td><td className="p-2">Bulk batch (100/request) postcodes.io calls</td></tr>
        </tbody>
      </table>
    </section>
  )
}

function ExternalData() {
  return (
    <section className="space-y-3">
      <SectionHeading id="external-data">External data sources</SectionHeading>
      <p className="text-gray-700">
        Every third-party API, where we hit it, and the rate limits we respect.
      </p>
      <table className="w-full text-sm border-y border-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="text-left p-2 font-semibold">Source</th>
            <th className="text-left p-2 font-semibold">Used for</th>
            <th className="text-left p-2 font-semibold">Auth / limits</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          <tr>
            <td className="p-2">Ofsted Early Years Register</td>
            <td className="p-2">Master nursery list, grades, inspection dates</td>
            <td className="p-2 text-xs">Public CSV, monthly scrape</td>
          </tr>
          <tr>
            <td className="p-2">Postcodes.io</td>
            <td className="p-2">Geocoding postcodes → lat/lng, districts</td>
            <td className="p-2 text-xs">Free, no key, bulk endpoint 100/req</td>
          </tr>
          <tr>
            <td className="p-2">OSRM (router.project-osrm.org)</td>
            <td className="p-2">Travel times (walk/cycle/drive)</td>
            <td className="p-2 text-xs">Free, 1 req / 200ms</td>
          </tr>
          <tr>
            <td className="p-2">Google Maps JS API</td>
            <td className="p-2">Interactive maps + Street View</td>
            <td className="p-2 text-xs"><Code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</Code></td>
          </tr>
          <tr>
            <td className="p-2">Google Places API</td>
            <td className="p-2">Nursery ratings, reviews, photos, hours</td>
            <td className="p-2 text-xs"><Code>GOOGLE_PLACES_API_KEY</Code></td>
          </tr>
          <tr>
            <td className="p-2">Police Data API (data.police.uk)</td>
            <td className="p-2">Crime stats for area intelligence</td>
            <td className="p-2 text-xs">Free, 1 req / 500ms</td>
          </tr>
          <tr>
            <td className="p-2">Environment Agency flood monitoring</td>
            <td className="p-2">Flood risk on area pages</td>
            <td className="p-2 text-xs">Free, no key</td>
          </tr>
          <tr>
            <td className="p-2">UK Land Registry price-paid CSV</td>
            <td className="p-2">Property prices on <Path>/property-search</Path></td>
            <td className="p-2 text-xs">Free, streamed (large files)</td>
          </tr>
          <tr>
            <td className="p-2">IMD 2019</td>
            <td className="p-2">Indices of Multiple Deprivation by LSOA</td>
            <td className="p-2 text-xs">Public dataset, embedded</td>
          </tr>
          <tr>
            <td className="p-2">Get Information About Schools</td>
            <td className="p-2">Primary / secondary school data for area pages</td>
            <td className="p-2 text-xs">Public CSV</td>
          </tr>
          <tr>
            <td className="p-2">PropertyData.co.uk</td>
            <td className="p-2">Live market stats (asking price, rents, yields)</td>
            <td className="p-2 text-xs"><Code>PROPERTYDATA_API_KEY</Code></td>
          </tr>
          <tr>
            <td className="p-2">Anthropic Claude</td>
            <td className="p-2">AI assistant, summaries, smart search</td>
            <td className="p-2 text-xs"><Code>ANTHROPIC_API_KEY</Code></td>
          </tr>
          <tr>
            <td className="p-2">Resend</td>
            <td className="p-2">Transactional email</td>
            <td className="p-2 text-xs"><Code>RESEND_API_KEY</Code></td>
          </tr>
          <tr>
            <td className="p-2">Stripe</td>
            <td className="p-2">Provider billing (subscriptions + portal)</td>
            <td className="p-2 text-xs"><Code>STRIPE_SECRET_KEY</Code></td>
          </tr>
          <tr>
            <td className="p-2">Plausible</td>
            <td className="p-2">Site analytics (GDPR compliant)</td>
            <td className="p-2 text-xs"><Code>NEXT_PUBLIC_PLAUSIBLE_DOMAIN</Code></td>
          </tr>
        </tbody>
      </table>
    </section>
  )
}

function ApiSurface() {
  return (
    <section className="space-y-3">
      <SectionHeading id="api-surface">API surface</SectionHeading>
      <p className="text-gray-700">
        All backend routes are under <Code>/api/v1/</Code>. The full spec is published as
        OpenAPI 3 at <Path>/api/openapi.json</Path> and is documented on
        <Path> /api</Path> (the live reference page).
      </p>
      <SubHeading>Key public endpoints</SubHeading>
      <ul className="list-disc pl-6 space-y-1 text-gray-700 text-sm">
        <li><Code>GET /api/v1/nurseries/search</Code> — smart nursery search with filters</li>
        <li><Code>GET /api/v1/nurseries/:urn</Code> — full nursery profile</li>
        <li><Code>GET /api/v1/areas/:district</Code> — area intelligence summary</li>
        <li><Code>GET /api/v1/travel-time</Code> — OSRM-backed routing</li>
        <li><Code>GET /api/v1/promotions/nearby</Code> — promotions by lat/lng</li>
        <li><Code>POST /api/v1/enquiries</Code> — parent enquiry form</li>
        <li><Code>POST /api/v1/reviews</Code> — submit review (auth required)</li>
      </ul>
      <SubHeading>Auth-gated endpoints</SubHeading>
      <ul className="list-disc pl-6 space-y-1 text-gray-700 text-sm">
        <li><Code>GET /api/v1/profile</Code> — current user + role</li>
        <li><Code>GET /api/v1/shortlist</Code>, <Code>POST /api/v1/compare</Code>, etc.</li>
        <li><Code>POST /api/v1/billing/checkout</Code> — Stripe Checkout session</li>
        <li><Code>POST /api/v1/claims</Code>, <Code>POST /api/v1/provider-auth/register</Code></li>
      </ul>
      <SubHeading>Admin-only endpoints</SubHeading>
      <ul className="list-disc pl-6 space-y-1 text-gray-700 text-sm">
        <li><Code>GET /api/v1/admin/stats</Code></li>
        <li><Code>GET /api/v1/admin/users</Code>, <Code>/claims</Code>, <Code>/enquiries</Code>, <Code>/subscriptions</Code></li>
        <li><Code>GET /api/v1/admin/reports</Code>, <Code>/reports/export</Code></li>
        <li><Code>* /api/v1/admin/promotions</Code> — CRUD</li>
      </ul>
      <SubHeading>Ingest endpoints (admin + INGEST_SECRET)</SubHeading>
      <p className="text-gray-700 text-sm">
        <Code>POST /api/v1/ingest/*</Code> — protected by <Code>express-basic-auth</Code> and a
        secret. Used by cron jobs and manual data refreshes.
      </p>
    </section>
  )
}

function EnvVars() {
  return (
    <section className="space-y-3">
      <SectionHeading id="env-vars">Environment variables</SectionHeading>
      <p className="text-gray-700">
        Reference for anyone provisioning a new environment. See{' '}
        <Path>backend/.env.example</Path> and <Path>frontend/.env.example</Path> for the full
        list with placeholder values.
      </p>
      <SubHeading>Backend (Render)</SubHeading>
      <ul className="text-sm space-y-1 text-gray-700">
        <li><Code>SUPABASE_URL</Code>, <Code>SUPABASE_SERVICE_KEY</Code> — database + auth admin API</li>
        <li><Code>ADMIN_USER</Code>, <Code>ADMIN_PASS</Code> — basic auth for ingest endpoints</li>
        <li><Code>INGEST_SECRET</Code> — shared secret for worker → API calls</li>
        <li><Code>RESEND_API_KEY</Code>, <Code>EMAIL_FROM</Code>, <Code>FRONTEND_URL</Code> — email</li>
        <li><Code>STRIPE_SECRET_KEY</Code>, <Code>STRIPE_WEBHOOK_SECRET</Code>, <Code>STRIPE_PRICE_*</Code> — billing</li>
        <li><Code>ANTHROPIC_API_KEY</Code>, <Code>GOOGLE_PLACES_API_KEY</Code>, <Code>PROPERTYDATA_API_KEY</Code></li>
        <li><Code>SENTRY_DSN</Code>, <Code>ALERT_EMAIL</Code> — error tracking</li>
      </ul>
      <SubHeading>Frontend (Vercel)</SubHeading>
      <ul className="text-sm space-y-1 text-gray-700">
        <li><Code>NEXT_PUBLIC_API_URL</Code> — points at Render backend</li>
        <li><Code>NEXT_PUBLIC_SUPABASE_URL</Code>, <Code>NEXT_PUBLIC_SUPABASE_ANON_KEY</Code> — Supabase client</li>
        <li><Code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</Code> — Maps + Street View</li>
        <li><Code>NEXT_PUBLIC_PLAUSIBLE_DOMAIN</Code> — analytics (optional)</li>
        <li><Code>NEXT_PUBLIC_SENTRY_DSN</Code> — error tracking (optional)</li>
      </ul>
    </section>
  )
}

function Deployments() {
  return (
    <section className="space-y-3">
      <SectionHeading id="deployments">Deployments</SectionHeading>
      <ul className="list-disc pl-6 space-y-1 text-gray-700">
        <li><b>Frontend</b>: Vercel, auto-deploys on push to <Code>main</Code></li>
        <li><b>Backend API</b>: Render, <Path>nursery-finder-6u7r.onrender.com</Path>, auto-deploys on push</li>
        <li><b>Backend worker</b>: Render background worker, same repo, separate entry point</li>
        <li><b>Database</b>: Supabase managed</li>
        <li><b>Domain</b>: <Code>nurserymatch.com</Code> (Namecheap registrar, BasicDNS, A+CNAME pointing at Vercel)</li>
      </ul>
      <SubHeading>Security headers (frontend)</SubHeading>
      <p className="text-gray-700 text-sm">
        Defined in <Path>frontend/vercel.json</Path>. Includes HSTS, nosniff, X-Frame-Options DENY,
        Referrer-Policy, Content-Security-Policy with explicit connect-src allowlist for
        Supabase, Render API, postcodes.io, OSRM, police.uk, environment.data.gov.uk, Google Maps
        and Plausible.
      </p>
      <SubHeading>Compliance banners</SubHeading>
      <ul className="list-disc pl-6 space-y-1 text-gray-700 text-sm">
        <li><Path>OglAttribution</Path> on every page with Ofsted data (UK Open Government Licence v3)</li>
        <li><Path>StaleGradeBanner</Path> on nursery profiles with inspection &gt;4 years old</li>
        <li><Path>EnforcementBanner</Path> when <Code>enforcement_notice = true</Code></li>
      </ul>
    </section>
  )
}

/* --- Small helpers --- */

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white">
      <div className="font-semibold text-gray-900 mb-1">{title}</div>
      <div className="text-sm text-gray-700 leading-relaxed">{children}</div>
    </div>
  )
}
