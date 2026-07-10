import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WelcomeBanner } from './WelcomeBanner'

describe('WelcomeBanner', () => {
  it('renders the name and role', () => {
    render(<WelcomeBanner name="Jean" role="Teacher" />)
    expect(screen.getByText('Jean')).toBeInTheDocument()
    expect(screen.getByText('Teacher')).toBeInTheDocument()
  })

  it('renders the badge when provided', () => {
    render(<WelcomeBanner name="Jean" role="Teacher" badge="New" />)
    expect(screen.getByText('New')).toBeInTheDocument()
  })

  it('does not render a badge when omitted', () => {
    render(<WelcomeBanner name="Jean" role="Teacher" />)
    expect(document.querySelector('.welcome-banner-badge')).not.toBeInTheDocument()
  })

  it('renders children in the extra slot', () => {
    render(<WelcomeBanner name="Jean" role="Teacher"><span>Extra info</span></WelcomeBanner>)
    expect(screen.getByText('Extra info')).toBeInTheDocument()
  })
})
