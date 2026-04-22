import { Metadata } from 'next'
import Link from 'next/link'
import RoiCalculator from '@/components/RoiCalculator'
import OglAttribution from '@/components/OglAttribution'

export const metadata: Metadata = {
  title: 'For Nursery Providers — Grow Your Nursery | NurseryMatch',
  description:
    'Claim your free listing on NurseryMatch. Get found by local parents, manage your reputation, and fill your spaces faster. 27,000+ nurseries listed.',
  keywords: [
    'nursery marketing',
    'nursery listing',
    'childcare provider',
    'nursery enquiries',
    'Ofsted nursery',
    'nursery promotion',
  ],
  openGraph: {
    title: 'Grow Your Nursery with NurseryMatch',
    description:
      'Claim your free listing. Get found by parents, manage reviews, and fill spaces faster.',
  },
}

function CheckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="w-5 h-5 text-emerald-500 flex-shrink-0"
    >
      <path
        fillRule="evenodd"
        d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
        clipRule="evenodd"
      />
    </svg>
  )
}

export default function ForProvidersPage() {
  return (
    <main className="min-h-screen bg-white">
      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-600 to-blue-800 text-white">
        <div className="max-w-5xl mx-auto px-4 py-20 md:py-28 text-center">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-6">
            Grow your nursery with NurseryMatch
          </h1>
          <p className="text-lg md:text-xl text-blue-100 max-w-2xl mx-auto mb-8">
            Parents across the UK use NurseryMatch to find the right nursery for their family.
            Make sure they find yours.
          </p>
          <Link
            href="/provider/register"
            className="inline-block px-8 py-4 bg-white text-blue-700 font-bold text-lg rounded-xl shadow-lg hover:shadow-xl hover:bg-blue-50 transition"
          >
            Claim your free listing
          </Link>
        </div>
      </section>

      {/* Stats bar */}
      <section className="bg-gray-50 border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-8 grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
          <div>
            <p className="text-3xl font-extrabold text-gray-900">27,000+</p>
            <p className="text-sm text-gray-500 mt-1">Nurseries listed</p>
          </div>
          <div>
            <p className="text-3xl font-extrabold text-gray-900">Thousands</p>
            <p className="text-sm text-gray-500 mt-1">Parents searching daily</p>
          </div>
          <div>
            <p className="text-3xl font-extrabold text-gray-900">Free</p>
            <p className="text-sm text-gray-500 mt-1">To get started</p>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="max-w-5xl mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
          Why list on NurseryMatch?
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <BenefitCard
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
                <path fillRule="evenodd" d="m11.54 22.351.07.04.028.016a.76.76 0 0 0 .723 0l.028-.015.071-.041a16.975 16.975 0 0 0 1.144-.742 19.58 19.58 0 0 0 2.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 0 0-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 0 0 2.682 2.282 16.975 16.975 0 0 0 1.145.742ZM12 13.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clipRule="evenodd" />
              </svg>
            }
            title="Get found by parents"
            description="Your nursery appears in search results when parents look for childcare near them. Appear alongside your Ofsted rating and reviews."
          />
          <BenefitCard
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
                <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z" clipRule="evenodd" />
              </svg>
            }
            title="Manage your reputation"
            description="Respond to parent reviews, keep your listing accurate, and showcase what makes your nursery special. First impressions matter."
          />
          <BenefitCard
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
                <path d="M1.5 8.67v8.58a3 3 0 0 0 3 3h15a3 3 0 0 0 3-3V8.67l-8.928 5.493a3 3 0 0 1-3.144 0L1.5 8.67Z" />
                <path d="M22.5 6.908V6.75a3 3 0 0 0-3-3h-15a3 3 0 0 0-3 3v.158l9.714 5.978a1.5 1.5 0 0 0 1.572 0L22.5 6.908Z" />
              </svg>
            }
            title="Fill your spaces faster"
            description="Receive enquiries directly from interested parents. Let them book visits online and see your available sessions — no phone tag needed."
          />
        </div>
      </section>

      {/* How it works */}
      <section className="bg-gray-50 border-y border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-16">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
            How it works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <StepCard step={1} title="Find your nursery" description="Search by name, postcode, or URN to find your existing listing on NurseryMatch." />
            <StepCard step={2} title="Claim it" description="Verify you are the owner or manager. We review claims within 24 hours." />
            <StepCard step={3} title="Go live" description="Update your profile, add photos, set your hours, and start receiving enquiries from parents." />
          </div>
        </div>
      </section>

      {/* Pricing preview */}
      <section className="max-w-5xl mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-gray-900 text-center mb-4">
          Simple, transparent pricing
        </h2>
        <p className="text-center text-gray-500 mb-10 max-w-xl mx-auto">
          Start free. Upgrade when you are ready to grow.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <PricingCard
            tier="Free"
            price="0"
            description="Get started"
            features={[
              'Claim your listing',
              'Update basic info',
              'Receive up to 3 enquiries/mo',
              'Respond to reviews',
            ]}
          />
          <PricingCard
            tier="Pro"
            price="29"
            description="Most popular"
            highlighted
            features={[
              'Everything in Free',
              'Unlimited enquiries',
              'Photo gallery',
              'Featured in search results',
              'Analytics dashboard',
            ]}
          />
          <PricingCard
            tier="Premium"
            price="79"
            description="Maximum visibility"
            features={[
              'Everything in Pro',
              'Priority search placement',
              'Custom branding',
              'Advanced analytics',
              'Dedicated support',
            ]}
          />
        </div>
        <div className="text-center mt-8">
          <Link href="/pricing" className="text-blue-600 hover:text-blue-700 font-medium text-sm">
            View full pricing details &rarr;
          </Link>
        </div>
      </section>

      {/* Testimonials placeholder */}
      <section className="bg-gray-50 border-y border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-16">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-10">
            Trusted by nursery providers
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <TestimonialCard
              quote="Since claiming our listing, we have seen a noticeable uptick in enquiries from local parents."
              author="Nursery Manager"
              location="London"
            />
            <TestimonialCard
              quote="The dashboard makes it easy to see how many parents are viewing our profile each month."
              author="Nursery Owner"
              location="Manchester"
            />
            <TestimonialCard
              quote="We filled two long-standing vacancies within weeks of upgrading to Pro."
              author="Childcare Provider"
              location="Bristol"
            />
          </div>
        </div>
      </section>

      {/* ROI Calculator */}
      <section className="max-w-5xl mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-gray-900 text-center mb-4">
          Calculate your return
        </h2>
        <p className="text-center text-gray-500 mb-10 max-w-xl mx-auto">
          See how much additional revenue NurseryMatch could generate for your nursery.
        </p>
        <RoiCalculator />
      </section>

      {/* Final CTA */}
      <section className="bg-gradient-to-br from-blue-600 to-blue-800 text-white">
        <div className="max-w-3xl mx-auto px-4 py-16 text-center">
          <h2 className="text-3xl md:text-4xl font-extrabold mb-4">
            Ready to grow your nursery?
          </h2>
          <p className="text-lg text-blue-100 mb-8">
            Find and claim your nursery now. It takes less than two minutes.
          </p>
          <Link
            href="/provider/register"
            className="inline-block px-8 py-4 bg-white text-blue-700 font-bold text-lg rounded-xl shadow-lg hover:shadow-xl hover:bg-blue-50 transition"
          >
            Find and claim your nursery
          </Link>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 py-4">
        <OglAttribution />
      </div>
    </main>
  )
}

function BenefitCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
      <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
    </div>
  )
}

function StepCard({
  step,
  title,
  description,
}: {
  step: number
  title: string
  description: string
}) {
  return (
    <div className="text-center">
      <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-lg font-bold mx-auto mb-4">
        {step}
      </div>
      <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
    </div>
  )
}

function PricingCard({
  tier,
  price,
  description,
  features,
  highlighted,
}: {
  tier: string
  price: string
  description: string
  features: string[]
  highlighted?: boolean
}) {
  return (
    <div
      className={`rounded-xl p-6 border ${
        highlighted
          ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-600 shadow-md'
          : 'border-gray-200 bg-white shadow-sm'
      }`}
    >
      {highlighted && (
        <span className="inline-block text-xs font-bold text-blue-600 uppercase tracking-wide mb-2">
          Most popular
        </span>
      )}
      <h3 className="text-xl font-bold text-gray-900">{tier}</h3>
      <p className="text-sm text-gray-500 mb-4">{description}</p>
      <p className="mb-6">
        <span className="text-3xl font-extrabold text-gray-900">&pound;{price}</span>
        <span className="text-sm text-gray-500">/month</span>
      </p>
      <ul className="space-y-2 mb-6">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
            <CheckIcon />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <Link
        href="/provider/register"
        className={`block text-center py-2.5 rounded-lg font-semibold text-sm transition ${
          highlighted
            ? 'bg-blue-600 text-white hover:bg-blue-700'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        Get started
      </Link>
    </div>
  )
}

function TestimonialCard({
  quote,
  author,
  location,
}: {
  quote: string
  author: string
  location: string
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
      <p className="text-sm text-gray-600 italic leading-relaxed mb-4">&ldquo;{quote}&rdquo;</p>
      <p className="text-sm font-semibold text-gray-900">{author}</p>
      <p className="text-xs text-gray-400">{location}</p>
    </div>
  )
}
