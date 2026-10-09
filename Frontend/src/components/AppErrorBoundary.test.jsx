import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AppErrorBoundary } from './AppErrorBoundary'

const report = vi.fn()
vi.mock('../utils/sentry', () => ({ reportError: (...a) => report(...a) }))

let explode = true
function Bomb() {
  if (explode) throw new Error('render failed')
  return <p>all good</p>
}

describe('AppErrorBoundary', () => {
  let spy
  beforeEach(() => {
    explode = true
    report.mockReset()
    // React logs a caught render error to the console by design.
    spy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => spy.mockRestore())

  it('renders its children when nothing is wrong', () => {
    explode = false
    render(<AppErrorBoundary><Bomb /></AppErrorBoundary>)
    expect(screen.getByText('all good')).toBeInTheDocument()
  })

  it('shows the recovery screen instead of a blank page when a render throws', () => {
    render(<AppErrorBoundary><Bomb /></AppErrorBoundary>)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })

  it('reports the error, with where in the tree it happened', () => {
    render(<AppErrorBoundary><Bomb /></AppErrorBoundary>)
    expect(report).toHaveBeenCalledTimes(1)
    expect(report.mock.calls[0][0]).toBeInstanceOf(Error)
    expect(report.mock.calls[0][1]).toHaveProperty('componentStack')
  })

  it('"try again" renders the children again, so a transient error recovers', () => {
    render(<AppErrorBoundary><Bomb /></AppErrorBoundary>)
    explode = false
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(screen.getByText('all good')).toBeInTheDocument()
  })
})
