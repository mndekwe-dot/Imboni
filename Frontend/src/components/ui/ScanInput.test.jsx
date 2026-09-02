import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { ScanInput } from './ScanInput'

/**
 * The keyboard path is the one that matters.
 *
 * A USB barcode scanner is a keyboard: it types the code into whatever has
 * focus and presses Enter. That is the hardware a school buys, so these tests
 * are the real interface, not a fallback for it.
 */
describe('ScanInput', () => {
    beforeEach(() => {
        // Chrome has BarcodeDetector, jsdom does not; both paths are exercised
        // by setting it per test.
        delete window.BarcodeDetector
    })

    it('hands the typed code to onScan when Enter is pressed', async () => {
        const onScan = vi.fn()
        render(<ScanInput onScan={onScan} />)

        await userEvent.type(screen.getByRole('textbox'), 'THI-0001{Enter}')

        expect(onScan).toHaveBeenCalledWith('THI-0001')
    })

    it('clears the box and keeps focus, so the next book can be scanned straight away', async () => {
        render(<ScanInput onScan={vi.fn()} />)
        const box = screen.getByRole('textbox')

        await userEvent.type(box, 'THI-0001{Enter}')

        // Both halves matter: a box that keeps the last code appends the next
        // one, and a box that loses focus means the scanner types into nothing.
        await waitFor(() => expect(box).toHaveValue(''))
        expect(box).toHaveFocus()
    })

    it('ignores an empty scan rather than sending a blank code', async () => {
        const onScan = vi.fn()
        render(<ScanInput onScan={onScan} />)

        await userEvent.type(screen.getByRole('textbox'), '{Enter}')

        expect(onScan).not.toHaveBeenCalled()
    })

    it('trims what the scanner adds', async () => {
        const onScan = vi.fn()
        render(<ScanInput onScan={onScan} />)

        await userEvent.type(screen.getByRole('textbox'), '  THI-0001  {Enter}')

        expect(onScan).toHaveBeenCalledWith('THI-0001')
    })

    it('does not offer a camera button where the browser cannot decode one', () => {
        // Firefox and Safari have no BarcodeDetector. A button that silently
        // does nothing is worse than no button.
        render(<ScanInput onScan={vi.fn()} />)

        expect(screen.queryByRole('button', { name: /camera/i })).toBeNull()
    })

    it('offers the camera where the browser can decode one', () => {
        window.BarcodeDetector = class {}
        render(<ScanInput onScan={vi.fn()} />)

        expect(screen.getByRole('button', { name: /camera/i })).toBeTruthy()
    })

    it('stays out of the way while busy', () => {
        render(<ScanInput onScan={vi.fn()} busy />)

        expect(screen.getByRole('textbox')).toBeDisabled()
    })
})
