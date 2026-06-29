import { describe, it, expect } from 'vitest'
import { renderWithRouter, screen, setSessionUser } from '../../test/test-utils'
import { DisMessages } from './DisMessages'

describe('DisMessages', () => {
    it('renders the messaging chrome with Discipline-specific title and seeded conversations', () => {
        setSessionUser({ first_name: 'Eric', last_name: 'Mutabazi', role: 'discipline' })
        renderWithRouter(<DisMessages />)

        expect(screen.getAllByText('Messages').length).toBeGreaterThan(0)
        expect(screen.getByText('Communicate with matrons, patrons, students & parents')).toBeInTheDocument()
        // Seeded conversations from the page's static data
        expect(screen.getAllByText('Mrs. G. Hakizimana').length).toBeGreaterThan(0)
        expect(screen.getByText('Mr. J. Nsabimana')).toBeInTheDocument()
        expect(screen.getByText('Uwase Amina')).toBeInTheDocument()
        // Filter tabs passed through to MessagesPage
        expect(screen.getByRole('button', { name: 'Matrons' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Patrons' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Students' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Parents' })).toBeInTheDocument()
    })

    it('shows the active thread for the default contact with composer placeholder', () => {
        setSessionUser({ first_name: 'Eric', last_name: 'Mutabazi', role: 'discipline' })
        renderWithRouter(<DisMessages />)

        expect(screen.getByPlaceholderText('Type your message...')).toBeInTheDocument()
        expect(screen.getByText(/found outside dormitory after curfew/)).toBeInTheDocument()
    })
})
