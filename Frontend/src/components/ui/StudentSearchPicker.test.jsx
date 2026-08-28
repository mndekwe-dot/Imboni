import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { StudentSearchPicker } from './StudentSearchPicker'

/**
 * The picker exists because a school of a thousand students cannot be a
 * <select>. That only holds if the typing actually reaches the server and the
 * result actually comes back — the previous version sent a query parameter the
 * endpoint did not read, so it debounced, spun, and showed the same eight names
 * whatever you typed. These pin the parts that made it look alive while inert.
 */

const STUDENTS = [
  { id: '1', name: 'Aline Mukamana',  grade: 3, section: 'A' },
  { id: '2', name: 'Bosco Niyonzima', grade: 4, section: 'B' },
  { id: '3', name: 'Chantal Uwase',   grade: 5, section: 'A' },
]

function setup(overrides = {}) {
  const fetchStudents = overrides.fetchStudents ?? vi.fn().mockResolvedValue(STUDENTS)
  const onChange = overrides.onChange ?? vi.fn()
  const utils = render(
    <StudentSearchPicker
      value={overrides.value ?? null}
      onChange={onChange}
      fetchStudents={fetchStudents}
      required
    />
  )
  return { fetchStudents, onChange, input: screen.getByRole('combobox'), ...utils }
}

async function type(input, text) {
  fireEvent.change(input, { target: { value: text } })
  await vi.advanceTimersByTimeAsync(350)
}

beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }) })
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

describe('StudentSearchPicker: the search reaches the server', () => {
  it('passes what was typed to the fetcher', async () => {
    const { fetchStudents, input } = setup()
    await type(input, 'Mukamana')
    expect(fetchStudents).toHaveBeenCalledWith('Mukamana')
  })

  it('takes its fetcher from the caller, so each portal keeps its own scope', async () => {
    const mine = vi.fn().mockResolvedValue([])
    const { input } = setup({ fetchStudents: mine })
    await type(input, 'anyone')
    expect(mine).toHaveBeenCalled()
  })

  it('does not search on one character, which would match most of the school', async () => {
    const { fetchStudents, input } = setup()
    await type(input, 'M')
    expect(fetchStudents).not.toHaveBeenCalled()
  })

  it('debounces, so a typed name is one request and not six', async () => {
    const { fetchStudents, input } = setup()
    fireEvent.change(input, { target: { value: 'Mu' } })
    fireEvent.change(input, { target: { value: 'Muk' } })
    fireEvent.change(input, { target: { value: 'Muka' } })
    await vi.advanceTimersByTimeAsync(350)
    expect(fetchStudents).toHaveBeenCalledTimes(1)
    expect(fetchStudents).toHaveBeenCalledWith('Muka')
  })

  it('trims before searching, so a trailing space is not a different query', async () => {
    const { fetchStudents, input } = setup()
    await type(input, '  Uwase  ')
    expect(fetchStudents).toHaveBeenCalledWith('Uwase')
  })
})

