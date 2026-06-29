import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatCard } from './StatCard'

describe('StatCard', () => {
  it('renders value and label', () => {
    render(<StatCard icon="group" value="42" label="Students" />)
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByText('Students')).toBeInTheDocument()
  })

  it('renders trend text when provided', () => {
    render(<StatCard icon="group" value="42" label="Students" trend="+5 this week" />)
    expect(screen.getByText('+5 this week')).toBeInTheDocument()
  })

  it('does not render trend block when omitted', () => {
    render(<StatCard icon="group" value="42" label="Students" />)
    expect(document.querySelector('.portal-stat-trend')).not.toBeInTheDocument()
  })

  it('applies the colorClass to the card and icon', () => {
    render(<StatCard icon="group" value="42" label="Students" colorClass="warning" />)
    expect(document.querySelector('.portal-stat-card')).toHaveClass('warning')
    expect(document.querySelector('.portal-stat-icon')).toHaveClass('warning')
  })
})
