import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import GradeBadge from '@/components/GradeBadge'

describe('GradeBadge', () => {
  it('renders Outstanding with green styling', () => {
    render(<GradeBadge grade="Outstanding" />)
    const badge = screen.getByText('Outstanding')
    expect(badge).toBeInTheDocument()
    expect(badge.className).toContain('bg-green-100')
  })

  it('renders Good with blue styling', () => {
    render(<GradeBadge grade="Good" />)
    const badge = screen.getByText('Good')
    expect(badge).toBeInTheDocument()
    expect(badge.className).toContain('bg-blue-100')
  })

  it('renders Requires Improvement with amber styling', () => {
    render(<GradeBadge grade="Requires Improvement" />)
    const badge = screen.getByText('Requires Improvement')
    expect(badge.className).toContain('bg-amber-100')
  })

  it('renders Inadequate with red styling', () => {
    render(<GradeBadge grade="Inadequate" />)
    const badge = screen.getByText('Inadequate')
    expect(badge.className).toContain('bg-red-100')
  })

  it('renders "Not yet inspected" for null grade', () => {
    render(<GradeBadge grade={null} />)
    expect(screen.getByText('Not yet inspected')).toBeInTheDocument()
  })

  it('renders "Not yet inspected" for unknown grade', () => {
    render(<GradeBadge grade="Unknown" />)
    expect(screen.getByText('Not yet inspected')).toBeInTheDocument()
  })

  it('applies small size class', () => {
    render(<GradeBadge grade="Good" size="sm" />)
    const badge = screen.getByText('Good')
    expect(badge.className).toContain('text-xs')
  })

  it('applies large size class', () => {
    render(<GradeBadge grade="Good" size="lg" />)
    const badge = screen.getByText('Good')
    expect(badge.className).toContain('text-base')
  })

  it('applies medium size by default', () => {
    render(<GradeBadge grade="Good" />)
    const badge = screen.getByText('Good')
    expect(badge.className).toContain('text-sm')
  })
})
