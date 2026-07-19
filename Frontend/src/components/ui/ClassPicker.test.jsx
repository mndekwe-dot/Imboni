import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ClassPicker } from './ClassPicker'

const sections = [
  { name: 'O-Level', years: [{ name: 'S1', streams: ['A', 'B'] }, { name: 'S2', streams: ['A'] }] },
  { name: 'A-Level', years: [{ name: 'S5', streams: ['Sci'] }] },
]

describe('ClassPicker: dropdown variant (default)', () => {
  it('renders section/year/class selects with "All" defaults', () => {
    render(
      <ClassPicker
        sections={sections}
        section="" onSectionChange={() => {}}
        year="" onYearChange={() => {}}
        classVal="" onClassChange={() => {}}
      />
    )
    expect(screen.getByText('All Sections')).toBeInTheDocument()
    expect(screen.getByText('All Years')).toBeInTheDocument()
    expect(screen.getAllByText('All Classes').length).toBeGreaterThan(0)
  })

  it('resets year and class when section changes', () => {
    const onSectionChange = vi.fn()
    const onYearChange = vi.fn()
    const onClassChange = vi.fn()
    render(
      <ClassPicker
        sections={sections}
        section="" onSectionChange={onSectionChange}
        year="" onYearChange={onYearChange}
        classVal="" onClassChange={onClassChange}
      />
    )
    const [sectionSelect] = screen.getAllByRole('combobox')
    fireEvent.change(sectionSelect, { target: { value: 'O-Level' } })
    expect(onSectionChange).toHaveBeenCalledWith('O-Level')
    expect(onYearChange).toHaveBeenCalledWith('')
    expect(onClassChange).toHaveBeenCalledWith('')
  })

  it('resets class when year changes', () => {
    const onYearChange = vi.fn()
    const onClassChange = vi.fn()
    render(
      <ClassPicker
        sections={sections}
        section="O-Level" onSectionChange={() => {}}
        year="" onYearChange={onYearChange}
        classVal="" onClassChange={onClassChange}
      />
    )
    const [, yearSelect] = screen.getAllByRole('combobox')
    fireEvent.change(yearSelect, { target: { value: 'S1' } })
    expect(onYearChange).toHaveBeenCalledWith('S1')
    expect(onClassChange).toHaveBeenCalledWith('')
  })

  it('shows the current selection summary', () => {
    render(
      <ClassPicker
        sections={sections}
        section="O-Level" onSectionChange={() => {}}
        year="S1" onYearChange={() => {}}
        classVal="A" onClassChange={() => {}}
      />
    )
    expect(screen.getByText('O-Level · S1 · A')).toBeInTheDocument()
  })
})

describe('ClassPicker: chips variant', () => {
  it('renders an "All" chip plus a chip per derived class', () => {
    render(<ClassPicker sections={sections} variant="chips" value="" onChange={() => {}} />)
    expect(screen.getByText('All')).toBeInTheDocument()
    expect(screen.getByText('S1A')).toBeInTheDocument()
    expect(screen.getByText('S1B')).toBeInTheDocument()
    expect(screen.getByText('S5Sci')).toBeInTheDocument()
  })

  it('toggles a chip off when clicking the already-active one', () => {
    const onChange = vi.fn()
    render(<ClassPicker sections={sections} variant="chips" value="S1A" onChange={onChange} />)
    fireEvent.click(screen.getByText('S1A'))
    expect(onChange).toHaveBeenCalledWith('')
  })

  it('selects a chip when clicking an inactive one', () => {
    const onChange = vi.fn()
    render(<ClassPicker sections={sections} variant="chips" value="" onChange={onChange} />)
    fireEvent.click(screen.getByText('S1B'))
    expect(onChange).toHaveBeenCalledWith('S1B')
  })

  it('uses the explicit classes prop instead of deriving from sections when provided', () => {
    render(<ClassPicker variant="chips" classes={['X1', 'X2']} value="" onChange={() => {}} />)
    expect(screen.getByText('X1')).toBeInTheDocument()
    expect(screen.getByText('X2')).toBeInTheDocument()
    expect(screen.queryByText('S1A')).not.toBeInTheDocument()
  })
})
