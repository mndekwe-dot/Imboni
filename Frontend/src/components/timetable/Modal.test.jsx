import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Modal } from './Modal'

beforeEach(() => {
  // jsdom doesn't implement <dialog>.showModal()/close(). A no-op stub leaves
  // the `open` attribute unset, and Testing Library treats content inside a
  // non-open <dialog> (and the dialog role itself) as inaccessible — so the
  // stub must actually flip the open state.
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})

describe('Modal (timetable)', () => {
  it('renders title, icon, and children', () => {
    render(<Modal title="Manage Time Slots" icon="schedule" onClose={() => {}}>Body content</Modal>)
    expect(screen.getByText('Manage Time Slots')).toBeInTheDocument()
    expect(screen.getByText('schedule')).toBeInTheDocument()
    expect(screen.getByText('Body content')).toBeInTheDocument()
  })

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn()
    render(<Modal title="Title" onClose={onClose}>Body</Modal>)
    fireEvent.click(screen.getByLabelText('Close dialog'))
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose when clicking the backdrop (the dialog element itself)', () => {
    const onClose = vi.fn()
    render(<Modal title="Title" onClose={onClose}>Body</Modal>)
    const dialog = screen.getByRole('dialog')
    fireEvent.click(dialog)
    expect(onClose).toHaveBeenCalled()
  })

  it('does not call onClose when clicking inside the modal body', () => {
    const onClose = vi.fn()
    render(<Modal title="Title" onClose={onClose}>Body content</Modal>)
    fireEvent.click(screen.getByText('Body content'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('applies the wide class when wide is true', () => {
    render(<Modal title="Title" onClose={() => {}} wide>Body</Modal>)
    expect(screen.getByRole('dialog').className).toContain('tt-modal-wide')
  })
})
