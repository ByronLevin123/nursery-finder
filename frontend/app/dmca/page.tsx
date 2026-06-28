import { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Copyright & Content Takedown',
  description:
    'How to request removal of copyrighted material or incorrect information from NurseryMatch.',
}

export default function DmcaPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-3">Copyright &amp; Content Takedown</h1>
      <p className="text-gray-600 mb-10">
        How to ask us to remove copyrighted material, correct factual errors, or take down
        content you believe is unlawful or harmful.
      </p>

      <div className="space-y-10 text-gray-700 leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">If you own the copyright in content on our site</h2>
          <p className="mb-3">
            NurseryMatch respects intellectual property rights. If you believe content on our
            site infringes your copyright, send a notice to{' '}
            <a href="mailto:legal@nurserymatch.com" className="text-blue-600 hover:underline">
              legal@nurserymatch.com
            </a>{' '}
            including <strong>all</strong> of:
          </p>
          <ol className="list-decimal pl-6 space-y-2">
            <li>Your name, address, telephone number and email address.</li>
            <li>
              The exact URL on nurserymatch.com where the material appears (e.g.
              <code className="ml-1 px-1 bg-gray-100 rounded text-sm">https://nurserymatch.com/nursery/EY...</code>).
            </li>
            <li>A description of the work you say is infringed.</li>
            <li>
              A statement that you have a good-faith belief that the use of the material is
              not authorised by you, your agent, or the law.
            </li>
            <li>
              A statement, made under penalty of perjury, that the information in your notice
              is accurate and that you are the rights-holder or are authorised to act on their
              behalf.
            </li>
            <li>Your physical or electronic signature.</li>
          </ol>
          <p className="mt-3">
            We aim to acknowledge within 2 working days and to remove or restrict access to
            verifiably infringing content promptly. We may share your notice with the user who
            posted the content, who will have the right to respond.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">If you&apos;re a nursery provider and your listing is wrong</h2>
          <p>
            For information you can edit yourself (description, opening hours, fees, photos),
            please{' '}
            <Link href="/provider/register" className="text-blue-600 hover:underline">
              claim your listing
            </Link>{' '}
            and update it from your provider dashboard. For Ofsted data (grade, inspection date,
            registration status), contact Ofsted to update the official register — the corrected
            data will flow through to NurseryMatch on our next refresh.
          </p>
          <p className="mt-3">
            For urgent factual corrections that fall outside those, email{' '}
            <a href="mailto:hello@nurserymatch.com" className="text-blue-600 hover:underline">
              hello@nurserymatch.com
            </a>{' '}
            with the listing URL and the correction.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">If a review or piece of user content is unlawful or harmful</h2>
          <p className="mb-3">
            We moderate every review before it goes live and remove content that is abusive,
            defamatory, contains personal data about individual staff, or is clearly fake. If
            you believe a review on your nursery&apos;s listing breaches our review guidelines,
            email{' '}
            <a href="mailto:hello@nurserymatch.com" className="text-blue-600 hover:underline">
              hello@nurserymatch.com
            </a>{' '}
            with:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>The listing URL.</li>
            <li>The text of the review you&apos;re asking us to look at.</li>
            <li>
              A short note on why you believe it breaches our{' '}
              <Link href="/terms" className="text-blue-600 hover:underline">terms</Link>.
            </li>
          </ul>
          <p className="mt-3">
            We aim to respond within 2 working days. We will not remove a review simply for
            being negative — honest criticism is allowed. We will remove reviews that fail our
            content rules.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Counter-notice</h2>
          <p>
            If we&apos;ve removed content you posted and you believe the takedown was made in
            error, you can send a counter-notice to the same address with the URL of the
            removed content, your reasons for believing it should be restored, and your contact
            details. We&apos;ll review and respond.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">A note on Ofsted data</h2>
          <p>
            Ofsted inspection data on NurseryMatch is sourced from the Early Years Register and
            published under the{' '}
            <a
              href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              Open Government Licence v3.0
            </a>
            . Takedown requests for Ofsted data should be directed to Ofsted in the first
            instance — we cannot remove or alter the official inspection record.
          </p>
        </section>
      </div>
    </div>
  )
}
