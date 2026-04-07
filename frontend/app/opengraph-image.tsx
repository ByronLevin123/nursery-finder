import { ImageResponse } from 'next/og'

// Default Open Graph image — generated at build time by Next.js.
// If next/og is unavailable in your runtime, replace this file with a static
// /public/og-default.png and delete this route.

export const runtime = 'edge'
export const alt = 'NurseryFinder — Compare UK Nurseries by Ofsted Grade'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
          color: 'white',
          fontFamily: 'system-ui, sans-serif',
          padding: 80,
        }}
      >
        <div style={{ fontSize: 84, fontWeight: 800, letterSpacing: -2, marginBottom: 24 }}>
          NurseryFinder
        </div>
        <div
          style={{
            fontSize: 36,
            fontWeight: 500,
            opacity: 0.95,
            textAlign: 'center',
            lineHeight: 1.3,
          }}
        >
          Compare 27,000+ UK nurseries by Ofsted grade,
          <br />
          family score and live property data
        </div>
        <div style={{ marginTop: 48, fontSize: 24, opacity: 0.85 }}>
          nursery-finder.vercel.app
        </div>
      </div>
    ),
    { ...size }
  )
}
