import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SearchFilters, { DEFAULT_FILTERS, type SearchFilterValues } from '@/components/SearchFilters'

const baseProps = {
  filters: { ...DEFAULT_FILTERS },
  onChange: vi.fn(),
}

describe('SearchFilters', () => {
  it('renders the Filters button', () => {
    render(<SearchFilters {...baseProps} />)
    expect(screen.getByText('Filters')).toBeInTheDocument()
  })

  it('shows filter options when expanded', () => {
    render(<SearchFilters {...baseProps} />)
    fireEvent.click(screen.getByText('Filters'))
    expect(screen.getByText('Ofsted grade')).toBeInTheDocument()
    expect(screen.getByText('Outstanding')).toBeInTheDocument()
    expect(screen.getByText('Good')).toBeInTheDocument()
    expect(screen.getByText('Only show nurseries with spots available')).toBeInTheDocument()
    expect(screen.getByText('Minimum Google rating')).toBeInTheDocument()
    expect(screen.getByText('Provider type')).toBeInTheDocument()
    expect(screen.getByText('Funded places')).toBeInTheDocument()
  })

  it('calls onChange when availability filter toggled', () => {
    const onChange = vi.fn()
    render(<SearchFilters filters={{ ...DEFAULT_FILTERS }} onChange={onChange} />)
    fireEvent.click(screen.getByText('Filters'))
    fireEvent.click(screen.getByLabelText('Only show nurseries with spots available'))
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ has_availability: true })
    )
  })

  it('calls onChange when Ofsted grade checkbox toggled', () => {
    const onChange = vi.fn()
    render(<SearchFilters filters={{ ...DEFAULT_FILTERS }} onChange={onChange} />)
    fireEvent.click(screen.getByText('Filters'))
    fireEvent.click(screen.getByLabelText('Outstanding'))
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ grade: 'Outstanding' })
    )
  })

  it('calls onChange when funded 2yr checkbox toggled', () => {
    const onChange = vi.fn()
    render(<SearchFilters filters={{ ...DEFAULT_FILTERS }} onChange={onChange} />)
    fireEvent.click(screen.getByText('Filters'))
    fireEvent.click(screen.getByLabelText('Funded 2-year-old places'))
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ has_funded_2yr: true })
    )
  })

  it('shows active filter count badge', () => {
    const filtersWithActive: SearchFilterValues = {
      ...DEFAULT_FILTERS,
      grade: 'Good',
      has_availability: true,
    }
    render(<SearchFilters filters={filtersWithActive} onChange={vi.fn()} />)
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('shows Clear all filters button when filters are active', () => {
    const filtersWithActive: SearchFilterValues = {
      ...DEFAULT_FILTERS,
      grade: 'Good',
    }
    render(<SearchFilters filters={filtersWithActive} onChange={vi.fn()} />)
    fireEvent.click(screen.getByText('Filters'))
    expect(screen.getByText('Clear all filters')).toBeInTheDocument()
  })

  it('calls onChange with defaults when Clear all clicked', () => {
    const onChange = vi.fn()
    const filtersWithActive: SearchFilterValues = {
      ...DEFAULT_FILTERS,
      grade: 'Good',
    }
    render(<SearchFilters filters={filtersWithActive} onChange={onChange} />)
    fireEvent.click(screen.getByText('Filters'))
    fireEvent.click(screen.getByText('Clear all filters'))
    expect(onChange).toHaveBeenCalledWith(DEFAULT_FILTERS)
  })
})
