import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, within, act } from '@testing-library/react'
import { Timetable } from './Timetable'

describe('Timetable', () => {
  afterEach(() => vi.useRealTimers())

  it('renders the extracurricular table by default with one row per slot', () => {
    render(<Timetable />)
    // 7 EXTRA_SLOTS rows
    expect(screen.getByText('Morning')).toBeInTheDocument()
    expect(screen.getByText('Lights Out')).toBeInTheDocument()
    const rows = screen.getAllByRole('row')
    // 1 header row + 7 slot rows
    expect(rows).toHaveLength(8)
  })

  it('renders the academic table with Mon-Sat columns only (no Sunday) for a known class', () => {
    render(<Timetable type="academic" classId="S1A" />)
    const headerRow = screen.getAllByRole('row')[0]
    expect(within(headerRow).getByText('Mon')).toBeInTheDocument()
    expect(within(headerRow).queryByText('Sun')).not.toBeInTheDocument()
    expect(within(headerRow).getAllByRole('columnheader')).toHaveLength(7) // Period + Mon..Sat
  })

  it('shows a not-found message for an unknown classId', () => {
    render(<Timetable type="academic" classId="UNKNOWN" />)
    expect(screen.getByText('No timetable found for UNKNOWN.')).toBeInTheDocument()
  })

  it('shows the legend for extracurricular but not for academic', () => {
    const { rerender } = render(<Timetable type="extracurricular" />)
    expect(screen.getByText('Sports')).toBeInTheDocument()

    rerender(<Timetable type="academic" classId="S1A" />)
    expect(screen.queryByText('Sports')).not.toBeInTheDocument()
  })

  it('clicking a cell edit button calls onEditCell with slot/day/cell context', () => {
    const onEditCell = vi.fn()
    render(<Timetable editable onEditCell={onEditCell} />)
    const editButtons = screen.getAllByRole('button').filter(b => b.className.includes('tt-cell-edit-btn'))
    fireEvent.click(editButtons[0])
    expect(onEditCell).toHaveBeenCalledWith(expect.objectContaining({ slot: expect.any(Object), day: expect.any(String) }))
  })

  it('switching the day tab updates the data-day attribute on the table', () => {
    // The grid opens on today; pin today to a Monday so the start is known.
    vi.setSystemTime(new Date('2026-04-13T08:00:00Z'))
    render(<Timetable />)
    const table = document.querySelector('.tt-table')
    expect(table).toHaveAttribute('data-day', '0')
    fireEvent.click(screen.getByRole('button', { name: 'Wed' }))
    expect(table).toHaveAttribute('data-day', '2')
  })

  it('collapses the break into one band instead of repeating it per day column', () => {
    render(<Timetable type="academic" classId="S1A" />)
    // One <td colspan> across the day columns, not six identical cells.
    const band = document.querySelectorAll('.tt-break-band .tt-break')
    expect(band).toHaveLength(1)
    expect(band[0]).toHaveAttribute('colspan', '6')
  })

  it('gives each subject its own colour band, and the same subject the same one', () => {
    render(<Timetable type="academic" classId="S1A" />)
    const toneOf = (el) => [...el.closest('td').classList].find(c => c.startsWith('tt-tone-'))
    const maths = [...document.querySelectorAll('.tt-subject')].filter(e => e.textContent === 'Mathematics')
    const others = [...document.querySelectorAll('.tt-subject')].filter(e => e.textContent === 'English')
    expect(maths.length).toBeGreaterThan(1)
    expect(new Set(maths.map(toneOf)).size).toBe(1)          // consistent within a subject
    expect(toneOf(maths[0])).not.toBe(toneOf(others[0]))     // distinct between subjects
  })

  it('hides the home room in cells and states it once above the grid', () => {
    render(<Timetable type="academic" classId="S1A" />)
    expect(screen.getByText(/Home room/)).toBeInTheDocument()
    const rooms = [...document.querySelectorAll('.tt-cell-meta .tt-room')].map(e => e.textContent)
    expect(rooms.length).toBeGreaterThan(0)          // exceptions still show
    expect(rooms).not.toContain('Room 12')           // the home room does not
  })

  it('uses controlled currentMonday/onWeekChange when provided instead of internal state', () => {
    const onWeekChange = vi.fn()
    const monday = new Date('2026-04-13T00:00:00')
    render(<Timetable currentMonday={monday} onWeekChange={onWeekChange} />)
    fireEvent.click(screen.getByTitle('Next week'))
    expect(onWeekChange).toHaveBeenCalled()
  })

  /* ── Views, weekends, calendar and shortcuts ─────────────────────────── */

  const headers = () => within(screen.getAllByRole('row')[0]).getAllByRole('columnheader')
  const openViewMenu = () => fireEvent.click(screen.getByRole('button', { name: /Change view/ }))
  const pickView = name => { openViewMenu(); fireEvent.click(screen.getByRole('menuitemradio', { name: new RegExp(name) })) }

  describe('views', () => {
    beforeEach(() => vi.setSystemTime(new Date('2026-04-15T08:00:00Z')))   // Wed, Kigali

    it('opens in Week view with the week on screen', () => {
      render(<Timetable type="academic" classId="S1A" />)
      expect(screen.getByRole('button', { name: /Change view: Week/ })).toBeInTheDocument()
      expect(headers()).toHaveLength(7)
    })

    it('Day view shows one day column, and it is today', () => {
      render(<Timetable type="academic" classId="S1A" />)
      pickView('Day')
      expect(headers()).toHaveLength(2)                       // Period + the day
      expect(headers()[1]).toHaveTextContent('Wed')
      expect(screen.getByTitle('Next day')).toBeInTheDocument()
      expect(document.querySelector('.tt-break-band .tt-break')).toHaveAttribute('colspan', '1')
    })

    it('Schedule view lists the week day by day instead of drawing a grid', () => {
      render(<Timetable type="academic" classId="S1A" />)
      pickView('Schedule')
      expect(document.querySelector('.tt-table')).toBeNull()
      expect(document.querySelectorAll('.tt-agenda-day')).toHaveLength(6)   // Mon–Sat
      expect(screen.getAllByText('Mathematics').length).toBeGreaterThan(0)
      // Today is labelled in the list as well as highlighted.
      expect(document.querySelector('.tt-agenda-day.is-today')).toHaveTextContent('Wednesday')
    })

    it('Show weekends off drops Saturday from the grid and the break band', () => {
      render(<Timetable type="academic" classId="S1A" />)
      openViewMenu()
      fireEvent.click(screen.getByRole('menuitemcheckbox', { name: /Show weekends/ }))
      expect(within(screen.getAllByRole('row')[0]).queryByText('Sat')).not.toBeInTheDocument()
      expect(headers()).toHaveLength(6)                       // Period + Mon–Fri
      expect(document.querySelector('.tt-break-band .tt-break')).toHaveAttribute('colspan', '5')
    })

    it('remembers the chosen view the next time a timetable opens', () => {
      const { unmount } = render(<Timetable type="academic" classId="S1A" />)
      pickView('Day')
      unmount()
      render(<Timetable type="academic" classId="S1A" />)
      expect(screen.getByRole('button', { name: /Change view: Day/ })).toBeInTheDocument()
    })

    it('Escape closes the view menu and puts focus back on its button', () => {
      render(<Timetable type="academic" classId="S1A" />)
      openViewMenu()
      expect(screen.getByRole('menu')).toBeInTheDocument()
      fireEvent.keyDown(document, { key: 'Escape' })
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Change view/ })).toHaveFocus()
    })
  })

  describe('moving through time', () => {
    it('in Day view, Next from Saturday lands on Monday of the next week', () => {
      vi.setSystemTime(new Date('2026-04-18T08:00:00Z'))    // Saturday
      localStorage.setItem('imboni_tt_view', JSON.stringify('day'))
      const onWeekChange = vi.fn()
      render(<Timetable type="academic" classId="S1A"
        currentMonday={new Date(2026, 3, 13)} onWeekChange={onWeekChange} />)
      expect(headers()[1]).toHaveTextContent('Sat')
      fireEvent.click(screen.getByTitle('Next day'))
      const monday = onWeekChange.mock.calls[0][0]
      expect([monday.getFullYear(), monday.getMonth(), monday.getDate()]).toEqual([2026, 3, 20])
    })

    it('Today is disabled on the current week and brings you back from another', () => {
      vi.setSystemTime(new Date('2026-04-15T08:00:00Z'))
      render(<Timetable type="academic" classId="S1A" />)
      const today = screen.getByRole('button', { name: 'Today' })
      expect(today).toBeDisabled()
      fireEvent.click(screen.getByTitle('Next week'))
      expect(today).toBeEnabled()
      fireEvent.click(today)
      expect(today).toBeDisabled()
    })

    it('picking a date in the month calendar jumps to that week and closes it', () => {
      vi.setSystemTime(new Date('2026-04-15T08:00:00Z'))
      const onWeekChange = vi.fn()
      render(<Timetable type="academic" classId="S1A"
        currentMonday={new Date(2026, 3, 13)} onWeekChange={onWeekChange} />)
      fireEvent.click(screen.getByRole('button', { name: /Choose a date/ }))
      const dialog = screen.getByRole('dialog', { name: 'Choose a date' })
      fireEvent.click(within(dialog).getByRole('button', { name: 'April 29, 2026' }))
      const monday = onWeekChange.mock.calls[0][0]
      expect([monday.getMonth(), monday.getDate()]).toEqual([3, 27])
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('arrow keys move through the calendar a day and a week at a time', () => {
      vi.setSystemTime(new Date('2026-04-15T08:00:00Z'))
      render(<Timetable type="academic" classId="S1A" />)
      fireEvent.click(screen.getByRole('button', { name: /Choose a date/ }))
      const grid = screen.getByRole('grid')
      expect(within(grid).getByRole('button', { name: 'April 15, 2026' })).toHaveFocus()
      fireEvent.keyDown(grid, { key: 'ArrowRight' })
      expect(within(grid).getByRole('button', { name: 'April 16, 2026' })).toHaveFocus()
      fireEvent.keyDown(grid, { key: 'ArrowDown' })
      expect(within(grid).getByRole('button', { name: 'April 23, 2026' })).toHaveFocus()
    })
  })

  describe('keyboard shortcuts', () => {
    beforeEach(() => vi.setSystemTime(new Date('2026-04-15T08:00:00Z')))

    const press = (key, opts = {}) => act(() => { fireEvent.keyDown(document.body, { key, ...opts }) })

    it('D, A and W switch between Day, Schedule and Week', () => {
      render(<Timetable type="academic" classId="S1A" />)
      press('d')
      expect(headers()).toHaveLength(2)
      press('a')
      expect(document.querySelector('.tt-agenda')).not.toBeNull()
      press('w')
      expect(headers()).toHaveLength(7)
    })

    it('N and P move the week, T comes back', () => {
      render(<Timetable type="academic" classId="S1A" />)
      const today = screen.getByRole('button', { name: 'Today' })
      press('n')
      expect(today).toBeEnabled()
      press('t')
      expect(today).toBeDisabled()
      press('p')
      expect(today).toBeEnabled()
    })

    it('does nothing while typing in a field or with a modifier held', () => {
      render(<><input aria-label="search" /><Timetable type="academic" classId="S1A" /></>)
      fireEvent.keyDown(screen.getByLabelText('search'), { key: 'd' })
      press('d', { ctrlKey: true })
      expect(headers()).toHaveLength(7)
    })

    it('does nothing while a dialog is open over the timetable', () => {
      render(<><dialog open><button>Save</button></dialog><Timetable type="academic" classId="S1A" /></>)
      press('d')
      expect(headers()).toHaveLength(7)
    })

    it('can be switched off per instance', () => {
      render(<Timetable type="academic" classId="S1A" shortcuts={false} />)
      press('d')
      expect(headers()).toHaveLength(7)
    })
  })
})
