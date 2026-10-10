import { describe, it, expect, afterEach, vi } from 'vitest'
import { renderWithRouter, screen, fireEvent } from '../../test/test-utils'
import { Sidebar } from './Sidebar'

const NAV = [
  { to: '/teacher', icon: 'dashboard', label: 'Dashboard', end: true },
  { to: '/teacher/attendance', icon: 'how_to_reg', label: 'Attendance' },
  { to: '/teacher/results', icon: 'edit_note', label: 'Results' },
  { to: '/teacher/assignments', icon: 'assignment', label: 'Assignments' },
  { to: '/teacher/materials', icon: 'folder', label: 'Materials' },
]

function phone(matches) {
  window.matchMedia = vi.fn().mockImplementation(query => ({
    matches: matches && query.includes('768'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

describe('Sidebar bottom tabs', () => {
  afterEach(() => { delete window.matchMedia })

  it('are not rendered on a wide screen', () => {
    phone(false)
    renderWithRouter(<Sidebar navItems={NAV} secondaryItems={[]} />)
    expect(screen.queryByRole('navigation', { name: 'Quick navigation' })).toBeNull()
  })

  it('show the first four pages and a More button on a phone', () => {
    phone(true)
    renderWithRouter(<Sidebar navItems={NAV} secondaryItems={[]} />)
    const bar = screen.getByRole('navigation', { name: 'Quick navigation' })
    const labels = Array.from(bar.querySelectorAll('.bottom-tab-label')).map(n => n.textContent)
    expect(labels).toEqual(['Dashboard', 'Attendance', 'Results', 'Assignments', 'More'])
  })

  it('open the full menu from More', () => {
    phone(true)
    const { container } = renderWithRouter(<Sidebar navItems={NAV} secondaryItems={[]} />)
    expect(container.querySelector('aside.sidebar.active')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'More' }))
    expect(container.querySelector('aside.sidebar.active')).not.toBeNull()
  })
})
