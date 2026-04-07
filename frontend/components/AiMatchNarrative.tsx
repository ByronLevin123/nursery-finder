'use client'

import { useEffect, useState } from 'react'
import { generateMatchNarrative } from '@/lib/api'

interface Props {
  nursery: any
  area: any
  match: any
}

export default function AiMatchNarrative({ nursery, area, match }: Props) {
  const [text, setText] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!match) return
    let cancelled = false
    setLoading(true)
    generateMatchNarrative({ nursery, area, match }).then((t) => {
      if (cancelled) return
      setText(t)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [nursery, area, match])

  if (!match) return null
  if (loading) {
    return (
      <p className="mt-2 text-xs italic text-amber-700 animate-pulse">
        Claude is writing your match summary…
      </p>
    )
  }
  if (!text) return null

  return (
    <p className="mt-2 text-xs italic text-amber-800 leading-relaxed">
      <span className="font-semibold not-italic">✨ </span>
      {text}
    </p>
  )
}
