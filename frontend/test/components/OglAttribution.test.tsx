import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import OglAttribution from '@/components/OglAttribution'

describe('OglAttribution', () => {
  it('renders OGL attribution text', () => {
    render(<OglAttribution />)
    expect(
      screen.getByText(/licensed under the/i)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/NurseryMatch is independent of Ofsted/i)
    ).toBeInTheDocument()
  })

  it('contains link to the Open Government Licence', () => {
    render(<OglAttribution />)
    const licenceLink = screen.getByText('Open Government Licence v3.0')
    expect(licenceLink).toBeInTheDocument()
    expect(licenceLink.closest('a')).toHaveAttribute(
      'href',
      'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/'
    )
  })

  it('contains link to the Ofsted register', () => {
    render(<OglAttribution />)
    const ofstedLink = screen.getByRole('link', { name: 'Ofsted' })
    expect(ofstedLink).toBeInTheDocument()
    expect(ofstedLink).toHaveAttribute(
      'href',
      'https://www.gov.uk/government/statistical-data-sets/monthly-management-information-ofsteds-early-years-register'
    )
  })

  it('contains links to the Scotland and Wales regulators', () => {
    render(<OglAttribution />)
    const careInspectorate = screen.getByRole('link', { name: 'Care Inspectorate' })
    expect(careInspectorate).toHaveAttribute('href', 'https://www.careinspectorate.com/')
    const ciw = screen.getByRole('link', { name: 'CIW' })
    expect(ciw).toHaveAttribute('href', 'https://careinspectorate.wales/')
  })

  it('opens links in new tab', () => {
    render(<OglAttribution />)
    const links = screen.getAllByRole('link')
    for (const link of links) {
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    }
  })
})
