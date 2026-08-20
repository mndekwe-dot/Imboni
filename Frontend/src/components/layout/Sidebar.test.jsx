import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act } from 'react'
import { renderWithRouter, screen, fireEvent } from '../../test/test-utils'
import { Sidebar } from './Sidebar'

const mockLogout = vi.fn()
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ logout: mockLogout }),
}))

// Nav items carry a translation key, not display text. Logout is flagged by
// `action` rather than by its label — the label is translated, so matching on
// it would break the moment the user switches language.
const navItems = [
  { to: '/teacher', labelKey: 'nav.dashboard', icon: 'dashboard', end: true },
  { to: '/teacher/classes', labelKey: 'nav.myClasses', icon: 'class' },
]
const secondaryItems = [
  { to: '/profile', labelKey: 'nav.profile', icon: 'person' },
  { labelKey: 'nav.logout', action: 'logout', icon: 'logout' },
]

describe('Sidebar', () => {
  beforeEach(() => {
    mockLogout.mockClear()
    localStorage.clear()   // the collapse choice persists between mounts now
  })

  it('renders nav items and secondary items', () => {
    renderWithRouter(<Sidebar navItems={navItems} secondaryItems={secondaryItems} />)
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('My Classes')).toBeInTheDocument()
    expect(screen.getByText('Profile')).toBeInTheDocument()
    expect(screen.getByText('Logout')).toBeInTheDocument()
  })

  it('renders the brand name', () => {
    renderWithRouter(<Sidebar navItems={navItems} secondaryItems={secondaryItems} />)
    expect(screen.getByText('Imboni')).toBeInTheDocument()
  })

  it('calls logout when the Logout button is clicked', () => {
    renderWithRouter(<Sidebar navItems={navItems} secondaryItems={secondaryItems} />)
    fireEvent.click(screen.getByText('Logout'))
    expect(mockLogout).toHaveBeenCalled()
  })

  it('toggles the collapsed class on the desktop toggle button', () => {
    renderWithRouter(<Sidebar navItems={navItems} secondaryItems={secondaryItems} />)
    const aside = document.querySelector('aside.sidebar')
    expect(aside).not.toHaveClass('collapsed')
    // Label reflects the action: "Collapse sidebar" when expanded, "Expand" when collapsed.
    fireEvent.click(screen.getByLabelText('Collapse sidebar'))
    expect(aside).toHaveClass('collapsed')
  })

  it('keeps every label in the DOM when collapsed — it becomes the tooltip', () => {
    renderWithRouter(<Sidebar navItems={navItems} secondaryItems={secondaryItems} />)
    fireEvent.click(screen.getByLabelText('Collapse sidebar'))

    /* The collapsed rail shows icons only. The label is not removed, it is
       repositioned by CSS as a hover tooltip — so it must still be rendered,
       and the link keeps a real accessible name. */
    expect(screen.getByText('Dashboard')).toHaveClass('sidebar-nav-label')
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument()
  })

  it('labels the account group but not the main nav', () => {
    renderWithRouter(<Sidebar navItems={navItems} secondaryItems={secondaryItems} />)
    // The first group needs no eyebrow — it is obviously the main nav.
    expect(screen.queryByText('Main')).not.toBeInTheDocument()
    expect(screen.getByText('Account')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Collapse sidebar'))
    /* Collapsed it is hidden visually (CSS), but must stay in the document:
       the account list is aria-labelledby it, so dropping the element would
       leave that group unnamed for screen readers. The border-top on
       .secondary-nav carries the boundary visually. */
    const heading = screen.getByText('Account')
    expect(heading).toBeInTheDocument()
    expect(document.getElementById(heading.id)).toBe(heading)
    expect(screen.getByRole('list', { name: 'Account' })).toBeInTheDocument()
  })

  it('remembers the collapse choice across remounts', () => {
    const { unmount } = renderWithRouter(<Sidebar navItems={navItems} secondaryItems={secondaryItems} />)
    fireEvent.click(screen.getByLabelText('Collapse sidebar'))
    expect(document.querySelector('aside.sidebar')).toHaveClass('collapsed')
    unmount()

    /* Every page mounts its own Sidebar, so navigating used to reset this and
       the panel sprang back open the moment you clicked a nav item. */
    renderWithRouter(<Sidebar navItems={navItems} secondaryItems={secondaryItems} />)
    expect(document.querySelector('aside.sidebar')).toHaveClass('collapsed')
  })

  it('puts the collapse toggle outside the logo header so it cannot overlap the brand', () => {
    renderWithRouter(<Sidebar navItems={navItems} secondaryItems={secondaryItems} />)
    const toggle = screen.getByLabelText('Collapse sidebar')
    expect(toggle.closest('.sidebar-logo')).toBeNull()
    expect(toggle.closest('aside.sidebar')).not.toBeNull()
  })

  it('opens the mobile sidebar on the imboni:open-sidebar event', () => {
    renderWithRouter(<Sidebar navItems={navItems} secondaryItems={secondaryItems} />)
    const aside = document.querySelector('aside.sidebar')
    expect(aside).not.toHaveClass('active')
    act(() => { document.dispatchEvent(new CustomEvent('imboni:open-sidebar')) })
    expect(aside).toHaveClass('active')
  })
})
