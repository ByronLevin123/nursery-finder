import OglAttribution from './OglAttribution'
import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="bg-gray-50 border-t border-gray-200 mt-12">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-start gap-6">
          <div>
            <p className="font-semibold text-gray-800">CompareTheNursery</p>
            <p className="text-sm text-gray-500 mt-1">
              Find and compare Ofsted-rated nurseries across the UK
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-6">
            <div>
              <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Resources</p>
              <div className="flex flex-col gap-1 text-sm">
                <Link href="/guides" className="text-gray-500 hover:text-gray-700">
                  Guides & Advice
                </Link>
                <Link href="/nurseries-in-town" className="text-gray-500 hover:text-gray-700">
                  Browse by Town
                </Link>
                <Link href="/pricing" className="text-gray-500 hover:text-gray-700">
                  Pricing
                </Link>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Providers</p>
              <div className="flex flex-col gap-1 text-sm">
                <Link href="/for-providers" className="text-gray-500 hover:text-gray-700">
                  For Providers
                </Link>
                <Link href="/claim" className="text-gray-500 hover:text-gray-700">
                  Claim Your Nursery
                </Link>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Company</p>
              <div className="flex flex-col gap-1 text-sm">
                <Link href="/privacy" className="text-gray-500 hover:text-gray-700">
                  Privacy Policy
                </Link>
                <a
                  href="mailto:hello@comparethenursery.com"
                  className="text-gray-500 hover:text-gray-700"
                >
                  Contact
                </a>
              </div>
            </div>
          </div>
        </div>
        <OglAttribution />
      </div>
    </footer>
  )
}
