import { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'About NurseryMatch',
  description:
    "Why NurseryMatch exists, who it's for, and how we put parents in control of choosing the right nursery.",
}

export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold text-gray-900 mb-6">About NurseryMatch</h1>

      <p className="text-lg text-gray-700 leading-relaxed mb-10">
        NurseryMatch helps UK parents find and compare Ofsted-rated nurseries — and the areas
        around them — without having to visit a dozen websites and stitch the picture together
        themselves.
      </p>

      <div className="space-y-10">
        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mb-3">Why we built this</h2>
          <p className="text-gray-700 leading-relaxed">
            Choosing a nursery is one of the most consequential decisions a parent makes, and the
            information you need to make it well is scattered across Ofsted reports, council
            websites, parent forums, Google reviews, and the nurseries&apos; own pages. Each of
            those sources is partial, and none of them helps you compare two settings side by
            side. We built NurseryMatch to put the data in one place — the official inspection
            record, parent reviews, fees, funded places, opening hours, and the area context that
            actually matters when you&apos;re choosing where your child will spend their days.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mb-3">What we do — and don&apos;t — do</h2>
          <ul className="space-y-3 text-gray-700 leading-relaxed list-disc pl-6">
            <li>
              <strong>We surface official data.</strong> Ofsted grades and inspection dates come
              straight from the Early Years Register under the Open Government Licence. We never
              edit them.
            </li>
            <li>
              <strong>We add the context you can&apos;t easily get.</strong> Parent reviews,
              funded-places filters, side-by-side comparison, area intelligence (crime, schools,
              property prices, density of nurseries) — built from public datasets and your peers.
            </li>
            <li>
              <strong>We don&apos;t recommend any nursery to you.</strong> Match scores are
              advisory and based on the priorities you tell us about. You stay in control.
            </li>
            <li>
              <strong>We&apos;re independent of Ofsted and of any nursery group.</strong> Paid
              provider tiers exist, but they don&apos;t buy you a higher Ofsted grade or a better
              ranking — they only let providers manage their own profile, photos, and enquiries.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mb-3">For nursery providers</h2>
          <p className="text-gray-700 leading-relaxed mb-3">
            Every nursery in England is listed on NurseryMatch automatically from the Ofsted
            register. If you run one of those nurseries, you can{' '}
            <Link href="/provider/register" className="text-blue-600 hover:underline">
              claim your free profile
            </Link>{' '}
            to update your description, hours and photos, and to receive parent enquiries
            directly.
          </p>
          <p className="text-gray-700 leading-relaxed">
            Pricing details and what each tier includes are on the{' '}
            <Link href="/pricing" className="text-blue-600 hover:underline">pricing page</Link>.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mb-3">Our principles</h2>
          <ul className="space-y-3 text-gray-700 leading-relaxed list-disc pl-6">
            <li>
              <strong>Privacy by default.</strong> We use cookieless analytics, only essential
              cookies, and never sell data. See our{' '}
              <Link href="/privacy" className="text-blue-600 hover:underline">privacy policy</Link>.
            </li>
            <li>
              <strong>Children&apos;s data is special.</strong> We process the minimum we need to
              help you, retain it only as long as your account is active, and you can export or
              delete everything from your account page.
            </li>
            <li>
              <strong>Open data, open about it.</strong> We attribute Ofsted, the UK Land
              Registry, the Police data API, the Environment Agency and other public sources
              wherever their data appears.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mb-3">Get in touch</h2>
          <p className="text-gray-700 leading-relaxed">
            Questions, feedback, or want to partner? Email{' '}
            <a href="mailto:hello@nurserymatch.com" className="text-blue-600 hover:underline">
              hello@nurserymatch.com
            </a>{' '}
            or visit our{' '}
            <Link href="/contact" className="text-blue-600 hover:underline">contact page</Link>.
          </p>
        </section>
      </div>
    </div>
  )
}
