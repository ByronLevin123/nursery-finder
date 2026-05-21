'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { API_URL } from '@/lib/api'

interface Testimonial {
  id: string
  rating: number
  title: string
  body: string
  author_display_name: string
  nursery_name: string | null
  nursery_town: string | null
  nursery_urn: string
}

export default function TestimonialCarousel() {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([])

  useEffect(() => {
    fetch(`${API_URL}/api/v1/nurseries/reviews/featured?limit=6`)
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((d) => setTestimonials(d.data || []))
      .catch(() => {})
  }, [])

  if (testimonials.length === 0) return null

  return (
    <section className="px-4 py-14 bg-gray-50 border-t border-gray-100">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 text-center mb-3">
          What parents say
        </h2>
        <p className="text-center text-gray-500 mb-10">Real reviews from parents using NurseryMatch</p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {testimonials.map((t) => (
            <div
              key={t.id}
              className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition"
            >
              <div className="flex gap-0.5 mb-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <span key={i} className={`text-lg ${i < t.rating ? 'text-yellow-400' : 'text-gray-200'}`}>
                    &#9733;
                  </span>
                ))}
              </div>
              <p className="text-sm font-semibold text-gray-900 mb-2">{t.title}</p>
              <p className="text-sm text-gray-600 leading-relaxed mb-4">{t.body}</p>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span className="font-medium text-gray-700">{t.author_display_name}</span>
                {t.nursery_name && (
                  <Link
                    href={`/nursery/${t.nursery_urn}`}
                    className="text-indigo-600 hover:underline truncate ml-2"
                  >
                    {t.nursery_name}
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
