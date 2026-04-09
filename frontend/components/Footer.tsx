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
          <div className="flex gap-6 text-sm">
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
        <OglAttribution />
      </div>
    </footer>
  )
}
