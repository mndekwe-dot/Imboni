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

  it('steps a long figure down even when it is passed as an element', () => {
    function Amount({ value }) { return <span>{value} RWF</span> }
    Amount.statText = ({ value }) => `${value} RWF`
    render(<StatCard icon="payments" value={<Amount value="1,490,000" />} label="Charged" />)
    expect(document.querySelector('.portal-stat-value')).toHaveClass('is-long')
  })

  it('reads text children of a plain element', () => {
    render(<StatCard icon="grade" value={<strong>Excellent</strong>} label="Conduct" />)
    expect(document.querySelector('.portal-stat-value')).toHaveClass('is-word')
  })

  it('leaves a short figure at the headline size', () => {
    render(<StatCard icon="group" value={<span>42</span>} label="Students" />)
    expect(document.querySelector('.portal-stat-value')).not.toHaveClass('is-long')
  })

  it('applies the colorClass to the card and icon', () => {
    render(<StatCard icon="group" value="42" label="Students" colorClass="warning" />)
    expect(document.querySelector('.portal-stat-card')).toHaveClass('warning')
    expect(document.querySelector('.portal-stat-icon')).toHaveClass('warning')
  })
})
