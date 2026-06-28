import { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Frequently Asked Questions',
  description:
    'Common questions about NurseryMatch — how listings work, what the Ofsted grades mean, how providers claim their profile, pricing, privacy, and more.',
}

interface QA {
  q: string
  /** Plain-text answer used for the FAQPage schema. Keep <60 words. */
  aText: string
  /** Rich JSX rendered on the page. */
  aHtml: React.ReactNode
}

const PARENT_FAQS: QA[] = [
  {
    q: 'Where does NurseryMatch get its nursery data?',
    aText:
      'Listings come from the official Ofsted Early Years Register under the Open Government Licence. We refresh this data regularly. Photos, descriptions and opening hours come from providers who have claimed their listings.',
    aHtml: (
      <p>
        Listings come from the official{' '}
        <a
          href="https://www.gov.uk/government/statistical-data-sets/monthly-management-information-ofsteds-early-years-register"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
        >
          Ofsted Early Years Register
        </a>{' '}
        under the Open Government Licence v3.0. We refresh inspection data regularly. Photos,
        descriptions and opening hours come from nurseries that have{' '}
        <Link href="/for-providers" className="text-blue-600 hover:underline">
          claimed their listings
        </Link>.
      </p>
    ),
  },
  {
    q: 'What do the Ofsted grades mean?',
    aText:
      'Ofsted rates nurseries Outstanding, Good, Requires Improvement or Inadequate. Grades reflect inspection at a single point in time. Inspections happen roughly every 4 years for Good or Outstanding settings.',
    aHtml: (
      <>
        <p className="mb-2">
          Ofsted rates each nursery on four grades, based on a full inspection:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Outstanding</strong> — the highest grade.</li>
          <li><strong>Good</strong> — meets all standards.</li>
          <li><strong>Requires Improvement</strong> — falls short on one or more standards; will be re-inspected sooner.</li>
          <li><strong>Inadequate</strong> — serious concerns; closely monitored.</li>
        </ul>
        <p className="mt-2">
          Inspections happen roughly every 4 years for Good or Outstanding settings, and more
          frequently for the lower grades. We flag a banner on profiles where the last inspection
          is over 4 years old so you can weigh how current the grade is.
        </p>
      </>
    ),
  },
  {
    q: 'Is it free to use?',
    aText:
      'Yes — search, compare, shortlist, reviews, the quiz, and area intelligence are all free for parents. NurseryMatch is funded by optional paid subscriptions for nursery providers.',
    aHtml: (
      <p>
        Yes. Search, comparison, shortlisting, reviews, the quiz, area intelligence and the AI
        family-move assistant are all free for parents. NurseryMatch is funded by optional paid
        subscriptions for nursery providers — the{' '}
        <Link href="/pricing" className="text-blue-600 hover:underline">pricing page</Link> covers
        what each tier includes.
      </p>
    ),
  },
  {
    q: 'How are reviews moderated?',
    aText:
      'Every review is checked before going live. We accept honest opinions but remove abusive content, personal data about staff, and clearly fake reviews. Providers can reply to reviews on their listing.',
    aHtml: (
      <p>
        Every review is checked before going live. We accept honest opinions — positive or
        negative — but remove abusive content, personal data about individual staff, and
        clearly fake reviews. Nursery owners who have claimed their profile can reply to reviews
        publicly on their listing.
      </p>
    ),
  },
  {
    q: 'How does the AI assistant work?',
    aText:
      "The AI Family Move Assistant takes a natural-language description of what you're looking for and ranks UK postcode districts using public data on schools, crime, property prices and nursery density.",
    aHtml: (
      <p>
        Tell the{' '}
        <Link href="/assistant" className="text-blue-600 hover:underline">
          AI Family Move Assistant
        </Link>{' '}
        what matters to you in plain English (&quot;family of 4, budget £700k, good primary
        schools, 30 min commute to Waterloo&quot;), and it ranks UK postcode districts using
        public data on schools, crime, property prices, nursery density and more. It&apos;s a
        starting point for your search, not a recommendation.
      </p>
    ),
  },
  {
    q: 'Can I delete my account and data?',
    aText:
      'Yes. From your account settings you can export all your data as JSON or permanently delete your account. Deletion is immediate and removes your profile, reviews, shortlists, enquiries and saved searches.',
    aHtml: (
      <p>
        Yes — from your{' '}
        <Link href="/account" className="text-blue-600 hover:underline">account page</Link> you
        can either export all your data as JSON or permanently delete your account. Deletion is
        immediate and removes your profile, reviews, shortlists, enquiries and saved searches.
      </p>
    ),
  },
]

