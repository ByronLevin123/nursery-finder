import { Nursery } from '@/lib/api'

interface Props {
  nursery: Pick<Nursery, 'spots_available' | 'has_waitlist'>
}

export default function AvailabilityBadge({ nursery }: Props) {
  // If provider has not set availability data, show nothing
  if (nursery.spots_available == null && !nursery.has_waitlist) {
    return null
  }

  if (nursery.spots_available != null && nursery.spots_available > 0) {
    return (
      <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200 font-medium">
        Spots available
      </span>
    )
  }

  if (nursery.has_waitlist) {
    return (
      <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-medium">
        Waitlist
      </span>
    )
  }

  // spots_available === 0 and no waitlist
  if (nursery.spots_available != null && nursery.spots_available === 0) {
    return (
      <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200 font-medium">
        Full
      </span>
    )
  }

  return null
}
