import { describe, it, expect, vi } from 'vitest'
import { renderWithRouter, screen, fireEvent } from '../../test/test-utils'
import { DashboardHeader } from './DashboardHeader'

describe('DashboardHeader', () => {
  it('renders title, subtitle, user name and role', () => {
    renderWithRouter(
      <DashboardHeader
        title="Dashboard"
        subtitle="Welcome back"
        userName="Jean Mugisha"
        userRole="Teacher"
        userInitials="JM"
        avatarClass="teacher-av"
        notifications={[]}
      />
    )
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Welcome back')).toBeInTheDocument()
    expect(screen.getByText('Jean Mugisha')).toBeInTheDocument()
    expect(screen.getByText('Teacher')).toBeInTheDocument()
    expect(screen.getByText('JM')).toBeInTheDocument()
  })

  it('links the avatar to the profile page with the role query param', () => {
    renderWithRouter(
      <DashboardHeader
        title="Dashboard" subtitle="" userName="Jean" userRole="Teacher"
        userInitials="J" avatarClass="teacher-av" notifications={[]}
      />
    )
    expect(screen.getByText('J').closest('a')).toHaveAttribute('href', '/profile?role=teacher')
  })

  it('dispatches imboni:open-sidebar when the mobile menu button is clicked', () => {
    const handler = vi.fn()
    document.addEventListener('imboni:open-sidebar', handler)
    renderWithRouter(
      <DashboardHeader title="Dashboard" subtitle="" userName="Jean" userRole="Teacher" userInitials="J" avatarClass="teacher-av" notifications={[]} />
    )
    fireEvent.click(screen.getByLabelText('Open menu'))
    expect(handler).toHaveBeenCalled()
    document.removeEventListener('imboni:open-sidebar', handler)
  })

  it('passes notifications through to the NotificationDropdown', () => {
    renderWithRouter(
      <DashboardHeader
        title="Dashboard" subtitle="" userName="Jean" userRole="Teacher" userInitials="J" avatarClass="teacher-av"
        notifications={[{ id: 1, title: 'Hi', message: 'Hello', time: 'now', read: false, path: '/' }]}
      />
    )
    expect(screen.getByText('1')).toBeInTheDocument() // unread badge
  })
})
