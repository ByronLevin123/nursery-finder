import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Compare the Nursery privacy policy — how we handle your data under UK GDPR.',
}

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Privacy Policy</h1>

      <div className="prose prose-gray max-w-none space-y-6">
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Who we are</h2>
          <p className="text-gray-600">
            Compare the Nursery is an independent website that helps parents find and compare
            Ofsted-rated nurseries across the UK. We are registered as a data controller
            with the ICO (UK Information Commissioner's Office).
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">What data we collect</h2>
          <ul className="list-disc pl-5 text-gray-600 space-y-2">
            <li><strong>Account information</strong> — email address, display name, postcodes, and children details you choose to provide.</li>
            <li><strong>Reviews</strong> — nursery reviews you submit, including rating and text content.</li>
            <li><strong>Messages and enquiries</strong> — messages sent to nursery providers through our platform.</li>
            <li><strong>Saved searches</strong> — search criteria you choose to save.</li>
            <li><strong>Provider claims</strong> — information submitted when claiming a nursery listing.</li>
            <li><strong>Nursery search queries</strong> — postcode and filters. Anonymised, no personal data stored.</li>
            <li><strong>Website analytics</strong> — we use Plausible Analytics which is cookieless and collects no personal data.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">What we do NOT collect</h2>
          <ul className="list-disc pl-5 text-gray-600 space-y-2">
            <li>No tracking cookies</li>
            <li>No advertising profiles</li>
            <li>No third-party analytics that track you across websites</li>
            <li>No payment card details (payments processed securely by Stripe)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Ofsted data</h2>
          <p className="text-gray-600">
            Inspection data is sourced from the Ofsted Early Years Register, published
            under the Open Government Licence v3.0. We are not affiliated with Ofsted
            or the UK Government.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Your rights</h2>
          <p className="text-gray-600 mb-2">
            Under UK GDPR you have the right to access, correct, or delete any personal
            data we hold. You can:
          </p>
          <ul className="list-disc pl-5 text-gray-600 space-y-2">
            <li><strong>Export your data</strong> — download all your data from your{' '}
              <a href="/account" className="text-blue-600 hover:underline">account settings</a> page.
            </li>
            <li><strong>Delete your account</strong> — permanently remove your account and all associated data from your{' '}
              <a href="/account" className="text-blue-600 hover:underline">account settings</a> page.
            </li>
            <li><strong>Contact us</strong> — email{' '}
              <a href="mailto:privacy@comparethenursery.com" className="text-blue-600 hover:underline">
                privacy@comparethenursery.com
              </a>{' '}for any data request.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Data retention</h2>
          <p className="text-gray-600">
            Account data is retained until you delete your account. Analytics data is
            retained for 90 days (no personal data). Email drip sequences stop when you
            unsubscribe or delete your account.
          </p>
        </section>

        <p className="text-sm text-gray-400 mt-8">
          Last updated: April 2026
        </p>
      </div>
    </div>
  )
}
