'use client'

const gradients = [
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
  return gradients[Math.abs(hash) % gradients.length]
}

const GRADE_COLORS: Record<string, string> = {
  'Outstanding': 'bg-green-500 text-white',
  'Good': 'bg-blue-500 text-white',
  'Requires Improvement': 'bg-amber-500 text-white',
  'Inadequate': 'bg-red-500 text-white',
}

/**
 * Convert lat/lng to tile x/y at a given zoom level.
 * See https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames
 */
function latLngToTile(lat: number, lng: number, zoom: number) {
  const n = Math.pow(2, zoom)
  const x = Math.floor(((lng + 180) / 360) * n)
  const latRad = (lat * Math.PI) / 180
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n)
  return { x, y }
}

interface Props {
  name: string
  lat?: number | null
  lng?: number | null
  ofstedGrade?: string | null
}

export default function NurseryPlaceholder({ name, lat, lng, ofstedGrade }: Props) {
  const gradient = nameToGradient(name)
  const initial = name.charAt(0).toUpperCase()
  const hasLocation = lat != null && lng != null

  // Build a 2x2 grid of map tiles centered on the nursery for a wider view
  const zoom = 16
  const tiles: { x: number; y: number }[] = []
  let tileUrl = ''
  if (hasLocation) {
    const center = latLngToTile(lat, lng, zoom)
    // 2x2 tile grid: center tile and its right/bottom neighbours
    tiles.push(
      { x: center.x, y: center.y },
      { x: center.x + 1, y: center.y },
      { x: center.x, y: center.y + 1 },
      { x: center.x + 1, y: center.y + 1 },
    )
  }

  const gradeStyle = ofstedGrade ? GRADE_COLORS[ofstedGrade] : null

  if (hasLocation) {
    return (
      <div className="relative aspect-video rounded-xl shadow-md overflow-hidden border border-gray-200">
        {/* 2x2 tile grid background */}
        <div className="absolute inset-0 grid grid-cols-2 grid-rows-2">
          {tiles.map((t, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={`https://tile.openstreetmap.org/${zoom}/${t.x}/${t.y}.png`}
              alt=""
              className="w-full h-full object-cover"
              draggable={false}
            />
          ))}
        </div>

        {/* Gradient overlay at bottom */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

        {/* Nursery name */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <p className="text-white font-semibold text-lg leading-tight line-clamp-2 drop-shadow-md">
            {name}
          </p>
          <p className="text-white/70 text-xs mt-1 flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            No photos yet
          </p>
        </div>

        {/* Ofsted grade badge - top right corner */}
        {gradeStyle && (
          <div className={`absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-bold shadow-lg ${gradeStyle}`}>
            {ofstedGrade}
          </div>
        )}

        {/* Map pin indicator - top left */}
        <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm rounded-full px-2 py-1 text-xs text-gray-700 font-medium shadow flex items-center gap-1">
          <svg className="w-3 h-3 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
          </svg>
          Street view
        </div>
      </div>
    )
  }

  // Fallback: gradient with initial (no location available)
  return (
    <div className={`relative bg-gradient-to-br ${gradient} aspect-video rounded-xl shadow-md overflow-hidden flex items-center justify-center`}>
      <span className="text-white text-5xl font-bold opacity-80">{initial}</span>
      {/* Gradient overlay at bottom */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <p className="text-white font-semibold text-lg leading-tight line-clamp-2 drop-shadow-md">
          {name}
        </p>
        <p className="text-white/70 text-xs mt-1">No photos yet</p>
      </div>
      {gradeStyle && (
        <div className={`absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-bold shadow-lg ${gradeStyle}`}>
          {ofstedGrade}
        </div>
      )}
    </div>
  )
}
