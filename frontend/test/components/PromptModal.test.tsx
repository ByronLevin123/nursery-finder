import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PromptModal from '@/components/PromptModal'

const baseProps = {
  open: true,
  title: 'Rename item',
  onSubmit: vi.fn(),
  onCancel: vi.fn(),
}

describe('PromptModal', () => {
  it('renders with default value in input', () => {
    render(<PromptModal {...baseProps} defaultValue="My nursery" />)
    const input = screen.getByRole('textbox')
    expect(input).toHaveValue('My nursery')
  })

  it('calls onSubmit with trimmed value', () => {
    const onSubmit = vi.fn()
    render(<PromptModal {...baseProps} defaultValue="  hello  " onSubmit={onSubmit} />)
    fireEvent.click(screen.getByText('OK'))
    expect(onSubmit).toHaveBeenCalledWith('hello')
  })

  it('shows validation error from validate prop', () => {
    const validate = vi.fn().mockReturnValue('Name too short')
    render(
      <PromptModal {...baseProps} defaultValue="ab" validate={validate} />
    )
    fireEvent.click(screen.getByText('OK'))
    expect(screen.getByText('Name too short')).toBeInTheDocument()
  })

  it('shows error for empty input', () => {
    render(<PromptModal {...baseProps} defaultValue="" />)
    fireEvent.click(screen.getByText('OK'))
    expect(screen.getByText('Please enter a value')).toBeInTheDocument()
  })

  it('calls onCancel when cancel clicked', () => {
    const onCancel = vi.fn()
    render(<PromptModal {...baseProps} onCancel={onCancel} />)
    fireEvent.click(screen.getByText('Cancel'))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('does not render when open=false', () => {
    render(<PromptModal {...baseProps} open={false} />)
    expect(screen.queryByText('Rename item')).not.toBeInTheDocument()
  })

  it('renders message when provided', () => {
    render(<PromptModal {...baseProps} message="Enter a new name" />)
    expect(screen.getByText('Enter a new name')).toBeInTheDocument()
  })

  it('clears validation error on input change', () => {
    render(<PromptModal {...baseProps} defaultValue="" />)
    fireEvent.click(screen.getByText('OK'))
    expect(screen.getByText('Please enter a value')).toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'x' } })
    expect(screen.queryByText('Please enter a value')).not.toBeInTheDocument()
  })
})
