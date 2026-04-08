'use client'

import { useEffect, useRef, useState } from 'react'

interface PostcodeSuggestion {
  type: 'postcode' | 'place'
  value: string
  label: string
  lat?: number
  lng?: number
}

interface Props {
  value: string
  onChange: (value: string) => void
  onSelect?: (s: PostcodeSuggestion) => void
  placeholder?: string
  className?: string
  id?: string
}

function looksLikePostcode(q: string): boolean {
  return /^[A-Z]{1,2}\d/i.test(q.trim())
}

export default function PostcodeAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = 'Postcode or place name',
  className = '',
  id,
}: Props) {
  const [suggestions, setSuggestions] = useState<PostcodeSuggestion[]>([])
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const debounceRef = useRef<number | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    const q = value.trim()
    if (q.length < 2) {
      setSuggestions([])
      return
    }
    debounceRef.current = window.setTimeout(async () => {
      try {
        const isPostcode = looksLikePostcode(q)
        const url = isPostcode
          ? `https://api.postcodes.io/postcodes/${encodeURIComponent(q)}/autocomplete`
          : `https://api.postcodes.io/places?q=${encodeURIComponent(q)}&limit=8`
        const res = await fetch(url)
        if (!res.ok) {
          setSuggestions([])
          return
        }
        const json = await res.json()
        if (isPostcode) {
          const list: PostcodeSuggestion[] = (json.result || []).map((pc: string) => ({
            type: 'postcode' as const,
            value: pc,
            label: pc,
          }))
          setSuggestions(list)
        } else {
          const list: PostcodeSuggestion[] = (json.result || []).map((p: any) => ({
            type: 'place' as const,
            value: p.name_1 || p.name_1_lang || p.name || '',
            label: [p.name_1 || p.name, p.county_unitary, p.region]
              .filter(Boolean)
              .join(', '),
            lat: p.latitude,
            lng: p.longitude,
          }))
          setSuggestions(list)
        }
        setOpen(true)
        setActiveIdx(-1)
      } catch {
        setSuggestions([])
      }
    }, 200)
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
    }
  }, [value])

  function choose(s: PostcodeSuggestion) {
    onChange(s.value)
    setOpen(false)
    setSuggestions([])
    if (onSelect) onSelect(s)
  }

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => suggestions.length && setOpen(true)}
        onKeyDown={(e) => {
          if (!open) return
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActiveIdx((i) => Math.min(suggestions.length - 1, i + 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActiveIdx((i) => Math.max(0, i - 1))
          } else if (e.key === 'Enter' && activeIdx >= 0) {
            e.preventDefault()
            choose(suggestions[activeIdx])
          } else if (e.key === 'Escape') {
            setOpen(false)
          }
        }}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto text-sm">
          {suggestions.map((s, i) => (
            <li
              key={`${s.type}-${s.value}-${i}`}
              className={`px-3 py-1.5 cursor-pointer ${i === activeIdx ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
              onMouseDown={(e) => {
                e.preventDefault()
                choose(s)
              }}
            >
              <span className="text-gray-900">{s.label}</span>
              {s.type === 'place' && (
                <span className="ml-1 text-xs text-gray-400">(place)</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
