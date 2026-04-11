'use client'

/**
 * Compact thumbnail for NurseryCard — shows photo, map tile, or initials.
 */

function latLngToTile(lat: number, lng: number, zoom: number) {
  const n = Math.pow(2, zoom)
  const x = Math.floor(((lng + 180) / 360) * n)
  const latRad = (lat * Math.PI) / 180
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n)
  return { x, y }
}

const GRADIENT_COLORS = [
  'from-blue-400 to-indigo-500',
  'from-green-400 to-teal-500',
  'from-purple-400 to-pink-500',
  'from-amber-400 to-orange-500',
  'from-cyan-400 to-blue-500',
  'from-rose-400 to-red-500',
]

function nameToGradient(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return GRADIENT_COLORS[Math.abs(hash) % GRADIENT_COLORS.length]
}

interface Props {
  name: string
  photos?: string[] | null
  lat?: number | null
  lng?: number | null
}

export default function NurseryCardThumbnail({ name, photos, lat, lng }: Props) {
  // Case 1: Has photos — show first photo
  if (photos && photos.length > 0) {
    return (
      <div className="relative h-32 w-full overflow-hidden rounded-t-lg">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photos[0]}
          alt={`${name} photo`}
          className="w-full h-full object-cover"
        />
      </div>
    )
  }

  // Case 2: Has lat/lng — show map tile
  if (lat != null && lng != null) {
    const zoom = 15
    const { x, y } = latLngToTile(lat, lng, zoom)
    return (
      <div className="relative h-32 w-full overflow-hidden rounded-t-lg bg-gray-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`}
          alt={`Map near ${name}`}
          className="w-full h-full object-cover"
          draggable={false}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
        <div className="absolute bottom-1.5 left-2 flex items-center gap-1 text-white/80 text-[10px]">
          <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
          </svg>
          Map view
        </div>
      </div>
    )
  }

  // Case 3: No photos, no location — colored placeholder with initials
  const gradient = nameToGradient(name)
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('')

  return (
    <div className={`relative h-32 w-full overflow-hidden rounded-t-lg bg-gradient-to-br ${gradient} flex items-center justify-center`}>
      <span className="text-white text-3xl font-bold opacity-80">{initials}</span>
    </div>
  )
}
