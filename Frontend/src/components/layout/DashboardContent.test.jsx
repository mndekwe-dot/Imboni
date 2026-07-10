import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DashboardContent } from './DashboardContent'

describe('DashboardContent', () => {
  it('renders children inside the dashboard content wrapper', () => {
    render(<DashboardContent><p>Hello content</p></DashboardContent>)
    expect(screen.getByText('Hello content')).toBeInTheDocument()
    expect(document.querySelector('.dashboard-content .dc-inner')).toBeInTheDocument()
  })
})