const PROVIDER_FAQS: QA[] = [
  {
    q: 'I run a nursery — how do I claim our listing?',
    aText:
      "Visit /provider/register, fill in your details and the nursery's URN, and we'll email you a magic link. Most claims are reviewed and approved within 24 hours.",
    aHtml: (
      <p>
        Visit{' '}
        <Link href="/provider/register" className="text-blue-600 hover:underline">
          /provider/register
        </Link>
        , fill in your details and the nursery&apos;s URN (you can search by name or postcode),
        and we&apos;ll email you a magic link. Most claims are reviewed and approved within 24
        hours.
      </p>
    ),
  },
  {
    q: 'What does the paid tier include?',
    aText:
      'Paid tiers unlock photo uploads, instant enquiry notifications, profile analytics, response-time badges and priority support. Free claimed listings get the basics: edit description, hours and contact details.',
    aHtml: (
      <p>
        Paid tiers unlock photo uploads, instant enquiry notifications, profile analytics,
        response-time badges and priority support. Free claimed listings get the basics — edit
        description, opening hours, fees and contact details. Full feature comparison is on the{' '}
        <Link href="/pricing" className="text-blue-600 hover:underline">pricing page</Link>.
      </p>
    ),
  },
  {
    q: 'Can I have a higher Ofsted grade or boost my ranking by paying?',
    aText:
      "No. Ofsted grades come from the official register and we never edit them. Paid tiers don't influence ranking — they only give providers control of their profile and faster enquiry response.",
    aHtml: (
      <p>
        No. Ofsted grades come from the official register and we never edit them. Paid tiers
        don&apos;t influence search ranking — they only give providers control of their profile,
        photos, and faster enquiry response. We&apos;re strict about this because trust is the
        whole product.
      </p>
    ),
  },
  {
    q: "There's an error on our listing — how do I fix it?",
    aText:
      'For information you control (description, hours, fees, photos), claim your listing and edit it directly. For Ofsted data, contact Ofsted to update the official register and the change will flow through to us.',
    aHtml: (
      <p>
        For information you can edit (description, hours, fees, contact details, photos), claim
        your listing and update it directly from your provider dashboard. For Ofsted data
        (grade, inspection date, registration status) you&apos;ll need to contact Ofsted to
        update the official register — the change will flow through to NurseryMatch on our next
        refresh. For anything else, email{' '}
        <a href="mailto:hello@nurserymatch.com" className="text-blue-600 hover:underline">
          hello@nurserymatch.com
        </a>.
      </p>
    ),
  },
]

const ALL_FAQS = [...PARENT_FAQS, ...PROVIDER_FAQS]

// FAQPage structured data — Google uses this to surface answers in search.
const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: ALL_FAQS.map((qa) => ({
    '@type': 'Question',
    name: qa.q,
    acceptedAnswer: {
      '@type': 'Answer',
      text: qa.aText,
    },
  })),
}

function Section({ title, items }: { title: string; items: QA[] }) {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-semibold text-gray-900">{title}</h2>
      <div className="space-y-5">
        {items.map((qa) => (
          <details
            key={qa.q}
            className="group border border-gray-200 rounded-xl bg-white px-5 py-4 open:bg-gray-50/50"
          >
            <summary className="font-semibold text-gray-900 cursor-pointer list-none flex justify-between items-start gap-3">
              <span>{qa.q}</span>
              <span className="text-blue-600 text-sm shrink-0 select-none group-open:rotate-180 transition">
                ▾
              </span>
            </summary>
            <div className="mt-3 text-gray-700 leading-relaxed">{qa.aHtml}</div>
          </details>
        ))}
      </div>
    </section>
  )
}

export default function FaqPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      {/* eslint-disable-next-line react/no-danger */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <h1 className="text-4xl font-bold text-gray-900 mb-3">Frequently Asked Questions</h1>
      <p className="text-gray-600 mb-10">
        Quick answers to the things parents and providers ask most often. Don&apos;t see your
        question? Email{' '}
        <a href="mailto:hello@nurserymatch.com" className="text-blue-600 hover:underline">
          hello@nurserymatch.com
        </a>.
      </p>

      <div className="space-y-12">
        <Section title="For parents" items={PARENT_FAQS} />
        <Section title="For nursery providers" items={PROVIDER_FAQS} />
      </div>
    </div>
  )
}
