import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import EnquiryModal from '@/components/EnquiryModal'

// Mock SessionProvider to return a logged-in user
vi.mock('@/components/SessionProvider', () => ({
  useSession: () => ({
    session: { access_token: 'test-token' },
    user: { id: 'user-1', email: 'test@example.com' },
    role: 'customer',
    loading: false,
    signOut: vi.fn(),
    refresh: vi.fn(),
  }),
}))

// Mock API_URL
vi.mock('@/lib/api', () => ({
  API_URL: 'http://localhost:3001',
}))

const nurseries = [
  { id: 'n1', urn: '111111', name: 'Happy Days Nursery', town: 'London' },
  { id: 'n2', urn: '222222', name: 'Little Stars', town: 'Oxford' },
]

const baseProps = {
  nurseries,
  onClose: vi.fn(),
}

describe('EnquiryModal', () => {
  it('renders nursery names in the modal', () => {
    render(<EnquiryModal {...baseProps} />)
    expect(screen.getByText('Happy Days Nursery')).toBeInTheDocument()
    expect(screen.getByText('Little Stars')).toBeInTheDocument()
  })

  it('renders the modal title', () => {
    render(<EnquiryModal {...baseProps} />)
    expect(screen.getByText('Send enquiry')).toBeInTheDocument()
  })

  it('has form fields for child name, DOB, preferred start, session preference, and message', () => {
    render(<EnquiryModal {...baseProps} />)
    expect(screen.getByText("Child's name")).toBeInTheDocument()
    expect(screen.getByText('Date of birth')).toBeInTheDocument()
    expect(screen.getByText('Preferred start date')).toBeInTheDocument()
    expect(screen.getByText('Session preference')).toBeInTheDocument()
    expect(screen.getByText('Message (optional)')).toBeInTheDocument()
  })

  it('has close button that calls onClose', () => {
    const onClose = vi.fn()
    render(<EnquiryModal {...baseProps} onClose={onClose} />)
    const closeButton = screen.getByText('\u00D7')
    fireEvent.click(closeButton)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('renders submit button with nursery count', () => {
    render(<EnquiryModal {...baseProps} />)
    expect(screen.getByText('Send to 2 nurseries')).toBeInTheDocument()
  })

  it('shows nursery town names', () => {
    render(<EnquiryModal {...baseProps} />)
    expect(screen.getByText('London')).toBeInTheDocument()
    expect(screen.getByText('Oxford')).toBeInTheDocument()
  })

  it('pre-fills child name when provided', () => {
    render(<EnquiryModal {...baseProps} childName="Emma" />)
    const inputs = screen.getAllByRole('textbox')
    const childNameInput = inputs[0]
    expect(childNameInput).toHaveValue('Emma')
  })

  it('has all nurseries selected by default', () => {
    render(<EnquiryModal {...baseProps} />)
    const checkboxes = screen.getAllByRole('checkbox')
    for (const checkbox of checkboxes) {
      expect(checkbox).toBeChecked()
    }
  })
})
