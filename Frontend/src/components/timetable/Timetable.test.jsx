import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
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
})
