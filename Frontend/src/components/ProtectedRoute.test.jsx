import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router'
import { ProtectedRoute } from './ProtectedRoute'

function renderProtected() {
  return render(
    <MemoryRouter initialEntries={['/teacher']}>
      <Routes>
        <Route path="/login" element={<div>Login Page</div>} />
        <Route path="/teacher" element={<ProtectedRoute><div>Teacher Dashboard</div></ProtectedRoute>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('ProtectedRoute', () => {
  beforeEach(() => localStorage.clear())

  it('redirects to /login when there is no access token', () => {
    renderProtected()
    expect(screen.getByText('Login Page')).toBeInTheDocument()
    expect(screen.queryByText('Teacher Dashboard')).not.toBeInTheDocument()
  })

  it('renders the protected children when an access token is present', () => {
    localStorage.setItem('imboni_access', 'some-token')
    renderProtected()
    expect(screen.getByText('Teacher Dashboard')).toBeInTheDocument()
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument()
  })

  it('redirects when the access token is an empty string', () => {
    localStorage.setItem('imboni_access', '')
    renderProtected()
    expect(screen.getByText('Login Page')).toBeInTheDocument()
  })
})
