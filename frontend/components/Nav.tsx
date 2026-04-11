'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { getShortlistCount } from '@/lib/shortlist'
import { getCompareCount, getCompareList } from '@/lib/compare'
import { useSession } from '@/components/SessionProvider'
import NotificationBell from '@/components/NotificationBell'

function initialsOf(email: string | null | undefined): string {
  if (!email) return '?'
  const name = email.split('@')[0]
  const parts = name.split(/[._-]/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

export default function Nav() {
  const [shortlistCount, setShortlistCount] = useState(0)
  const [compareCount, setCompareCount] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const { user, role, signOut } = useSession()

  const isParent = !role || role === 'customer'
  const isProvider = role === 'provider'
  const isAdmin = role === 'admin'

  useEffect(() => {
    setShortlistCount(getShortlistCount())
    setCompareCount(getCompareCount())
    const shortlistHandler = () => setShortlistCount(getShortlistCount())
    const compareHandler = () => setCompareCount(getCompareCount())
    window.addEventListener('shortlist-updated', shortlistHandler)
    window.addEventListener('compare-updated', compareHandler)
    return () => {
      window.removeEventListener('shortlist-updated', shortlistHandler)
      window.removeEventListener('compare-updated', compareHandler)
    }
  }, [])

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-blue-600">
          CompareTheNursery
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-6">
          {/* Parent/guest nav links */}
          {isParent && (
            <>
              <Link href="/search" className="text-sm text-gray-600 hover:text-gray-900">
                Search
              </Link>
              <Link href="/find-an-area" className="text-sm text-gray-600 hover:text-gray-900">
                Find an Area
              </Link>
              <Link href="/shortlist" className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1">
                Shortlist
                {shortlistCount > 0 && (
                  <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {shortlistCount}
                  </span>
                )}
              </Link>
              <Link
                href={compareCount >= 2 ? `/compare?urns=${getCompareList().join(',')}` : '/compare'}
                className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
              >
                Compare
                {compareCount > 0 && (
                  <span className="bg-purple-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {compareCount}
                  </span>
                )}
              </Link>
              <Link href="/quiz" className="text-sm text-gray-600 hover:text-gray-900">
                Quiz
              </Link>
              <Link href="/guides" className="text-sm text-gray-600 hover:text-gray-900">
                Guides
              </Link>
            </>
          )}

          {/* Provider nav links */}
          {isProvider && (
            <Link href="/provider" className="text-sm text-gray-600 hover:text-gray-900 font-medium">
              Provider Dashboard
            </Link>
          )}

          {/* Admin nav links */}
          {isAdmin && (
            <Link href="/admin/claims" className="text-sm text-gray-600 hover:text-gray-900 font-medium">
              Admin Dashboard
            </Link>
          )}

          {user ? (
            <div className="flex items-center gap-3">
              <NotificationBell />
              <div className="relative">
              <button
                onClick={() => setAccountOpen(v => !v)}
                className="w-8 h-8 rounded-full bg-blue-600 text-white text-xs font-semibold flex items-center justify-center hover:bg-blue-700"
                aria-label="Account menu"
              >
                {initialsOf(user.email)}
              </button>
              {accountOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50">
                  <div className="px-3 py-2 text-xs text-gray-500 truncate border-b border-gray-100">
                    {user.email}
                  </div>

                  {/* Parent dropdown items */}
                  {isParent && (
                    <>
                      <Link
                        href="/dashboard"
                        className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => setAccountOpen(false)}
                      >
                        Dashboard
                      </Link>
                      <Link
                        href="/account"
                        className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => setAccountOpen(false)}
                      >
                        Account
                      </Link>
                    </>
                  )}

                  {/* Provider dropdown items */}
                  {isProvider && (
                    <>
                      <Link
                        href="/provider/enquiries"
                        className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => setAccountOpen(false)}
                      >
                        Enquiries
                      </Link>
                      <Link
                        href="/provider/reports"
                        className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => setAccountOpen(false)}
                      >
                        Analytics
                      </Link>
                      <Link
                        href="/provider/billing"
                        className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => setAccountOpen(false)}
                      >
                        Billing
                      </Link>
                      <Link
                        href="/account"
                        className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => setAccountOpen(false)}
                      >
                        Account
                      </Link>
                    </>
                  )}

                  {/* Admin dropdown items */}
                  {isAdmin && (
                    <>
                      <Link
                        href="/admin/users"
                        className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => setAccountOpen(false)}
                      >
                        Users
                      </Link>
                      <Link
                        href="/admin/claims"
                        className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => setAccountOpen(false)}
                      >
                        Claims
                      </Link>
                      <Link
                        href="/admin/reports"
                        className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => setAccountOpen(false)}
                      >
                        Reports
                      </Link>
                      <Link
                        href="/admin/promotions"
                        className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => setAccountOpen(false)}
                      >
                        Promotions
                      </Link>
                      <Link
                        href="/account"
                        className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => setAccountOpen(false)}
                      >
                        Account
                      </Link>
                    </>
                  )}

                  <button
                    onClick={async () => {
                      setAccountOpen(false)
                      await signOut()
                    }}
                    className="block w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-gray-50"
                  >
                    Sign out
                  </button>
                </div>
              )}
              </div>
            </div>
          ) : (
            <Link href="/login" className="text-sm text-blue-600 hover:text-blue-800 font-medium">
              Sign in
            </Link>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden text-gray-600"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {menuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white px-4 py-3 space-y-3">
          {isParent && (
            <>
              <Link href="/search" className="block text-sm text-gray-600" onClick={() => setMenuOpen(false)}>Search</Link>
              <Link href="/find-an-area" className="block text-sm text-gray-600" onClick={() => setMenuOpen(false)}>Find an Area</Link>
              <Link href="/shortlist" className="block text-sm text-gray-600" onClick={() => setMenuOpen(false)}>
                Shortlist {shortlistCount > 0 && `(${shortlistCount})`}
              </Link>
              <Link href="/quiz" className="block text-sm text-gray-600" onClick={() => setMenuOpen(false)}>Quiz</Link>
              <Link href="/guides" className="block text-sm text-gray-600" onClick={() => setMenuOpen(false)}>Guides</Link>
            </>
          )}
          {isProvider && (
            <Link href="/provider" className="block text-sm text-gray-600 font-medium" onClick={() => setMenuOpen(false)}>Provider Dashboard</Link>
          )}
          {isAdmin && (
            <Link href="/admin/claims" className="block text-sm text-gray-600 font-medium" onClick={() => setMenuOpen(false)}>Admin Dashboard</Link>
          )}
          {user ? (
            <>
              <Link href="/account" className="block text-sm text-gray-600" onClick={() => setMenuOpen(false)}>Account</Link>
              <button
                onClick={async () => { setMenuOpen(false); await signOut() }}
                className="block text-sm text-red-600"
              >
                Sign out
              </button>
            </>
          ) : (
            <Link href="/login" className="block text-sm text-blue-600 font-medium" onClick={() => setMenuOpen(false)}>Sign in</Link>
          )}
        </div>
      )}
    </nav>
  )
}
