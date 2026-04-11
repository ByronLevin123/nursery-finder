'use client'

import { useEffect, useRef } from 'react'
import { searchResultsSchema, jsonLdScript } from '@/lib/schema'

interface SearchJsonLdProps {
  nurseries: Array<{ urn: string; name: string; [key: string]: any }>
  query: string
}

/**
 * Injects an ItemList JSON-LD script tag into <head> whenever the search
 * results change. Removes the previous script on re-render / unmount.
 */
export default function SearchJsonLd({ nurseries, query }: SearchJsonLdProps) {
  const scriptRef = useRef<HTMLScriptElement | null>(null)

  useEffect(() => {
    // Clean up any previous script
    if (scriptRef.current) {
      scriptRef.current.remove()
      scriptRef.current = null
    }

    if (!nurseries.length || !query) return

    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.textContent = jsonLdScript(searchResultsSchema(nurseries, query))
    document.head.appendChild(script)
    scriptRef.current = script

    return () => {
      if (scriptRef.current) {
        scriptRef.current.remove()
        scriptRef.current = null
      }
    }
  }, [nurseries, query])

  return null
}