describe('StudentSearchPicker: results', () => {
  it('lists what came back', async () => {
    const { input } = setup()
    await type(input, 'stu')
    expect(await screen.findByText('Aline Mukamana')).toBeInTheDocument()
    expect(screen.getByText('Chantal Uwase')).toBeInTheDocument()
  })

  it('honours the limit rather than dropping a hundred rows on the page', async () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ id: String(i), name: `Student ${i}` }))
    const fetchStudents = vi.fn().mockResolvedValue(many)
    render(<StudentSearchPicker value={null} onChange={() => {}}
                                fetchStudents={fetchStudents} limit={5} required />)
    await type(screen.getByRole('combobox'), 'stu')
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(5))
  })

  it('says so when nothing matched, rather than showing an empty box', async () => {
    const { input } = setup({ fetchStudents: vi.fn().mockResolvedValue([]) })
    await type(input, 'Nobody')
    expect(await screen.findByText(/no students found/i)).toBeInTheDocument()
  })

  it('survives a failed request without breaking the field', async () => {
    const { input } = setup({ fetchStudents: vi.fn().mockRejectedValue(new Error('offline')) })
    await type(input, 'Aline')
    expect(await screen.findByText(/no students found/i)).toBeInTheDocument()
    expect(input).toBeInTheDocument()
  })

  it('hands the whole student back, not just a name', async () => {
    const { onChange, input } = setup()
    await type(input, 'Aline')
    fireEvent.click(await screen.findByText('Aline Mukamana'))
    expect(onChange).toHaveBeenCalledWith(STUDENTS[0])
  })

  it('clears the caller\'s selection once the text no longer matches it', async () => {
    const onChange = vi.fn()
    render(<StudentSearchPicker value={STUDENTS[0]} onChange={onChange}
                                fetchStudents={vi.fn().mockResolvedValue([])} required />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Alin' } })
    expect(onChange).toHaveBeenCalledWith(null)
  })

  /* Typing "mu" then "muk" fires two requests; the broader one is likelier to
     land last and would otherwise overwrite the narrower list. */
  it('ignores a stale response that arrives after a newer one', async () => {
    let resolveFirst
    const fetchStudents = vi.fn()
      .mockImplementationOnce(() => new Promise(r => { resolveFirst = r }))
      .mockResolvedValueOnce([STUDENTS[1]])

    const { input } = setup({ fetchStudents })
    fireEvent.change(input, { target: { value: 'Mu' } })
    await vi.advanceTimersByTimeAsync(350)
    fireEvent.change(input, { target: { value: 'Niyo' } })
    await vi.advanceTimersByTimeAsync(350)

    resolveFirst(STUDENTS)                       // the older, wider search lands late
    await vi.advanceTimersByTimeAsync(10)

    expect(await screen.findByText('Bosco Niyonzima')).toBeInTheDocument()
    expect(screen.queryByText('Aline Mukamana')).not.toBeInTheDocument()
  })
})

describe('StudentSearchPicker: reachable without a mouse', () => {
  it('moves through the list with the arrow keys and picks with Enter', async () => {
    const { onChange, input } = setup()
    await type(input, 'stu')
    await screen.findByText('Aline Mukamana')

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onChange).toHaveBeenCalledWith(STUDENTS[1])
  })

  it('wraps from the last option back to the first', async () => {
    const { onChange, input } = setup()
    await type(input, 'stu')
    await screen.findByText('Aline Mukamana')

    for (let i = 0; i < STUDENTS.length + 1; i++) {
      fireEvent.keyDown(input, { key: 'ArrowDown' })
    }
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith(STUDENTS[0])
  })

  it('arrows upward from the top to the bottom of the list', async () => {
    const { onChange, input } = setup()
    await type(input, 'stu')
    await screen.findByText('Aline Mukamana')

    fireEvent.keyDown(input, { key: 'ArrowUp' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith(STUDENTS[2])
  })

  it('closes on Escape without choosing anyone', async () => {
    const { onChange, input } = setup()
    await type(input, 'stu')
    await screen.findByText('Aline Mukamana')

    fireEvent.keyDown(input, { key: 'Escape' })

    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument())
    expect(onChange).not.toHaveBeenCalledWith(expect.objectContaining({ id: '1' }))
  })

  it('offers the options as options, not as unreachable divs', async () => {
    const { input } = setup()
    await type(input, 'stu')
    expect(await screen.findAllByRole('option')).toHaveLength(3)
  })

  it('points the combobox at the highlighted option for screen readers', async () => {
    const { input } = setup()
    await type(input, 'stu')
    await screen.findByText('Aline Mukamana')

    expect(input).not.toHaveAttribute('aria-activedescendant')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    await waitFor(() => expect(input).toHaveAttribute('aria-activedescendant'))
  })

  /* It used to render a label only when `required`, leaving the other case as
     an unnamed textbox. */
  it('is labelled even when it is not required', () => {
    render(<StudentSearchPicker value={null} onChange={() => {}}
                                fetchStudents={vi.fn()} label="Filter by student" />)
    expect(screen.getByLabelText('Filter by student')).toBeInTheDocument()
  })
})
