import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import NurseryCardThumbnail from '@/components/NurseryCardThumbnail'

describe('NurseryCardThumbnail', () => {
  it('renders photo when photos provided', () => {
    render(
      <NurseryCardThumbnail
        name="Test Nursery"
        photos={['https://example.com/photo.jpg']}
      />
    )
    const img = screen.getByAltText('Test Nursery photo')
    expect(img).toBeInTheDocument()
    expect(img.getAttribute('src')).toBe('https://example.com/photo.jpg')
  })

  it('renders map tile when lat/lng provided but no photos', () => {
    render(
      <NurseryCardThumbnail
        name="Test Nursery"
        lat={51.5}
        lng={-0.1}
      />
    )
    const img = screen.getByAltText('Map near Test Nursery')
    expect(img).toBeInTheDocument()
    expect(img.getAttribute('src')).toContain('tile.openstreetmap.org')
    expect(screen.getByText('Map view')).toBeInTheDocument()
  })

  it('renders gradient initials when no photos and no location', () => {
    render(<NurseryCardThumbnail name="Bright Horizons" />)
    expect(screen.getByText('BH')).toBeInTheDocument()
  })

  it('renders single initial for single-word name', () => {
    render(<NurseryCardThumbnail name="Sunshine" />)
    expect(screen.getByText('S')).toBeInTheDocument()
  })

  it('takes max 2 initials for long names', () => {
    render(<NurseryCardThumbnail name="The Very Best Little Nursery" />)
    expect(screen.getByText('TV')).toBeInTheDocument()
  })

  it('prefers photos over map tile', () => {
    render(
      <NurseryCardThumbnail
        name="Test"
        photos={['https://example.com/pic.jpg']}
        lat={51.5}
        lng={-0.1}
      />
    )
    expect(screen.getByAltText('Test photo')).toBeInTheDocument()
    expect(screen.queryByText('Map view')).not.toBeInTheDocument()
  })

  it('treats empty photos array as no photos', () => {
    render(
      <NurseryCardThumbnail
        name="Test Nursery"
        photos={[]}
        lat={51.5}
        lng={-0.1}
      />
    )
    expect(screen.getByAltText('Map near Test Nursery')).toBeInTheDocument()
  })

  it('treats null lat/lng as no location', () => {
    render(
      <NurseryCardThumbnail
        name="Hello World"
        lat={null}
        lng={null}
      />
    )
    expect(screen.getByText('HW')).toBeInTheDocument()
  })
})
