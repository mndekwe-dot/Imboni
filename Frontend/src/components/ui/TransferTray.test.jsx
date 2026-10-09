import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { ProgressBar } from './ProgressBar'
import { TransferTray } from './TransferTray'
import { trackTransfer, resetTransfers } from '../../utils/transfers'

describe('ProgressBar', () => {
  it('is a progress bar that announces its value', () => {
    render(<ProgressBar value={42.4} label="Uploading photo" />)
    const bar = screen.getByRole('progressbar', { name: 'Uploading photo' })
    expect(bar).toHaveAttribute('aria-valuenow', '42')
    expect(bar).toHaveAttribute('aria-valuemin', '0')
    expect(bar).toHaveAttribute('aria-valuemax', '100')
  })

  it('drives the fill from the value', () => {
    render(<ProgressBar value={50} label="x" />)
    expect(screen.getByRole('progressbar').firstChild.style.getPropertyValue('--pbar-value')).toBe('0.5')
  })

  it('clamps to 0-100', () => {
    const { rerender } = render(<ProgressBar value={250} label="x" />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
    rerender(<ProgressBar value={-5} label="x" />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
  })

  it('is indeterminate, with no value, when the size is unknown', () => {
    render(<ProgressBar value={null} label="Preparing" />)
    const bar = screen.getByRole('progressbar')
    expect(bar).not.toHaveAttribute('aria-valuenow')
    expect(bar).toHaveClass('pbar-indeterminate')
  })

  it('only shimmers while it is working', () => {
    const { rerender } = render(<ProgressBar value={30} label="x" />)
    expect(screen.getByRole('progressbar')).toHaveClass('pbar-active')
    rerender(<ProgressBar value={100} label="x" active={false} />)
    expect(screen.getByRole('progressbar')).not.toHaveClass('pbar-active')
  })

  it('takes a tone and a size', () => {
    render(<ProgressBar value={100} label="x" tone="error" size="sm" />)
    expect(screen.getByRole('progressbar')).toHaveClass('pbar-error', 'pbar-sm')
  })
})

describe('TransferTray', () => {
  beforeEach(() => resetTransfers())

  it('renders nothing when nothing is moving', () => {
    const { container } = render(<TransferTray />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows an upload with its name and live percentage', () => {
    render(<TransferTray />)
    let t
    act(() => { t = trackTransfer({ direction: 'upload', name: 'photo.png' }) })
    act(() => t.onProgress({ loaded: 30, total: 100 }))

    expect(screen.getByText('Uploading…')).toBeInTheDocument()
    expect(screen.getByText('photo.png')).toBeInTheDocument()
    expect(screen.getByText('30%')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '30')
  })

  it('shows a download as indeterminate when the server sent no size', () => {
    render(<TransferTray />)
    act(() => {
      const t = trackTransfer({ direction: 'download', name: 'report.pdf' })
      t.onProgress({ loaded: 4096 })
    })
    expect(screen.getByText('Downloading…')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow')
  })

  it('says so when a transfer finishes', () => {
    render(<TransferTray />)
    act(() => { trackTransfer({ direction: 'upload', name: 'a.png' }).done() })
    expect(screen.getByText('Uploaded')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
  })

  it('says so when a transfer fails, and offers to dismiss it', () => {
    render(<TransferTray />)
    act(() => { trackTransfer({ direction: 'download', name: 'a.pdf' }).fail() })
    expect(screen.getByText('Download failed')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument()
  })

  it('is a live region, so an outcome is announced', () => {
    render(<TransferTray />)
    act(() => { trackTransfer({ direction: 'upload', name: 'a' }) })
    expect(screen.getByRole('list')).toHaveAttribute('aria-live', 'polite')
  })
})
