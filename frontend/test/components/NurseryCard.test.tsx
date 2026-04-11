import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import NurseryCard from '@/components/NurseryCard'
import type { Nursery } from '@/lib/api'

// Mock child components that have their own dependencies
vi.mock('@/components/ShortlistButton', () => ({
  default: () => <button>shortlist</button>,
}))
vi.mock('@/components/CompareButton', () => ({
  default: () => <button>compare</button>,
}))
vi.mock('@/components/FeaturedBadge', () => ({
  default: () => <span>Featured</span>,
}))
vi.mock('@/components/MatchBadge', () => ({
  default: () => null,
}))
vi.mock('@/components/MatchRationale', () => ({
  default: () => null,
}))
vi.mock('@/components/AvailabilityBadge', () => ({
  default: () => null,
}))
vi.mock('@/components/NurseryCardThumbnail', () => ({
  default: () => <div data-testid="thumbnail" />,
}))

function makeNursery(overrides: Partial<Nursery> = {}): Nursery {
  return {
    id: '1',
    urn: '123456',
    name: 'Sunny Days Nursery',
    provider_type: 'Childcare on non-domestic premises',
    address_line1: '10 High Street',
    address_line2: null,
    town: 'Oxford',
    postcode: 'OX1 1AA',
    local_authority: 'Oxfordshire',
    region: 'South East',
    phone: '01234 567890',
    email: null,
    website: null,
    ofsted_overall_grade: 'Good',
    last_inspection_date: '2024-06-15',
    inspection_report_url: null,
    inspection_date_warning: false,
    enforcement_notice: false,
    total_places: 40,
    places_funded_2yr: 8,
    places_funded_3_4yr: 16,
    google_rating: 4.5,
    google_review_count: 22,
    fee_avg_monthly: null,
    fee_report_count: 0,
    lat: 51.75,
    lng: -1.26,
    distance_km: 1.3,
    ...overrides,
  }
}

describe('NurseryCard', () => {
  it('renders nursery name', () => {
    render(<NurseryCard nursery={makeNursery()} />)
    expect(screen.getByText('Sunny Days Nursery')).toBeInTheDocument()
  })

  it('renders link to nursery profile', () => {
    render(<NurseryCard nursery={makeNursery()} />)
    const link = screen.getByText('Sunny Days Nursery').closest('a')
    expect(link).toHaveAttribute('href', '/nursery/123456')
  })

  it('renders distance when showDistance is true and distance exists', () => {
    render(<NurseryCard nursery={makeNursery({ distance_km: 2.5 })} />)
    expect(screen.getByText(/2\.5km away/)).toBeInTheDocument()
  })

  it('does not render distance when showDistance is false', () => {
    render(<NurseryCard nursery={makeNursery({ distance_km: 2.5 })} showDistance={false} />)
    expect(screen.queryByText(/2\.5km away/)).not.toBeInTheDocument()
  })

  it('renders town and address', () => {
    render(<NurseryCard nursery={makeNursery()} />)
    expect(screen.getByText('10 High Street, Oxford')).toBeInTheDocument()
  })

  it('renders total places', () => {
    render(<NurseryCard nursery={makeNursery({ total_places: 40 })} />)
    expect(screen.getByText(/40 places/)).toBeInTheDocument()
  })

  it('renders funded place indicators', () => {
    render(<NurseryCard nursery={makeNursery()} />)
    expect(screen.getByText(/2yr funded/)).toBeInTheDocument()
    expect(screen.getByText(/3-4yr funded/)).toBeInTheDocument()
  })

  it('handles null/missing data gracefully', () => {
    const nursery = makeNursery({
      address_line1: null,
      total_places: null,
      places_funded_2yr: null,
      places_funded_3_4yr: null,
      distance_km: undefined,
      last_inspection_date: null,
    })
    render(<NurseryCard nursery={nursery} />)
    expect(screen.getByText('Sunny Days Nursery')).toBeInTheDocument()
    expect(screen.queryByText(/places/)).not.toBeInTheDocument()
    expect(screen.queryByText(/funded/)).not.toBeInTheDocument()
    expect(screen.queryByText(/away/)).not.toBeInTheDocument()
  })

  it('shows old inspection warning when flagged', () => {
    render(<NurseryCard nursery={makeNursery({ inspection_date_warning: true })} />)
    expect(screen.getByText(/Old inspection/)).toBeInTheDocument()
  })

  it('renders inspection date when present', () => {
    render(<NurseryCard nursery={makeNursery({ last_inspection_date: '2024-06-15' })} />)
    expect(screen.getByText(/Inspected June 2024/)).toBeInTheDocument()
  })
})
