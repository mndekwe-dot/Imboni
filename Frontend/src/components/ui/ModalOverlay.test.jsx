import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ModalOverlay } from './ModalOverlay'

function Demo({ onClose }) {
    return (
        <>
            <button>Open</button>
            <ModalOverlay onClose={onClose}>
                <div className="modal-box">
                    <h2 className="modal-title">Edit student</h2>
                    <input aria-label="Name" />
                    <button>Save</button>
                </div>
            </ModalOverlay>
        </>
    )
}

describe('ModalOverlay', () => {
    it('is a named, modal dialog and puts focus inside', () => {
        render(<Demo onClose={() => {}} />)
        const dialog = screen.getByRole('dialog', { name: 'Edit student' })
        expect(dialog).toHaveAttribute('aria-modal', 'true')
        expect(dialog).toContainElement(document.activeElement)
    })

    it('closes on Escape and on a click outside, but not on a click inside', () => {
        const onClose = vi.fn()
        render(<Demo onClose={onClose} />)
        fireEvent.click(screen.getByLabelText('Name'))
        expect(onClose).not.toHaveBeenCalled()
        fireEvent.keyDown(document, { key: 'Escape' })
        expect(onClose).toHaveBeenCalledTimes(1)
        fireEvent.click(document.querySelector('.modal-overlay'))
        expect(onClose).toHaveBeenCalledTimes(2)
    })

    it('keeps Tab inside, wrapping from the last control to the first', () => {
        render(<Demo onClose={() => {}} />)
        screen.getByRole('button', { name: 'Save' }).focus()
        fireEvent.keyDown(document, { key: 'Tab' })
        expect(document.activeElement).toBe(screen.getByLabelText('Name'))
        fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
        expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Save' }))
    })
})
