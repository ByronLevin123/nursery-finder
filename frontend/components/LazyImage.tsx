'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'

const NurseryPlaceholder = dynamic(
  () => import('@/components/NurseryPlaceholder'),
  { ssr: false }
)

interface LazyImageProps {
  src: string
  alt: string
  width?: number
  height?: number
  className?: string
  placeholderColor?: string
  placeholderName?: string
}

export default function LazyImage({
  src,
  alt,
  width,
  height,
  className = '',
  placeholderColor = '#e0e7ff',
  placeholderName,
}: LazyImageProps) {
  const [errored, setErrored] = useState(false)
  const [loaded, setLoaded] = useState(false)

  if (errored) {
    return <NurseryPlaceholder name={placeholderName || alt} />
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Blur placeholder shown until image loads */}
      {!loaded && (
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, ${placeholderColor} 0%, #f3f4f6 100%)`,
          }}
        />
      )}
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setErrored(true)}
        className={`transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'} ${className}`}
      />
    </div>
  )
}
