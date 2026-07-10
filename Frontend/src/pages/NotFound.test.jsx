import { describe, it, expect } from 'vitest'
import { renderWithRouter, screen } from '../test/test-utils'
import { NotFound } from './NotFound'

describe('NotFound', () => {
  it('renders the not-found heading', () => {
    renderWithRouter(<NotFound />)
    expect(screen.getByText('Page not found')).toBeInTheDocument()
  })

  it('links back home', () => {
    renderWithRouter(<NotFound />)
    expect(screen.getByText('Take me home').closest('a')).toHaveAttribute('href', '/')
  })
})
