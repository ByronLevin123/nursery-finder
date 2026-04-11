import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import VisitChecklist from '@/components/VisitChecklist'

describe('VisitChecklist', () => {
  it('renders section titles', () => {
    render(<VisitChecklist />)
    expect(screen.getByText('Safety & Security')).toBeInTheDocument()
    expect(screen.getByText('Staff & Ratios')).toBeInTheDocument()
    expect(screen.getByText('Learning & Development')).toBeInTheDocument()
    expect(screen.getByText('Facilities')).toBeInTheDocument()
    expect(screen.getByText('Food & Nutrition')).toBeInTheDocument()
  })

  it('renders checklist items', () => {
    render(<VisitChecklist />)
    // Check a few specific items exist
    expect(screen.getByText(/Secure entry and exit/)).toBeInTheDocument()
    expect(screen.getByText(/Staff qualifications/)).toBeInTheDocument()
  })

  it('renders with custom nursery name', () => {
    render(<VisitChecklist nurseryName="Bright Horizons" />)
    // The component should render (may or may not display the name in heading)
    expect(screen.getByText('Safety & Security')).toBeInTheDocument()
  })

  it('has clickable checkboxes', () => {
    render(<VisitChecklist />)
    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes.length).toBeGreaterThan(0)

    // Click first checkbox
    fireEvent.click(checkboxes[0])
    expect(checkboxes[0]).toBeChecked()

    // Click again to uncheck
    fireEvent.click(checkboxes[0])
    expect(checkboxes[0]).not.toBeChecked()
  })
})
