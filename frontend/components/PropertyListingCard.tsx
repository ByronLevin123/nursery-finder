type Overlay = {
  nursery_count_total: number | null
  nursery_outstanding_pct: number | null
  nearest_outstanding_name: string | null
}

export type PropertyListing = {
  id: string
  listing_type: 'sale' | 'rent'
  address: string | null
  postcode: string | null
  price: number | null
  bedrooms: number | null
  bathrooms: number | null
  property_type: string | null
  image_url: string | null
  listing_url: string | null
  agent_name: string | null
  nursery_overlay?: Overlay
}

function formatPrice(p: number | null, type: 'sale' | 'rent') {
  if (p == null) return '—'
  if (type === 'rent') return `£${p.toLocaleString()} pw`
  return `£${p.toLocaleString()}`
}

function overlayClasses(pct: number | null) {
  if (pct == null) return 'bg-gray-100 text-gray-700 border-gray-200'
  if (pct >= 50) return 'bg-green-100 text-green-800 border-green-200'
  if (pct >= 25) return 'bg-amber-100 text-amber-800 border-amber-200'
  return 'bg-gray-100 text-gray-700 border-gray-200'
}

export default function PropertyListingCard({ listing }: { listing: PropertyListing }) {
  const overlay = listing.nursery_overlay
  const pct = overlay?.nursery_outstanding_pct ?? null
  const count = overlay?.nursery_count_total ?? null

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition">
      <div className="aspect-[4/3] bg-gray-100 relative">
        {listing.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={listing.image_url}
            alt={listing.address || 'Property'}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 text-4xl">
            🏠
          </div>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-baseline justify-between mb-2">
          <div className="text-xl font-bold text-gray-900">
            {formatPrice(listing.price, listing.listing_type)}
          </div>
          <div className="text-xs text-gray-500">
            {listing.bedrooms ?? '—'} bed · {listing.bathrooms ?? '—'} bath
          </div>
        </div>
        <div className="text-sm text-gray-700 mb-1 line-clamp-2">
          {listing.address || listing.postcode || '—'}
        </div>
        <div className="text-xs text-gray-500 mb-3">
          {listing.property_type || 'Property'}
          {listing.agent_name ? ` · ${listing.agent_name}` : ''}
        </div>

        <div
          className={`inline-block text-xs font-medium px-2 py-1 rounded-md border mb-3 ${overlayClasses(
            pct
          )}`}
        >
          {count != null
            ? `${count} nurseries nearby${pct != null ? ` — ${Math.round(pct)}% Outstanding` : ''}`
            : 'Nursery data unavailable'}
        </div>

        <div className="flex items-center justify-between gap-2">
          {listing.listing_url ? (
            <a
              href={listing.listing_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-indigo-700 hover:underline font-medium"
            >
              View on agent site →
            </a>
          ) : (
            <span />
          )}
          {listing.postcode ? (
            <a
              href={`/search?postcode=${encodeURIComponent(listing.postcode)}`}
              className="text-sm text-purple-700 hover:underline font-medium"
            >
              See nurseries here
            </a>
          ) : null}
        </div>
      </div>
    </div>
  )
}
