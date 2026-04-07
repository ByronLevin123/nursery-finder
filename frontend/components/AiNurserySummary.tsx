'use client'

import { useEffect, useState } from 'react'
import { getNurserySummary } from '@/lib/api'

interface Props {
  urn: string
}

export default function AiNurserySummary({ urn }: Props) {
  const [summary, setSummary] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getNurserySummary(urn).then((s) => {
      if (cancelled) return
      setSummary(s)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [urn])

  if (loading) {
    return (
      <div className="my-3 rounded-lg border border-amber-200 bg-amber-50 p-3 animate-pulse">
        <div className="h-3 w-24 bg-amber-200 rounded mb-2" />
        <div className="h-3 w-full bg-amber-100 rounded mb-1" />
        <div className="h-3 w-5/6 bg-amber-100 rounded" />
      </div>
    )
  }

  if (!summary) return null

  return (
    <div className="my-3 rounded-lg border border-amber-200 bg-amber-50 p-3 transition-opacity duration-300">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-700 mb-1">
        Claude summary
      </div>
      <p className="text-sm text-amber-900 leading-relaxed">{summary}</p>
      <p className="text-[10px] text-amber-600 mt-1">AI-generated from public data — verify before deciding.</p>
    </div>
  )
}
