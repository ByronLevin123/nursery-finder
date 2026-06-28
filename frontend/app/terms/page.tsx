import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'NurseryMatch terms of service — rules for using our nursery comparison platform.',
}

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Terms of Service</h1>

      <div className="prose prose-gray max-w-none space-y-6">
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">1. About these terms</h2>
          <p className="text-gray-600">
            These terms govern your use of nurserymatch.com (&quot;the Site&quot;), operated by
            NurseryMatch (&quot;we&quot;, &quot;us&quot;). By using the Site you agree to these terms.
            If you do not agree, please do not use the Site.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">2. What the Site provides</h2>
          <p className="text-gray-600">
            The Site provides information about UK nurseries sourced from Ofsted&apos;s public register
            (published under the Open Government Licence v3.0), along with tools to search, compare,
            and review nurseries. We also display area statistics including crime data, deprivation
            indices, and property prices sourced from other open UK government datasets.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Accuracy of information</h2>
          <p className="text-gray-600">
            We make every effort to keep nursery data accurate and up to date, but we do not guarantee
            the completeness or accuracy of any information on the Site. Ofsted ratings, fees, and
            availability may change at any time. Always verify directly with the nursery before making
            childcare decisions. The Site is not affiliated with or endorsed by Ofsted, the UK
            Government, or any nursery provider.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">4. User accounts</h2>
          <p className="text-gray-600">
            You may create an account using your email address. You are responsible for maintaining
            the security of your account. You must not share your account with others or create
            multiple accounts. We reserve the right to suspend or delete accounts that violate these
            terms.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Reviews and user content</h2>
          <p className="text-gray-600">
            By submitting a review you grant us a non-exclusive, royalty-free licence to display it
            on the Site. Reviews must be honest, based on genuine experience, and must not contain
            defamatory, abusive, or misleading content. We reserve the right to remove reviews that
            violate these rules.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Provider accounts</h2>
          <p className="text-gray-600">
            Nursery providers may claim their listing and access additional features. Claims are
            subject to verification. Providers must not post false or misleading information about
            their nursery. Paid provider subscriptions are subject to the pricing and billing terms
            displayed at the time of purchase.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Acceptable use</h2>
          <p className="text-gray-600">
            You must not use the Site to scrape data at scale, attempt to access systems without
            authorisation, distribute malware, or engage in any activity that disrupts the Site or
            its users. Automated access is permitted only via our published API endpoints.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Limitation of liability</h2>
          <p className="text-gray-600">
            To the fullest extent permitted by law, we are not liable for any indirect, incidental,
            or consequential damages arising from your use of the Site. Our total liability to you
            shall not exceed the amount you have paid us (if any) in the 12 months preceding the
            claim. Nothing in these terms limits our liability for fraud, death, or personal injury
            caused by our negligence.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Privacy</h2>
          <p className="text-gray-600">
            Your use of the Site is also subject to our{' '}
            <a href="/privacy" className="text-blue-600 hover:underline">
              Privacy Policy
            </a>
            , which explains how we collect, use, and protect your personal data under UK GDPR.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Changes to these terms</h2>
          <p className="text-gray-600">
            We may update these terms from time to time. Material changes will be communicated via
            the Site or email. Continued use after changes constitutes acceptance.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">11. Governing law</h2>
          <p className="text-gray-600">
            These terms are governed by the laws of England and Wales. Disputes shall be subject to
            the exclusive jurisdiction of the courts of England and Wales.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">12. Contact</h2>
          <p className="text-gray-600">
            Questions about these terms? Email us at{' '}
            <a href="mailto:hello@nurserymatch.com" className="text-blue-600 hover:underline">
              hello@nurserymatch.com
            </a>
          </p>
        </section>

        <p className="text-sm text-gray-400 mt-8">Last updated: April 2026</p>
      </div>
    </div>
  )
}
