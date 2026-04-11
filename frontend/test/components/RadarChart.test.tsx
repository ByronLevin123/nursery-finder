import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import RadarChart from '@/components/RadarChart'

const SAMPLE_AXES = [
  { label: 'Ofsted', values: [100, 75] },
  { label: 'Reviews', values: [80, 60] },
  { label: 'Value', values: [50, 90] },
  { label: 'Capacity', values: [70, 40] },
  { label: 'Funded', values: [100, 0] },
]

const NAMES = ['Nursery A', 'Nursery B']

describe('RadarChart', () => {
  it('renders SVG element', () => {
    const { container } = render(
      <RadarChart axes={SAMPLE_AXES} nurseryNames={NAMES} />
    )
    const svg = container.querySelector('svg')
    expect(svg).toBeTruthy()
  })

  it('renders axis labels', () => {
    render(<RadarChart axes={SAMPLE_AXES} nurseryNames={NAMES} />)
    expect(screen.getByText('Ofsted')).toBeInTheDocument()
    expect(screen.getByText('Reviews')).toBeInTheDocument()
    expect(screen.getByText('Value')).toBeInTheDocument()
    expect(screen.getByText('Capacity')).toBeInTheDocument()
    expect(screen.getByText('Funded')).toBeInTheDocument()
  })

  it('renders legend with nursery names', () => {
    render(<RadarChart axes={SAMPLE_AXES} nurseryNames={NAMES} />)
    expect(screen.getByText('Nursery A')).toBeInTheDocument()
    expect(screen.getByText('Nursery B')).toBeInTheDocument()
  })

  it('renders data polygons for each nursery', () => {
    const { container } = render(
      <RadarChart axes={SAMPLE_AXES} nurseryNames={NAMES} />
    )
    const polygons = container.querySelectorAll('polygon')
    // 4 grid rings + 2 data polygons = 6
    expect(polygons.length).toBe(4 + 2)
  })

  it('renders data point circles with tooltips', () => {
    const { container } = render(
      <RadarChart axes={SAMPLE_AXES} nurseryNames={NAMES} />
    )
    const circles = container.querySelectorAll('circle')
    // 5 axes * 2 nurseries = 10 circles
    expect(circles.length).toBe(10)

    // Check tooltip content
    const titles = container.querySelectorAll('title')
    expect(titles.length).toBe(10)
  })

  it('renders grid lines', () => {
    const { container } = render(
      <RadarChart axes={SAMPLE_AXES} nurseryNames={NAMES} />
    )
    const lines = container.querySelectorAll('line')
    // One line per axis = 5
    expect(lines.length).toBe(5)
  })

  it('handles single nursery', () => {
    const { container } = render(
      <RadarChart
        axes={[
          { label: 'A', values: [50] },
          { label: 'B', values: [75] },
          { label: 'C', values: [100] },
        ]}
        nurseryNames={['Only One']}
      />
    )
    const svg = container.querySelector('svg')
    expect(svg).toBeTruthy()
    expect(screen.getByText('Only One')).toBeInTheDocument()
  })

  it('accepts custom size', () => {
    const { container } = render(
      <RadarChart axes={SAMPLE_AXES} nurseryNames={NAMES} size={400} />
    )
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('viewBox')).toBe('0 0 400 400')
  })
})
