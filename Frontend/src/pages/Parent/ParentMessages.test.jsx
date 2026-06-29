import { describe, it, expect } from 'vitest'
import { renderWithRouter, screen, setSessionUser } from '../../test/test-utils'
import { ParentMessages } from './ParentMessages'

describe('ParentMessages', () => {
  it('renders the messaging chrome with seeded conversations and the active thread', () => {
    setSessionUser({ first_name: 'Aline', last_name: 'Uwase', role: 'parent' })
    renderWithRouter(<ParentMessages />)

    expect(screen.getByText('Communicate with teachers and school staff')).toBeInTheDocument()
    expect(screen.getAllByText('Ms. C. Umutoni').length).toBeGreaterThan(0)
    expect(screen.getByText('Mr. E. Mutabazi')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Type a message…')).toBeInTheDocument()
  })
})
