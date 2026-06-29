import { describe, it, expect } from 'vitest'
import { renderWithRouter, screen } from '../../test/test-utils'
import { StudentMessages } from './StudentMessages'

describe('StudentMessages', () => {
    it('renders the messages page chrome with static conversations and thread', () => {
        renderWithRouter(<StudentMessages />)

        expect(screen.getByRole('heading', { level: 1, name: 'Messages' })).toBeInTheDocument()
        expect(screen.getByText('Communicate with your teachers')).toBeInTheDocument()
        expect(screen.getAllByText('Mr. Rurangwa').length).toBeGreaterThan(0)
        expect(screen.getByText('Good work on your last quiz, Amina!')).toBeInTheDocument()
    })
})
