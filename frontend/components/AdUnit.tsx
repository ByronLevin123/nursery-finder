'use client'

import { useEffect, useRef } from 'react'

interface AdUnitProps {
  slot: string
  format?: 'auto' | 'horizontal' | 'vertical' | 'rectangle'
  responsive?: boolean
  className?: string
}

export default function AdUnit({ slot, format = 'auto', responsive = true, className = '' }: AdUnitProps) {
  const adRef = useRef<HTMLModElement>(null)
  const pushed = useRef(false)

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_ADSENSE_ID) return
    if (pushed.current) return
    try {
      ;((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({})
      pushed.current = true
    } catch {
      // AdSense not loaded or blocked — fail silently
    }
  }, [])

  if (!process.env.NEXT_PUBLIC_ADSENSE_ID) return null

  return (
    <div className={`ad-container ${className}`}>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={process.env.NEXT_PUBLIC_ADSENSE_ID}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive={responsive ? 'true' : 'false'}
      />
    </div>
  )
}
