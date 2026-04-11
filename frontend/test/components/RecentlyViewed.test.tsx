import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import RecentlyViewed from '@/components/RecentlyViewed'
import { addRecentlyViewed, clearRecentlyViewed } from '@/lib/recentlyViewed'

// Mock GradeBadge since it's a dependency
vi.mock('@/components/GradeBadge', () => ({
  default: ({ grade }: { grade: string }) => <span data-testid="grade-badge">{grade}</span>,
}))

describe('RecentlyViewed', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('renders nothing when no recently viewed items', () => {
    const { container } = render(<RecentlyViewed />)
    expect(container.textContent).toBe('')
  })

  it('renders items after they are added', () => {
    // Add items before rendering
    addRecentlyViewed({ urn: '123', name: 'Test Nursery', grade: 'Good', town: 'London' })
    addRecentlyViewed({ urn: '456', name: 'Another Nursery', grade: 'Outstanding', town: 'Bristol' })

    render(<RecentlyViewed />)

    expect(screen.getByText('Test Nursery')).toBeInTheDocument()
    expect(screen.getByText('Another Nursery')).toBeInTheDocument()
    expect(screen.getByText('London')).toBeInTheDocument()
    expect(screen.getByText('Bristol')).toBeInTheDocument()
  })

  it('shows "Recently viewed" heading', () => {
    addRecentlyViewed({ urn: '123', name: 'Test', grade: null, town: null })
    render(<RecentlyViewed />)
    expect(screen.getByText('Recently viewed')).toBeInTheDocument()
  })

  it('has clear history button', () => {
    addRecentlyViewed({ urn: '123', name: 'Test', grade: null, town: null })
    render(<RecentlyViewed />)
    const clearBtn = screen.getByText('Clear history')
    expect(clearBtn).toBeInTheDocument()
  })

  it('clears items when clear button clicked', async () => {
    addRecentlyViewed({ urn: '123', name: 'Test Nursery', grade: null, town: null })
    render(<RecentlyViewed />)

    expect(screen.getByText('Test Nursery')).toBeInTheDocument()

    await act(() => {
      fireEvent.click(screen.getByText('Clear history'))
    })

    // After clearing, the component should render nothing
    expect(screen.queryByText('Test Nursery')).not.toBeInTheDocument()
  })

  it('renders links to nursery pages', () => {
    addRecentlyViewed({ urn: '123', name: 'Test Nursery', grade: null, town: null })
    render(<RecentlyViewed />)
    const link = screen.getByText('Test Nursery').closest('a')
    expect(link?.getAttribute('href')).toBe('/nursery/123')
  })
})
