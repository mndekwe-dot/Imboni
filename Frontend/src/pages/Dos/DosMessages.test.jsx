import { describe, it, expect } from 'vitest'
import { renderWithRouter, screen, setSessionUser } from '../../test/test-utils'
import { DosMessages } from './DosMessages'

describe('DosMessages', () => {
  it('renders the messaging chrome with DOS-specific title and seeded conversations', () => {
    setSessionUser({ first_name: 'Aline', last_name: 'Uwase', role: 'dos' })
    renderWithRouter(<DosMessages />)

    expect(screen.getAllByText('Messages').length).toBeGreaterThan(0)
    expect(screen.getByText('Communicate with teachers, staff and parents')).toBeInTheDocument()
    // Seeded conversations from the page's static data
    expect(screen.getAllByText('Ms. Claudine Umutoni').length).toBeGreaterThan(0)
    expect(screen.getByText('Mr. Pacifique Rurangwa')).toBeInTheDocument()
    // Filter tabs passed through to MessagesPage
    expect(screen.getByRole('button', { name: 'Teachers' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Parents' })).toBeInTheDocument()
  })

  it('shows the active thread for the default contact with composer placeholder', () => {
    setSessionUser({ first_name: 'Aline', last_name: 'Uwase', role: 'dos' })
    renderWithRouter(<DosMessages />)

    expect(screen.getByPlaceholderText('Write a message to Ms. Claudine Umutoni...')).toBeInTheDocument()
    expect(screen.getByText(/finished compiling the S4 mid-term results/)).toBeInTheDocument()
  })
})
