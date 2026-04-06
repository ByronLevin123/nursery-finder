'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { getShortlistCount } from '@/lib/shortlist'
import { getCompareCount, getCompareList } from '@/lib/compare'

export default function Nav() {
  const [shortlistCount, setShortlistCount] = useState(0)
  const [compareCount, setCompareCount] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)

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
          NurseryFinder
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-6">
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
          <Link href="/login" className="text-sm text-blue-600 hover:text-blue-800 font-medium">
            Sign in
          </Link>
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
          <Link href="/search" className="block text-sm text-gray-600" onClick={() => setMenuOpen(false)}>Search</Link>
          <Link href="/find-an-area" className="block text-sm text-gray-600" onClick={() => setMenuOpen(false)}>Find an Area</Link>
          <Link href="/shortlist" className="block text-sm text-gray-600" onClick={() => setMenuOpen(false)}>
            Shortlist {shortlistCount > 0 && `(${shortlistCount})`}
          </Link>
          <Link href="/login" className="block text-sm text-blue-600 font-medium" onClick={() => setMenuOpen(false)}>Sign in</Link>
        </div>
      )}
    </nav>
  )
}
