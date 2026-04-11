import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ConfirmModal from '@/components/ConfirmModal'

const baseProps = {
  open: true,
  title: 'Delete item?',
  message: 'This action cannot be undone.',
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
}

describe('ConfirmModal', () => {
  it('renders title and message when open', () => {
    render(<ConfirmModal {...baseProps} />)
    expect(screen.getByText('Delete item?')).toBeInTheDocument()
    expect(screen.getByText('This action cannot be undone.')).toBeInTheDocument()
  })

  it('does not render when open=false', () => {
    render(<ConfirmModal {...baseProps} open={false} />)
    expect(screen.queryByText('Delete item?')).not.toBeInTheDocument()
  })

  it('calls onConfirm when confirm button clicked', () => {
    const onConfirm = vi.fn()
    render(<ConfirmModal {...baseProps} onConfirm={onConfirm} />)
    fireEvent.click(screen.getByText('Confirm'))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('calls onCancel when cancel button clicked', () => {
    const onCancel = vi.fn()
    render(<ConfirmModal {...baseProps} onCancel={onCancel} />)
    fireEvent.click(screen.getByText('Cancel'))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('calls onCancel on Escape key', () => {
    const onCancel = vi.fn()
    render(<ConfirmModal {...baseProps} onCancel={onCancel} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('shows danger variant styling on confirm button', () => {
    render(<ConfirmModal {...baseProps} variant="danger" />)
    const confirmBtn = screen.getByText('Confirm')
    expect(confirmBtn.className).toContain('bg-red-600')
  })

  it('shows default (blue) styling when no variant specified', () => {
    render(<ConfirmModal {...baseProps} />)
    const confirmBtn = screen.getByText('Confirm')
    expect(confirmBtn.className).toContain('bg-blue-600')
  })

  it('renders custom button labels', () => {
    render(
      <ConfirmModal
        {...baseProps}
        confirmLabel="Yes, delete"
        cancelLabel="No, keep it"
      />
    )
    expect(screen.getByText('Yes, delete')).toBeInTheDocument()
    expect(screen.getByText('No, keep it')).toBeInTheDocument()
  })
})
