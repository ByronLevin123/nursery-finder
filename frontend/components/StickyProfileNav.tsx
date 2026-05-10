'use client'

import { useState, useEffect } from 'react'

const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'fees', label: 'Fees' },
  { id: 'reviews', label: 'Reviews' },
  { id: 'qa', label: 'Q&A' },
]

export default function StickyProfileNav() {
  const [active, setActive] = useState('overview')

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActive(entry.target.id)
          }
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0.1 }
    )

    for (const s of SECTIONS) {
      const el = document.getElementById(s.id)
      if (el) observer.observe(el)
    }

    return () => observer.disconnect()
  }, [])

  return (
    <nav className="hidden md:block sticky top-[56px] z-30 bg-white border-b border-gray-200 -mx-4 px-4 mb-6">
      <div className="flex gap-6 overflow-x-auto">
        {SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            onClick={(e) => {
              e.preventDefault()
              document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }}
            className={`py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              active === s.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            {s.label}
          </a>
        ))}
      </div>
    </nav>
  )
}
