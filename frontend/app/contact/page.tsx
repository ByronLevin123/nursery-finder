import { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Contact Us',
  description:
    'Get in touch with Compare the Nursery. Reach out for general enquiries, provider support, or data issues.',
}

export default function ContactPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">Contact Us</h1>

      <p className="text-gray-600 mb-8">
        We would love to hear from you. Whether you have a question about our nursery listings,
        need help with your provider account, or want to report a data issue, our team is here
        to help.
      </p>

      <div className="prose prose-gray max-w-none space-y-8">
        {/* General enquiries */}
        <section className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">General Enquiries</h2>
          <p className="text-gray-600 mb-3">
            For general questions about Compare the Nursery, feedback, or partnership
            opportunities:
          </p>
          <a
            href="mailto:hello@comparethenursery.com"
            className="inline-flex items-center gap-2 text-indigo-600 font-semibold hover:underline"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-5 h-5"
            >
              <path d="M3 4a2 2 0 0 0-2 2v1.161l8.441 4.221a1.25 1.25 0 0 0 1.118 0L19 7.162V6a2 2 0 0 0-2-2H3Z" />
              <path d="m19 8.839-7.77 3.885a2.75 2.75 0 0 1-2.46 0L1 8.839V14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.839Z" />
            </svg>
            hello@comparethenursery.com
          </a>
        </section>

        {/* For providers */}
        <section className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">For Nursery Providers</h2>
          <p className="text-gray-600 mb-3">
            If you run a nursery and want to manage your listing, claim your page, or learn
            about our provider tools:
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/claim"
              className="inline-block px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition"
            >
              Claim Your Nursery
            </Link>
            <Link
              href="/for-providers"
              className="inline-block px-4 py-2 border border-indigo-600 text-indigo-600 text-sm font-semibold rounded-lg hover:bg-indigo-50 transition"
            >
              Provider Information
            </Link>
          </div>
        </section>

        {/* Data issues / privacy */}
        <section className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Data Issues &amp; Privacy
          </h2>
          <p className="text-gray-600 mb-3">
            If you have found incorrect data on a nursery listing, or have a question
            about your personal data under UK GDPR:
          </p>
          <a
            href="mailto:privacy@comparethenursery.com"
            className="inline-flex items-center gap-2 text-indigo-600 font-semibold hover:underline"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-5 h-5"
            >
              <path
                fillRule="evenodd"
                d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z"
                clipRule="evenodd"
              />
            </svg>
            privacy@comparethenursery.com
          </a>
        </section>

        {/* Response time */}
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-6 text-center">
          <p className="text-indigo-900 font-medium">
            We aim to respond within 2 working days.
          </p>
          <p className="text-sm text-indigo-700 mt-1">
            For urgent data corrections, please include the nursery name and URN in your
            email.
          </p>
        </div>
      </div>
    </div>
  )
}
