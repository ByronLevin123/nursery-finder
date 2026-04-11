'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from '@/components/SessionProvider'

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/provider' },
  { label: 'Enquiries', href: '/provider/enquiries' },
  { label: 'Analytics', href: '/provider/analytics' },
  { label: 'Onboarding', href: '/provider/onboarding' },
]

export default function ProviderLayout({ children }: { children: React.ReactNode }) {
  const { user, role, loading } = useSession()
  const pathname = usePathname()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-gray-400">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="max-w-lg mx-auto px-4 py-24 text-center">
        <div className="text-5xl mb-4">🔑</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Sign In Required</h1>
        <p className="text-gray-600 mb-6">
          You need to sign in to access the provider dashboard.
        </p>
        <Link
          href={`/login?next=${encodeURIComponent(pathname)}`}
          className="inline-block px-6 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition"
        >
          Sign In
        </Link>
      </div>
    )
  }

  if (role !== 'provider' && role !== 'admin') {
    return (
      <div className="max-w-lg mx-auto px-4 py-24 text-center">
        <div className="text-5xl mb-4">🏫</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Provider Access Only</h1>
        <p className="text-gray-600 mb-6">
          This area is for nursery providers. To get started, claim your nursery listing.
        </p>
        <Link
          href="/claim"
          className="inline-block px-6 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition"
        >
          Claim Your Nursery
        </Link>
      </div>
    )
  }

  function isActive(href: string) {
    if (href === '/provider') return pathname === '/provider'
    return pathname.startsWith(href)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900">Provider Dashboard</h1>
            <span className="px-2 py-0.5 text-xs font-semibold bg-purple-100 text-purple-700 rounded-full">
              {role}
            </span>
          </div>
          <p className="text-sm text-gray-500 hidden sm:block">{user.email}</p>
        </div>
      </div>

      {/* Mobile tabs */}
      <div className="md:hidden overflow-x-auto border-b border-gray-200 bg-white">
        <div className="flex min-w-max">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition ${
                isActive(item.href)
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto flex">
        {/* Desktop sidebar */}
        <aside className="hidden md:block w-56 shrink-0 border-r border-gray-200 bg-white min-h-[calc(100vh-73px)]">
          <nav className="py-4">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`block px-6 py-2.5 text-sm font-medium transition ${
                  isActive(item.href)
                    ? 'bg-indigo-50 text-indigo-600 border-r-2 border-indigo-600'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <div className="flex-1 p-4 md:p-6 min-w-0">{children}</div>
      </div>
    </div>
  )
}
