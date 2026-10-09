import { describe, it, expect } from 'vitest'
import { renderWithRouter, screen } from '../../test/test-utils'
import { PageLoading } from './PageLoading'

const nav = [{ to: '/x', icon: 'dashboard', labelKey: 'nav.dashboard' }]
const base = { navItems: nav, secondaryItems: [], title: 'Students', subtitle: 'All of them' }

describe('PageLoading', () => {
  it('keeps the page chrome on screen: header and navigation', () => {
    renderWithRouter(<PageLoading {...base} />)
    expect(screen.getByRole('heading', { name: 'Students' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: /main/i })).toBeInTheDocument()
  })

  it('shows a page-shaped skeleton, not a spinner', () => {
    const { container } = renderWithRouter(<PageLoading {...base} />)
    expect(container.querySelector('.route-fallback-spinner')).toBeNull()
    expect(container.querySelector('.dt-container')).toBeInTheDocument()
  })

  it('draws the shape it is told: dashboard, table or settings', () => {
    const dash = renderWithRouter(<PageLoading {...base} variant="dashboard" />)
    expect(dash.container.querySelector('.cards-grid')).toBeInTheDocument()
    expect(dash.container.querySelector('.dt-container')).toBeNull()
    dash.unmount()

    const settings = renderWithRouter(<PageLoading {...base} variant="settings" stats={0} />)
    expect(settings.container.querySelector('.portal-stat-grid')).toBeNull()
    expect(settings.container.querySelectorAll('.skel-card').length).toBeGreaterThan(1)
  })

  it('still announces that the page is loading, once', () => {
    renderWithRouter(<PageLoading {...base} />)
    expect(screen.getAllByText('Loading…')).toHaveLength(1)
  })
})
