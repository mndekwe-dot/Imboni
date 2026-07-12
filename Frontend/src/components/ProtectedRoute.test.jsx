import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router'
import { ProtectedRoute } from './ProtectedRoute'
import { PlatformLayout } from '../pages/Platform/PlatformLayout'

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

// The operator console is a separate principal (its own token), guarded by
// PlatformLayout — a missing OR a school-only token must land on /platform/login.
function renderPlatform() {
  return render(
    <MemoryRouter initialEntries={['/platform']}>
      <Routes>
        <Route path="/platform/login" element={<div>Platform Login Page</div>} />
        <Route path="/platform" element={<PlatformLayout title="Ops"><div>Console Body</div></PlatformLayout>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('PlatformLayout guard', () => {
  beforeEach(() => localStorage.clear())

  it('redirects to /platform/login without a platform token', () => {
    renderPlatform()
    expect(screen.getByText('Platform Login Page')).toBeInTheDocument()
    expect(screen.queryByText('Console Body')).not.toBeInTheDocument()
  })

  it('a school token does NOT unlock the platform console', () => {
    localStorage.setItem('imboni_access', 'school-token')
    renderPlatform()
    expect(screen.getByText('Platform Login Page')).toBeInTheDocument()
  })

  it('renders the console with a platform token', () => {
    localStorage.setItem('imboni_platform_access', 'op-token')
    renderPlatform()
    expect(screen.getByText('Console Body')).toBeInTheDocument()
  })
})
