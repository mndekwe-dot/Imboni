import { describe, it, expect, vi } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'

// The suite replaces confirmDialog with a window.confirm stub; this file is about the real one.
const { confirmDialog } = await vi.importActual('./confirm')

describe('confirmDialog', () => {
    it('resolves true on confirm and removes itself', async () => {
        const answer = confirmDialog('Delete this?')
        expect(screen.getByText('Delete this?')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
        expect(await answer).toBe(true)
        await waitFor(() => expect(screen.queryByText('Delete this?')).not.toBeInTheDocument())
    })

    it('resolves false on Cancel, and focuses the safe choice first', async () => {
        const answer = confirmDialog('Delete this?', { confirmLabel: 'Delete', danger: true })
        expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }))
        expect(screen.getByRole('button', { name: 'Delete' })).toHaveClass('btn-destructive')
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
        expect(await answer).toBe(false)
    })
})
