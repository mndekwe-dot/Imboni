import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'

import { ToastProvider, useToast } from './ToastContext'

function Trigger() {
    const toast = useToast()
    return (
        <>
            <button onClick={() => toast.success('Saved')}>save</button>
            <button onClick={() => toast.error('Broke')}>fail</button>
            <button onClick={() => toast.success('')}>blank</button>
        </>
    )
}

const setup = () => render(<ToastProvider><Trigger /></ToastProvider>)

// fireEvent rather than userEvent throughout: userEvent polls the DOM
// between steps, which deadlocks against fake timers unless every one of its
// internal waits is advanced by hand. These are click-and-assert tests, so
// the simpler dispatch is also the more reliable one.
describe('ToastContext', () => {
    afterEach(() => { vi.useRealTimers() })

    it('shows what it was told to show', () => {
        setup()
        fireEvent.click(screen.getByText('save'))

        expect(screen.getByRole('alert')).toHaveTextContent('Saved')
    })

    it('stacks several without dropping any', () => {
        setup()
        fireEvent.click(screen.getByText('save'))
        fireEvent.click(screen.getByText('fail'))

        // The app's rule is that nothing fails silently, so a form reporting
        // several problems pushes several toasts within a few frames.
        expect(screen.getAllByRole('alert')).toHaveLength(2)
    })

    it('ignores an empty message rather than showing a blank toast', () => {
        setup()
        fireEvent.click(screen.getByText('blank'))

        expect(screen.queryByRole('alert')).toBeNull()
    })

    /*
     * Dismissal is two steps: mark it leaving so CSS has something to fade,
     * then remove it. Removing in one step takes the node out of the DOM in
     * the same frame, leaving nothing to animate — which is what made a
     * dismissed toast vanish between frames and read as a glitch rather than
     * as a dismissal.
     */
    it('marks a toast leaving before removing it', () => {
        vi.useFakeTimers()
        setup()
        fireEvent.click(screen.getByText('save'))
        fireEvent.click(screen.getByLabelText('Dismiss notification'))

        expect(screen.getByRole('alert').className).toContain('toast-leaving')

        act(() => { vi.advanceTimersByTime(200) })
        expect(screen.queryByRole('alert')).toBeNull()
    })

    it('auto-dismisses on its own timer', () => {
        vi.useFakeTimers()
        setup()
        fireEvent.click(screen.getByText('save'))

        act(() => { vi.advanceTimersByTime(4000 + 200) })
        expect(screen.queryByRole('alert')).toBeNull()
    })

    it('keeps an error up longer than a confirmation', () => {
        vi.useFakeTimers()
        setup()
        fireEvent.click(screen.getByText('fail'))

        // A confirmation (4s) would be gone by now; something that went wrong
        // is still readable.
        act(() => { vi.advanceTimersByTime(4200) })
        expect(screen.getByRole('alert')).toHaveTextContent('Broke')
    })
})
