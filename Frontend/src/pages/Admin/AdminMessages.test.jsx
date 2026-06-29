import { describe, it, expect } from 'vitest'
import { renderWithRouter, screen, fireEvent } from '../../test/test-utils'
import { AdminMessages } from './AdminMessages'

describe('AdminMessages', () => {
    it('renders the conversation list and the active thread', () => {
        renderWithRouter(<AdminMessages />)

        expect(screen.getAllByText('Dr. J.C. Ndagijimana').length).toBeGreaterThan(0)
        expect(screen.getByText('Mrs. G. Hakizimana')).toBeInTheDocument()
        expect(screen.getByText('Rwanda MOE')).toBeInTheDocument()

        // Active contact rendered in the thread header
        expect(screen.getAllByText('Dr. J.C. Ndagijimana').length).toBeGreaterThan(0)
        expect(screen.getAllByText(/exam timetable has been finalised/).length).toBeGreaterThan(0)
    })

    it('renders the filter tabs', () => {
        renderWithRouter(<AdminMessages />)
        expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Unread' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Staff' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'DOS' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Parents' })).toBeInTheDocument()
    })

    it('switches the active filter tab on click', () => {
        renderWithRouter(<AdminMessages />)
        const unreadTab = screen.getByRole('button', { name: 'Unread' })
        expect(unreadTab.className).not.toContain('active')

        fireEvent.click(unreadTab)
        expect(unreadTab.className).toContain('active')
    })

    it('opens the thread panel on mobile when a conversation is clicked', () => {
        renderWithRouter(<AdminMessages />)
        // Click a conversation item (the one with this preview text)
        fireEvent.click(screen.getByText('March fee collection report is ready.'))
        // Back button should be present and clickable after opening thread
        expect(screen.getByLabelText('Back to conversations')).toBeInTheDocument()
    })

    it('uses the correct composer placeholder', () => {
        renderWithRouter(<AdminMessages />)
        expect(screen.getByPlaceholderText('Type your message...')).toBeInTheDocument()
    })
})
