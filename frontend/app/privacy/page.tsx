import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'NurseryFinder privacy policy — how we handle your data under UK GDPR.',
}

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Privacy Policy</h1>

      <div className="prose prose-gray max-w-none space-y-6">
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Who we are</h2>
          <p className="text-gray-600">
            NurseryFinder is an independent website that helps parents find and compare
            Ofsted-rated nurseries across the UK. We are registered as a data controller
            with the ICO (UK Information Commissioner's Office).
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">What data we collect</h2>
          <ul className="list-disc pl-5 text-gray-600 space-y-2">
            <li><strong>Nursery search queries</strong> — postcode and filters. Anonymised, no personal data stored.</li>
            <li><strong>Fee submissions</strong> — anonymous. No name or email collected.</li>
            <li><strong>Feedback forms</strong> — your email address (optional), stored for 30 days then deleted.</li>
            <li><strong>Website analytics</strong> — we use Plausible Analytics which is cookieless and collects no personal data.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">What we do NOT collect</h2>
          <ul className="list-disc pl-5 text-gray-600 space-y-2">
            <li>No tracking cookies</li>
            <li>No advertising profiles</li>
            <li>No third-party analytics that track you across websites</li>
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
          <p className="text-gray-600">
            Under UK GDPR you have the right to access, correct, or delete any personal
            data we hold. Email:{' '}
            <a href="mailto:privacy@nurseryfinder.co.uk" className="text-blue-600 hover:underline">
              privacy@nurseryfinder.co.uk
            </a>
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Data retention</h2>
          <p className="text-gray-600">
            Feedback emails deleted after 30 days. Analytics data retained for 90 days
            (no personal data).
          </p>
        </section>

        <p className="text-sm text-gray-400 mt-8">
          Last updated: February 2026
        </p>
      </div>
    </div>
  )
}
