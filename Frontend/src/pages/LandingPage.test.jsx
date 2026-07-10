import { describe, it, expect } from 'vitest'
import { renderWithRouter, screen } from '../test/test-utils'
import { LandingPage } from './LandingPage'

describe('LandingPage', () => {
  it('renders the hero heading', () => {
    renderWithRouter(<LandingPage />)
    expect(screen.getByText('connected.')).toBeInTheDocument()
  })

  it('renders a Sign In link to /login', () => {
    renderWithRouter(<LandingPage />)
    const signInLinks = screen.getAllByText('Sign In')
    expect(signInLinks.length).toBeGreaterThan(0)
    expect(signInLinks[0].closest('a')).toHaveAttribute('href', '/login')
  })

  it('renders all six portal cards', () => {
    renderWithRouter(<LandingPage />)
    expect(screen.getAllByText('Student Portal').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Teacher Portal').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Parent Portal').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Director of Studies').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Discipline Portal').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Matron Portal').length).toBeGreaterThan(0)
  })
})
