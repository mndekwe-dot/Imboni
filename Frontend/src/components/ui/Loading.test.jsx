import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Loading } from './Loading'

describe('Loading', () => {
  it('renders the default label', () => {
    render(<Loading />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('renders a custom label', () => {
    render(<Loading label="Fetching students..." />)
    expect(screen.getByText('Fetching students...')).toBeInTheDocument()
  })

  it('applies the fullPage class when fullPage is true', () => {
    render(<Loading fullPage />)
    expect(document.querySelector('.loading-wrap')).toHaveClass('loading-wrap--full')
  })

  it('does not apply the fullPage class by default', () => {
    render(<Loading />)
    expect(document.querySelector('.loading-wrap')).not.toHaveClass('loading-wrap--full')
  })
})
