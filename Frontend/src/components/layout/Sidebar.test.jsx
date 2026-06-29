import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act } from 'react'
import { renderWithRouter, screen, fireEvent } from '../../test/test-utils'
import { Sidebar } from './Sidebar'

const mockLogout = vi.fn()
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ logout: mockLogout }),
}))

const navItems = [
  { to: '/teacher', label: 'Dashboard', icon: 'dashboard', end: true },
  { to: '/teacher/classes', label: 'Classes', icon: 'class' },
]
const secondaryItems = [
  { to: '/profile', label: 'Profile', icon: 'person' },
  { label: 'Logout', icon: 'logout' },
]

describe('Sidebar', () => {
  beforeEach(() => mockLogout.mockClear())

  it('renders nav items and secondary items', () => {
    renderWithRouter(<Sidebar navItems={navItems} secondaryItems={secondaryItems} />)
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Classes')).toBeInTheDocument()
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
    fireEvent.click(screen.getByLabelText('Toggle sidebar'))
    expect(aside).toHaveClass('collapsed')
  })

  it('opens the mobile sidebar on the imboni:open-sidebar event', () => {
    renderWithRouter(<Sidebar navItems={navItems} secondaryItems={secondaryItems} />)
    const aside = document.querySelector('aside.sidebar')
    expect(aside).not.toHaveClass('active')
    act(() => { document.dispatchEvent(new CustomEvent('imboni:open-sidebar')) })
    expect(aside).toHaveClass('active')
  })
})
