import { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Refund Policy',
  description:
    'Refund policy for NurseryMatch provider subscriptions — when refunds apply, how to request one, and how cancellation works.',
}

export default function RefundPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-3">Refund Policy</h1>
      <p className="text-gray-600 mb-10">
        This policy applies to paid <strong>provider subscriptions</strong> on NurseryMatch.
        Parents do not pay anything to use NurseryMatch, so refunds are only relevant for
        nurseries on a paid plan.
      </p>

      <div className="space-y-10 text-gray-700 leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">14-day cooling-off period</h2>
          <p>
            New paid subscriptions in the UK are covered by a statutory 14-day cooling-off period
            under the Consumer Contracts Regulations 2013. If you cancel a new subscription
            within 14 days of starting it, you&apos;re entitled to a full refund — even if
            you&apos;ve used the service. Email{' '}
            <a href="mailto:hello@nurserymatch.com" className="text-blue-600 hover:underline">
              hello@nurserymatch.com
            </a>{' '}
            from the email address on the account and we&apos;ll process the refund within 5
            working days.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">After the cooling-off period</h2>
          <p className="mb-3">
            Outside the 14-day window, our standard policy is:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Monthly subscriptions:</strong> you can cancel at any time from your{' '}
              <Link href="/provider/billing" className="text-blue-600 hover:underline">
                billing page
              </Link>
              . Cancellation takes effect at the end of the current billing period, and you
              keep access until then. We don&apos;t prorate or refund partial months.
            </li>
            <li>
              <strong>Annual subscriptions:</strong> cancellation takes effect at the next
              renewal date and stops auto-renewal. We don&apos;t typically refund the unused
              portion of an annual term, but if you have an exceptional reason (extended illness,
              nursery closure, billing error) email us and we&apos;ll consider a pro-rata refund
              on a case-by-case basis.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">When we will always refund</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Duplicate or incorrect charges</strong> caused by a billing system error.
            </li>
            <li>
              <strong>Charges after a successful cancellation</strong> that we failed to honour.
            </li>
            <li>
              <strong>Subscription paid by mistake</strong> on the wrong card or account, if you
              flag it within 14 days.
            </li>
          </ul>
          <p className="mt-3">
            In these cases we refund the full amount within 5 working days; the funds typically
            land back on your card 3–10 working days after we process the refund, depending on
            your bank.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">When we may decline</h2>
          <p className="mb-3">
            We may decline a refund where:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              The cooling-off period has passed and the request doesn&apos;t fit one of the
              cases above.
            </li>
            <li>
              The account has been suspended for breach of our{' '}
              <Link href="/terms" className="text-blue-600 hover:underline">terms</Link>.
            </li>
            <li>
              The request is for a downgrade between paid tiers within a billing cycle. You can
              downgrade for free; the new rate applies from the next billing date.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">How to request a refund</h2>
          <p>
            Email{' '}
            <a href="mailto:hello@nurserymatch.com" className="text-blue-600 hover:underline">
              hello@nurserymatch.com
            </a>{' '}
            from the address on the account, with:
          </p>
          <ol className="list-decimal pl-6 mt-3 space-y-2">
            <li>Your nursery name and URN.</li>
            <li>The date of the charge you want refunded.</li>
            <li>A short note on why.</li>
          </ol>
          <p className="mt-3">
            We aim to acknowledge within 2 working days and to process eligible refunds within
            5 working days.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">How payments work</h2>
          <p>
            All payments are processed by{' '}
            <a
              href="https://stripe.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              Stripe
            </a>
            . NurseryMatch never sees or stores your card details. Refunds are issued back to the
            original payment method.
          </p>
        </section>

        <p className="text-sm text-gray-400 pt-4">
          This policy supplements your statutory rights under UK consumer law and does not
          override them. For any dispute we cannot resolve directly, you have the right to
          escalate to the relevant ombudsman or court.
        </p>
      </div>
    </div>
  )
}
