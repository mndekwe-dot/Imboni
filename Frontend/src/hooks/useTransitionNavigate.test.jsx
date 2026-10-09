import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, NavLink, useLocation } from 'react-router'
import { useTransitionNavigate } from './useTransitionNavigate'

function Where() { return <p data-testid="where">{useLocation().pathname}</p> }

function Harness({ to = '/next', after }) {
  const click = useTransitionNavigate()
  return (
    <>
      <NavLink to={to} onClick={click(to, after)}>go</NavLink>
      <Where />
    </>
  )
}

const mount = (props, route = '/here') =>
  render(<MemoryRouter initialEntries={[route]}><Harness {...props} /></MemoryRouter>)

describe('useTransitionNavigate', () => {
  let start
  beforeEach(() => {
    start = vi.fn(cb => { cb(); return { finished: Promise.resolve() } })
    document.startViewTransition = start
    window.matchMedia = vi.fn().mockReturnValue({ matches: false })
  })
  afterEach(() => { delete document.startViewTransition })

  it('moves between pages inside a view transition', () => {
    mount()
    fireEvent.click(screen.getByText('go'))
    expect(start).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('where')).toHaveTextContent('/next')
  })

  it('runs the caller\'s own click work (closing the mobile menu) first', () => {
    const after = vi.fn()
    mount({ after })
    fireEvent.click(screen.getByText('go'))
    expect(after).toHaveBeenCalledTimes(1)
  })

  it('still navigates where the browser has no View Transition API', () => {
    delete document.startViewTransition
    mount()
    fireEvent.click(screen.getByText('go'))
    expect(screen.getByTestId('where')).toHaveTextContent('/next')
  })

  it('does not animate for someone who asked for reduced motion, but still navigates', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true })
    mount()
    fireEvent.click(screen.getByText('go'))
    expect(start).not.toHaveBeenCalled()
    expect(screen.getByTestId('where')).toHaveTextContent('/next')
  })

  it.each([['ctrl', { ctrlKey: true }], ['meta', { metaKey: true }], ['shift', { shiftKey: true }]])(
    'leaves a %s-click alone (the browser opens it elsewhere)', (_n, mods) => {
      mount()
      fireEvent.click(screen.getByText('go'), mods)
      expect(start).not.toHaveBeenCalled()
    })

  it('does nothing for a link to the page you are already on', () => {
    mount({ to: '/here' })
    fireEvent.click(screen.getByText('go'))
    expect(start).not.toHaveBeenCalled()
  })
})
