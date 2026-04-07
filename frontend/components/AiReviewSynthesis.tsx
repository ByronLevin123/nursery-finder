'use client'

import { useEffect, useState } from 'react'
import { getReviewSynthesis, type ReviewSynthesis } from '@/lib/api'

interface Props {
  urn: string
}

export default function AiReviewSynthesis({ urn }: Props) {
  const [data, setData] = useState<ReviewSynthesis | null>(null)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getReviewSynthesis(urn).then((d) => {
      if (cancelled) return
      setData(d)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [urn])

  if (loading) {
    return (
      <div className="my-4 rounded-lg border border-amber-200 bg-amber-50 p-4 animate-pulse">
        <div className="h-3 w-40 bg-amber-200 rounded mb-3" />
        <div className="h-3 w-full bg-amber-100 rounded mb-1" />
        <div className="h-3 w-4/5 bg-amber-100 rounded" />
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="my-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between text-left"
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-amber-700">
          Claude review summary
        </span>
        <span className="text-xs text-amber-700">{open ? 'Hide' : 'Show'}</span>
      </button>
      {open && (
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <Section
            title="What parents love"
            icon="✨"
            items={data.loves}
            color="text-emerald-800"
          />
          <Section title="Concerns" icon="⚠️" items={data.concerns} color="text-orange-800" />
          <Section title="Things to know" icon="💡" items={data.know} color="text-indigo-800" />
        </div>
      )}
      <p className="text-[10px] text-amber-600 mt-3">
        AI-summarised from parent reviews. Read the full reviews below.
      </p>
    </div>
  )
}

function Section({
  title,
  icon,
  items,
  color,
}: {
  title: string
  icon: string
  items: string[]
  color: string
}) {
  if (!items || items.length === 0) return null
  return (
    <div>
      <div className={`text-xs font-semibold mb-1 ${color}`}>
        {icon} {title}
      </div>
      <ul className="space-y-1">
        {items.map((it, i) => (
          <li key={i} className="text-xs text-gray-700 leading-snug">
            · {it}
          </li>
        ))}
      </ul>
    </div>
  )
}
