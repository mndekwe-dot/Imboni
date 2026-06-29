import { describe, it, expect, beforeEach } from 'vitest'
import { renderWithRouter, setSessionUser, screen, fireEvent } from '../../test/test-utils'
import { MatronMessages } from './MatronMessages'

describe('MatronMessages', () => {
    beforeEach(() => {
        setSessionUser({ first_name: 'Gloriose', last_name: 'Hakizimana', role: 'matron' })
    })

    it('renders the conversation list and the active thread', () => {
        renderWithRouter(<MatronMessages />)

        expect(screen.getAllByText('Mr. E. Mutabazi').length).toBeGreaterThan(0)
        expect(screen.getByText('Niyomugabo Iris')).toBeInTheDocument()
        expect(screen.getByText('Mr. Kayitesi P.')).toBeInTheDocument()
        expect(screen.getByText(/found outside the dormitory/)).toBeInTheDocument()
    })

    it('renders the filter tabs', () => {
        renderWithRouter(<MatronMessages />)
        expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Discipline' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Students' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Parents' })).toBeInTheDocument()
    })

    it('switches the active filter tab on click', () => {
        renderWithRouter(<MatronMessages />)
        const studentsTab = screen.getByRole('button', { name: 'Students' })
        expect(studentsTab.className).not.toContain('active')

        fireEvent.click(studentsTab)
        expect(studentsTab.className).toContain('active')
    })

    it('shows the matron user name in the header', () => {
        renderWithRouter(<MatronMessages />)
        expect(screen.getByText('Gloriose Hakizimana')).toBeInTheDocument()
    })
})
