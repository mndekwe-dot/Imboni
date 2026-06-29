import { describe, it, expect, vi } from 'vitest'
import { renderWithRouter, screen, fireEvent } from '../test/test-utils'
import { NotificationDropdown } from './NotificationDropdown'

const notifications = [
  { id: 1, title: 'New message', message: 'You have a new message', time: '2m ago', read: false, path: '/teacher/messages' },
  { id: 2, title: 'Announcement', message: 'School closed Friday', time: '1h ago', read: true, path: '/teacher/announcements' },
]

describe('NotificationDropdown', () => {
  it('shows the unread count badge', () => {
    renderWithRouter(<NotificationDropdown notifications={notifications} onRead={() => {}} />)
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('does not show a badge when there are no unread notifications', () => {
    renderWithRouter(<NotificationDropdown notifications={[{ ...notifications[1] }]} onRead={() => {}} />)
    expect(document.querySelector('.notification-badge')).not.toBeInTheDocument()
  })

  it('opens the dropdown and lists notifications when the bell is clicked', () => {
    renderWithRouter(<NotificationDropdown notifications={notifications} onRead={() => {}} />)
    expect(screen.queryByText('New message')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('New message')).toBeInTheDocument()
    expect(screen.getByText('Announcement')).toBeInTheDocument()
  })

  it('calls onRead and navigates when a notification item is clicked', () => {
    const onRead = vi.fn()
    renderWithRouter(<NotificationDropdown notifications={notifications} onRead={onRead} />, { route: '/teacher' })
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByText('New message'))
    expect(onRead).toHaveBeenCalledWith(1)
  })

  it('closes the dropdown after clicking a notification item', () => {
    renderWithRouter(<NotificationDropdown notifications={notifications} onRead={() => {}} />)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByText('New message'))
    expect(screen.queryByText('Announcement')).not.toBeInTheDocument()
  })

  it('closes the dropdown when clicking outside', () => {
    renderWithRouter(
      <div>
        <NotificationDropdown notifications={notifications} onRead={() => {}} />
        <div data-testid="outside">Outside</div>
      </div>
    )
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('New message')).toBeInTheDocument()
    fireEvent.mouseDown(screen.getByTestId('outside'))
    expect(screen.queryByText('New message')).not.toBeInTheDocument()
  })

  it('re-syncs its local items when the notifications prop changes', () => {
    const { rerender } = renderWithRouter(<NotificationDropdown notifications={[]} onRead={() => {}} />)
    expect(document.querySelector('.notification-badge')).not.toBeInTheDocument()

    rerender(<NotificationDropdown notifications={notifications} onRead={() => {}} />)
    expect(screen.getByText('1')).toBeInTheDocument()
  })
})
