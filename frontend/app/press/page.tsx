import { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Press Kit',
  description:
    'Logos, screenshots, founder bio and key stats for journalists writing about NurseryMatch.',
}

// Headline stats. Update when the underlying numbers materially change.
// These are intentionally hand-edited (not pulled from the live database)
// so a journalist quoting us is quoting a deliberate stat, not a moving
// target that drifts mid-article.
const STATS = [
  { value: '27,000+', label: 'UK nurseries listed' },
  { value: '2,000+', label: 'postcode districts' },
  { value: '100%', label: 'Ofsted register coverage' },
]

export default function PressPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold text-gray-900 mb-3">Press kit</h1>
      <p className="text-gray-600 max-w-2xl mb-10">
        For journalists, podcasters and bloggers writing about UK nurseries,
        childcare, parenting tech or the housing market for families. Use anything
        on this page — logos and copy are free to reproduce with attribution.
      </p>

      {/* Headline stats */}
      <section className="mb-12">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {STATS.map((s) => (
            <div
              key={s.label}
              className="bg-white border border-gray-200 rounded-xl p-6 text-center"
            >
              <div className="text-3xl font-bold text-blue-600">{s.value}</div>
              <div className="text-sm text-gray-600 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Boilerplate / "About NurseryMatch" */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-3">About NurseryMatch</h2>
        <div className="space-y-3 text-gray-700 leading-relaxed">
          <p>
            <strong>Short version (1 sentence):</strong> NurseryMatch is a UK comparison
            site that helps parents find and evaluate Ofsted-rated nurseries — and the
            areas around them — without having to stitch together Ofsted reports, council
            sites and Google reviews themselves.
          </p>
          <p>
            <strong>Medium version (2–3 sentences):</strong> NurseryMatch combines the
            full Ofsted Early Years Register with parent reviews, fees, funded-place
            availability, and area intelligence (crime, schools, property prices,
            transport) into one searchable, comparable view. Listings are free for
            parents and free for nurseries to claim; paid tiers let providers add photos,
            respond to enquiries, and track engagement. The site is independent of
            Ofsted and not affiliated with any nursery group.
          </p>
          <p>
            <strong>Long version (paragraph):</strong> NurseryMatch is a UK childcare
            comparison platform built on public data: the Ofsted Early Years Register
            under the Open Government Licence, Land Registry price-paid records, Police
            crime statistics, IMD deprivation indices, and the Environment Agency&apos;s
            flood data, alongside user-generated parent reviews and Q&amp;A. The product
            is designed for the moment a family is choosing where their child will spend
            their days — which often coincides with where the family will live —
            combining nursery-level detail with the area context that matters for that
            decision. NurseryMatch is independent of Ofsted, of any nursery operator,
            and of any property portal.
          </p>
        </div>
      </section>

      {/* Founder bio */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-3">Founder bio</h2>
        <div className="bg-white border border-gray-200 rounded-xl p-6 text-gray-700 leading-relaxed">
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3 mb-4">
            ⚠ Placeholder — replace with Byron&apos;s actual bio before launch.
          </p>
          <p>
            <strong>Byron Levin</strong> is the founder of NurseryMatch. <em>[Add 2-3
            sentences: background, what made you build this, where you&apos;re based,
            something human.]</em>
          </p>
          <p className="mt-3 text-sm text-gray-500">
            Press contact:{' '}
            <a href="mailto:hello@nurserymatch.com" className="text-blue-600 hover:underline">
              hello@nurserymatch.com
            </a>
          </p>
        </div>
      </section>

      {/* Logo + screenshots */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-3">Logos &amp; screenshots</h2>
        <p className="text-gray-700 leading-relaxed mb-4">
          Free to reproduce in stories about NurseryMatch with attribution. Don&apos;t
          edit the wordmark or use the colour scheme to imply Ofsted endorsement.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="border border-gray-200 rounded-xl p-6 bg-white">
            <div className="text-xl font-bold text-blue-600 mb-3">Wordmark</div>
            <p className="text-sm text-gray-600 mb-3">
              <em>[Designer to deliver SVG + PNG; once received, host at{' '}
              <code className="bg-gray-100 px-1 rounded">/press-kit/logo.svg</code>{' '}
              and link here.]</em>
            </p>
            <a
              href="/press-kit/logo.svg"
              className="text-sm text-blue-600 hover:underline pointer-events-none opacity-50"
              aria-disabled
            >
              Download SVG (pending)
            </a>
          </div>
          <div className="border border-gray-200 rounded-xl p-6 bg-white">
            <div className="text-xl font-bold text-blue-600 mb-3">Screenshots</div>
            <p className="text-sm text-gray-600">
              <em>[Hero shot, search results, area summary, nursery profile —
              deliver as 2× resolution PNGs in /press-kit/.]</em>
            </p>
          </div>
        </div>
      </section>

      {/* Brand assets — colour and typography */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-3">Brand basics</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h3 className="font-semibold text-gray-900 mb-3">Primary colour</h3>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-md bg-blue-600" aria-hidden></div>
              <div>
                <div className="font-mono text-sm text-gray-700">#2563EB</div>
                <div className="text-xs text-gray-500">blue-600</div>
              </div>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h3 className="font-semibold text-gray-900 mb-3">Typography</h3>
            <p className="text-gray-700 text-sm">
              System UI stack — Inter / SF Pro / Segoe UI. No paid fonts; the site
              loads zero web fonts.
            </p>
          </div>
        </div>
      </section>

      {/* What we typically can speak to */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-3">Topics we can speak to</h2>
        <ul className="list-disc pl-6 space-y-2 text-gray-700">
          <li>UK nursery quality and the Ofsted inspection process</li>
          <li>Funded-childcare entitlements (15h / 30h, 2yo / 3-4yo) and how parents access them</li>
          <li>Trends in nursery costs and waitlists by region</li>
          <li>How parents combine a nursery decision with a relocation decision</li>
          <li>Open-data product design (Ofsted + Land Registry + Police data + IMD)</li>
          <li>Privacy-first analytics for child-facing products</li>
        </ul>
      </section>

      {/* Contact */}
      <section className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Get in touch</h2>
        <p className="text-gray-700">
          Press, partnerships and interview requests:{' '}
          <a href="mailto:hello@nurserymatch.com" className="text-blue-700 font-semibold hover:underline">
            hello@nurserymatch.com
          </a>
          . We typically respond within 24 hours during the UK working week.
        </p>
        <p className="text-gray-700 mt-3 text-sm">
          For data corrections (parents and providers): see our{' '}
          <Link href="/contact" className="text-blue-700 hover:underline">contact page</Link>.
          For copyright takedowns: see <Link href="/dmca" className="text-blue-700 hover:underline">/dmca</Link>.
        </p>
      </section>
    </div>
  )
}
