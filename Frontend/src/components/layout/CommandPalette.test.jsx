import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router'
import { CommandPalette } from './CommandPalette'

const ITEMS = [
  { to: '/admin', icon: 'dashboard', label: 'Dashboard' },
  { to: '/admin/students', icon: 'groups', label: 'Students' },
  { to: '/admin/staff', icon: 'badge', label: 'Staff' },
  { action: 'logout', icon: 'logout', label: 'Logout' },
]

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>
}

function setup() {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <CommandPalette items={ITEMS} />
      <Routes><Route path="*" element={<Where />} /></Routes>
    </MemoryRouter>,
  )
}

const open = () => fireEvent.keyDown(document, { key: 'k', ctrlKey: true })

describe('CommandPalette', () => {
  it('is closed until Ctrl+K', () => {
    setup()
    expect(screen.queryByRole('dialog')).toBeNull()
    open()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('also opens from the header button event', () => {
    setup()
    fireEvent(document, new CustomEvent('imboni:open-palette'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('lists pages but not actions such as logout', () => {
    setup()
    open()
    expect(screen.getAllByRole('option').map(o => o.lastElementChild.textContent)).toEqual(['Dashboard', 'Students', 'Staff'])
  })

  it('narrows as you type, matching letters in order', () => {
    setup()
    open()
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'sdt' } })
    expect(screen.getAllByRole('option').map(o => o.lastElementChild.textContent)).toEqual(['Students'])
  })

  it('says so when nothing matches', () => {
    setup()
    open()
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'zzz' } })
    expect(screen.getByText('No page matches that.')).toBeInTheDocument()
  })

  it('opens the highlighted page with the arrow keys and Enter, then closes', () => {
    setup()
    open()
    const input = screen.getByRole('combobox')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.getByTestId('where')).toHaveTextContent('/admin/students')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('closes on Escape without navigating', () => {
    setup()
    open()
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByTestId('where')).toHaveTextContent('/admin')
  })
})
