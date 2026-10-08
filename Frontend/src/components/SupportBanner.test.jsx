import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SupportBanner } from './SupportBanner'

describe('SupportBanner', () => {
    beforeEach(() => localStorage.clear())

    it('says nothing in an ordinary session', () => {
        render(<SupportBanner />)
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('is on screen for as long as a support session lasts', () => {
        localStorage.setItem('imboni_support', JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 600, operator: 'ops@imboni.com' }))
        render(<SupportBanner />)
        expect(screen.getByRole('alert')).toHaveTextContent('Imboni support is viewing this school')
        expect(screen.getByRole('button', { name: 'End session' })).toBeInTheDocument()
    })
})
