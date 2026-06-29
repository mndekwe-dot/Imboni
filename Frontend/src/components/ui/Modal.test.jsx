import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Modal } from './Modal'

beforeAll(() => {
  // jsdom doesn't implement <dialog> showModal/close — stub them
  HTMLDialogElement.prototype.showModal = vi.fn()
  HTMLDialogElement.prototype.close = vi.fn()
})

describe('Modal', () => {
  it('renders title, icon and children', () => {
    render(
      <Modal title="My Modal" icon="info" onClose={() => {}}>
        <p>Body content</p>
      </Modal>
    )
    expect(screen.getByText('My Modal')).toBeInTheDocument()
    expect(screen.getByText('Body content')).toBeInTheDocument()
  })

  it('renders footer when provided', () => {
    render(
      <Modal title="T" onClose={() => {}} footer={<button>Save</button>}>
        body
      </Modal>
    )
    expect(screen.getByText('Save')).toBeInTheDocument()
  })

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn()
    render(<Modal title="T" onClose={onClose}>body</Modal>)
    fireEvent.click(screen.getByLabelText('Close'))
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose on backdrop click but not when clicking inside the modal body', () => {
    const onClose = vi.fn()
    render(<Modal title="T" onClose={onClose}><p>Inner</p></Modal>)

    fireEvent.click(screen.getByText('Inner'))
    expect(onClose).not.toHaveBeenCalled()

    const dialog = document.querySelector('dialog')
    fireEvent.click(dialog)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('applies the wide size class', () => {
    render(<Modal title="T" onClose={() => {}} size="wide">body</Modal>)
    expect(document.querySelector('dialog')).toHaveClass('tt-modal-wide')
  })
})
