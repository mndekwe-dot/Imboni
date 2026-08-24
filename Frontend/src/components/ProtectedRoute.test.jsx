import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router'
import { ProtectedRoute } from './ProtectedRoute'
import { PlatformLayout } from '../pages/Platform/PlatformLayout'

/** Signs someone in the way a real login does: a token *and* an identity. */
function signIn(role) {
  localStorage.setItem('imboni_access', 'some-token')
  if (role) localStorage.setItem('imboni_user', JSON.stringify({ role, first_name: 'A' }))
}

/** Renders /teacher guarded for `role`, with every landing spot reachable. */
function renderAt(path, { role } = {}) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<div>Login Page</div>} />
        <Route path="/admin" element={<div>Admin Home</div>} />
        <Route path="/dos" element={<div>DOS Home</div>} />
        <Route path="/teacher" element={
          <ProtectedRoute role={role ?? 'teacher'}><div>Teacher Dashboard</div></ProtectedRoute>
        } />
        <Route path="/profile" element={
          <ProtectedRoute><div>Profile</div></ProtectedRoute>
        } />
      </Routes>
    </MemoryRouter>
  )
}

describe('ProtectedRoute', () => {
  beforeEach(() => localStorage.clear())

  it('redirects to /login when there is no access token', () => {
    renderAt('/teacher')
    expect(screen.getByText('Login Page')).toBeInTheDocument()
    expect(screen.queryByText('Teacher Dashboard')).not.toBeInTheDocument()
  })

  it('redirects when the access token is an empty string', () => {
    localStorage.setItem('imboni_access', '')
    renderAt('/teacher')
    expect(screen.getByText('Login Page')).toBeInTheDocument()
  })

  it('lets the owning role through', () => {
    signIn('teacher')
    renderAt('/teacher')
    expect(screen.getByText('Teacher Dashboard')).toBeInTheDocument()
  })

  /*
   * The bug this guard was rewritten for: an admin, signed in perfectly
   * legitimately, could open the teacher portal. The API refused the data, so
   * the screen rendered a teacher sidebar wrapped around an error message.
   */
  it('turns another role away from a portal that is not theirs', () => {
    signIn('admin')
    renderAt('/teacher')
    expect(screen.queryByText('Teacher Dashboard')).not.toBeInTheDocument()
  })

  it('sends the wrong role to its own home, not to the login page', () => {
    signIn('admin')
    renderAt('/teacher')
    expect(screen.getByText('Admin Home')).toBeInTheDocument()
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument()
  })

  it('sends each role to its own home', () => {
    signIn('dos')
    renderAt('/teacher')
    expect(screen.getByText('DOS Home')).toBeInTheDocument()
  })

  it('accepts an array of allowed roles', () => {
    signIn('dos')
    renderAt('/teacher', { role: ['teacher', 'dos'] })
    expect(screen.getByText('Teacher Dashboard')).toBeInTheDocument()
  })

  /*
   * A token with no identity beside it is a half-built session — cleared
   * storage, an interrupted login. There is no home to bounce them to.
   */
  it('sends a token with no stored user back to /login', () => {
    localStorage.setItem('imboni_access', 'some-token')
    renderAt('/teacher')
    expect(screen.getByText('Login Page')).toBeInTheDocument()
  })

  it('survives a corrupt imboni_user rather than crashing', () => {
    localStorage.setItem('imboni_access', 'some-token')
    localStorage.setItem('imboni_user', '{not json')
    expect(() => renderAt('/teacher')).not.toThrow()
    expect(screen.getByText('Login Page')).toBeInTheDocument()
  })

  it('an unknown role falls back to /login, since it has no home', () => {
    signIn('wizard')
    renderAt('/teacher')
    expect(screen.getByText('Login Page')).toBeInTheDocument()
  })

  /* /profile is deliberately shared: no role prop means any signed-in user. */
  it('lets any signed-in role onto a shared route', () => {
    signIn('parent')
    renderAt('/profile')
    expect(screen.getByText('Profile')).toBeInTheDocument()
  })

  it('still requires a token on a shared route', () => {
    renderAt('/profile')
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

  it('an admin of a school does NOT unlock the platform console', () => {
    localStorage.setItem('imboni_access', 'school-token')
    localStorage.setItem('imboni_user', JSON.stringify({ role: 'admin' }))
    renderPlatform()
    expect(screen.getByText('Platform Login Page')).toBeInTheDocument()
  })

  it('renders the console with a platform token', () => {
    localStorage.setItem('imboni_platform_access', 'op-token')
    renderPlatform()
    expect(screen.getByText('Console Body')).toBeInTheDocument()
  })
})
