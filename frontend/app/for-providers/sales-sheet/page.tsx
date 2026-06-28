import { Metadata } from 'next'
import Link from 'next/link'
import PrintButton from './PrintButton'

export const metadata: Metadata = {
  title: 'NurseryMatch for Providers — Sales sheet',
  description: 'A one-page summary of what NurseryMatch offers nursery providers. Print-friendly.',
  robots: { index: false, follow: true },
}

/**
 * Print-friendly 1-page sell sheet for nursery providers.
 *
 * Designed to render to A4 cleanly when the user does Cmd+P → Save as PDF.
 * Print rules: hide nav/footer, fit to one page, 12mm margins.
 * Short URL (`/for-providers/sales-sheet`) so it's easy to share in emails.
 */
export default function SalesSheetPage() {
  return (
    <>
      {/* Print-mode CSS. Strips nav/footer + cookie banner so the PDF is
          purely the sell sheet. */}
      <style>{`
        @media print {
          @page { size: A4; margin: 12mm; }
          nav, footer, [aria-label="Cookie notice"] { display: none !important; }
          .no-print { display: none !important; }
          body { background: white !important; }
          .sales-sheet { box-shadow: none !important; border: none !important; }
        }
      `}</style>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* On-screen print button */}
        <div className="no-print mb-6 flex items-center justify-between">
          <Link href="/for-providers" className="text-sm text-blue-600 hover:underline">
            ← Back to provider overview
          </Link>
          <PrintButton />
        </div>

        <article className="sales-sheet bg-white border border-gray-200 rounded-xl p-8 shadow-sm">
          {/* Header */}
          <header className="border-b border-gray-200 pb-5 mb-6">
            <div className="flex items-start justify-between gap-6">
              <div>
                <div className="text-xl font-bold text-blue-600 mb-1">NurseryMatch</div>
                <h1 className="text-2xl font-bold text-gray-900 leading-tight">
                  Get found by local parents searching for nurseries.
                </h1>
              </div>
              <div className="text-right text-xs text-gray-500 leading-snug shrink-0">
                <div>nurserymatch.com</div>
                <div>hello@nurserymatch.com</div>
              </div>
            </div>
          </header>

          {/* Why claim */}
          <section className="mb-6">
            <h2 className="text-base font-semibold text-gray-900 mb-2">
              The opportunity
            </h2>
            <p className="text-sm text-gray-700 leading-relaxed">
              Your nursery is already on NurseryMatch — every UK setting in the Ofsted
              register is. Parents in your area are searching, comparing, and shortlisting.
              The question is whether <em>you</em> control how your nursery looks to them, or
              whether the only thing they see is the bare Ofsted grade.
            </p>
          </section>

          {/* What claiming gets you (table) */}
          <section className="mb-6">
            <h2 className="text-base font-semibold text-gray-900 mb-3">
              Free vs Pro at a glance
            </h2>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-300">
                  <th className="text-left py-2 font-semibold text-gray-700">Feature</th>
                  <th className="text-center py-2 font-semibold text-gray-700 w-24">Free</th>
                  <th className="text-center py-2 font-semibold text-blue-600 w-24">Pro</th>
                </tr>
              </thead>
              <tbody>
                <Row label="Claim your listing" free pro />
                <Row label="Edit description, hours, fees, contact details" free pro />
                <Row label="Receive parent enquiries by email" free pro />
                <Row label="Photo gallery" pro />
                <Row label="Instant enquiry notifications" pro />
                <Row label="Profile views & engagement analytics" pro />
                <Row label="Response-time badge ('Replies within X hours')" pro />
                <Row label="Priority support" pro />
              </tbody>
            </table>
          </section>

          {/* Trust */}
          <section className="mb-6 grid grid-cols-3 gap-3">
            <Stat
              label="Source"
              value="Official Ofsted register"
            />
            <Stat
              label="Listing accuracy"
              value="Updated monthly from Ofsted"
            />
            <Stat
              label="Parent reviews"
              value="Pre-publish moderated"
            />
          </section>

          {/* Honest disclaimers */}
          <section className="mb-6 bg-gray-50 border border-gray-200 rounded-md p-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-2">What we won&apos;t do</h2>
            <ul className="text-xs text-gray-700 space-y-1 list-disc pl-4">
              <li>Edit your Ofsted grade — we never alter the official register.</li>
              <li>Boost your search ranking because you pay us — paid tiers unlock features, not visibility tricks.</li>
              <li>Sell your data — we have no advertising or data-sharing relationships.</li>
              <li>Hide negative reviews — we moderate for honesty, not flattery.</li>
            </ul>
          </section>

          {/* Pricing snapshot */}
          <section className="mb-6">
            <h2 className="text-base font-semibold text-gray-900 mb-2">Pricing</h2>
            <p className="text-sm text-gray-700">
              <strong>Free</strong> to claim and run a basic listing.
              <strong className="ml-2">Pro</strong> at £29/mo (or annually with a discount).
              <strong className="ml-2">Premium</strong> at £79/mo for multi-site groups.
              14-day cooling-off refund on new subscriptions; cancel anytime from your dashboard.
              See <Link href="/pricing" className="text-blue-600 hover:underline">/pricing</Link>{' '}
              and <Link href="/refund" className="text-blue-600 hover:underline">/refund</Link>.
            </p>
          </section>

          {/* CTA */}
          <section className="text-center bg-blue-50 border border-blue-200 rounded-lg p-5">
            <h2 className="text-lg font-bold text-gray-900 mb-1">
              Ready to claim?
            </h2>
            <p className="text-sm text-gray-700 mb-3">
              Most claims are reviewed within 24 hours.
            </p>
            <Link
              href="/provider/register"
              className="inline-block px-6 py-2 bg-blue-600 text-white text-sm font-semibold rounded-md hover:bg-blue-700"
            >
              Claim at nurserymatch.com/provider/register
            </Link>
          </section>

          {/* Footer */}
          <footer className="mt-6 pt-4 border-t border-gray-200 text-xs text-gray-500 leading-relaxed">
            NurseryMatch is independent of Ofsted and the UK Government. Inspection data
            is sourced from the Ofsted Early Years Register under the Open Government
            Licence v3.0.
          </footer>
        </article>
      </div>
    </>
  )
}

function Row({ label, free, pro }: { label: string; free?: boolean; pro?: boolean }) {
  const Tick = () => (
    <span className="text-green-600 font-semibold" aria-label="included">✓</span>
  )
  const Dash = () => (
    <span className="text-gray-300" aria-label="not included">—</span>
  )
  return (
    <tr className="border-b border-gray-100">
      <td className="py-2 text-gray-700">{label}</td>
      <td className="text-center">{free ? <Tick /> : <Dash />}</td>
      <td className="text-center">{pro ? <Tick /> : <Dash />}</td>
    </tr>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-gray-200 rounded-md p-3 bg-white">
      <div className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold">
        {label}
      </div>
      <div className="text-sm text-gray-900 mt-1">{value}</div>
    </div>
  )
}
