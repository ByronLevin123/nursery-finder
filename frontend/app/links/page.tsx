import { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Links | NurseryMatch',
  description:
    'All the key NurseryMatch links in one place — search nurseries, take our quiz, read guides, and more.',
  robots: { index: false },
  openGraph: {
    title: 'Links | NurseryMatch',
    description:
      'All the key NurseryMatch links in one place — search nurseries, take our quiz, read guides, and more.',
  },
}

const LINKS: {
  label: string
  href: string
  variant: 'primary' | 'outline' | 'subtle'
}[] = [
  { label: 'Search Nurseries Near You', href: '/search', variant: 'primary' },
  { label: 'Take the Nursery Quiz', href: '/quiz', variant: 'primary' },
  { label: 'Read Our Guides', href: '/guides', variant: 'outline' },
  { label: 'Compare Nurseries', href: '/compare', variant: 'outline' },
  { label: 'Find an Area', href: '/find-an-area', variant: 'outline' },
  { label: 'For Nursery Providers', href: '/for-providers', variant: 'subtle' },
]

const variantClasses: Record<string, string> = {
  primary:
    'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md',
  outline:
    'bg-white text-indigo-600 border-2 border-indigo-600 hover:bg-indigo-50',
  subtle:
    'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200',
}

export default function LinksPage() {
  return (
    <div className="min-h-[60vh] flex items-start justify-center px-4 py-16">
      <div className="max-w-md mx-auto w-full text-center">
        <h1 className="text-3xl font-bold text-indigo-600 mb-2">NurseryMatch</h1>
        <p className="text-gray-500 mb-8">Find the perfect nursery for your child</p>

        <div className="flex flex-col gap-3">
          {LINKS.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className={`block w-full min-h-[48px] py-3.5 rounded-xl text-center font-medium transition ${variantClasses[link.variant]}`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
