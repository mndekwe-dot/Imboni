import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, screen, fireEvent, waitFor } from '../test/test-utils'
import { PortalLogin } from './PortalLogin'

const mockLogin = vi.fn()
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ login: mockLogin }),
}))

const baseProps = {
  portal: 'teacher',
  label: 'Teacher Portal',
  subtitle: 'Manage your classes',
  icon: 'person_book',
  accentColor: '#0891b2',
  placeholder: 'teacher@imboni.edu',
  redirectTo: '/teacher',
}

describe('PortalLogin', () => {
  beforeEach(() => mockLogin.mockReset())

  it('renders the portal label and subtitle', () => {
    renderWithRouter(<PortalLogin {...baseProps} />)
    expect(screen.getAllByText('Teacher Portal').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Manage your classes').length).toBeGreaterThan(0)
  })

  it('calls login with email, password, portal and redirectTo on submit', async () => {
    mockLogin.mockResolvedValueOnce(undefined)
    renderWithRouter(<PortalLogin {...baseProps} />)

    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'j.habimana@imboni.edu' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret123' } })
    fireEvent.click(screen.getByRole('button', { name: /Sign in to Teacher Portal/ }))

    await waitFor(() => expect(mockLogin).toHaveBeenCalledWith(
      'j.habimana@imboni.edu', 'secret123', 'teacher', '/teacher'
    ))
  })

  it('shows the real backend error message when login fails (not a generic message)', async () => {
    mockLogin.mockRejectedValueOnce(new Error('Invalid credentials supplied by backend'))
    renderWithRouter(<PortalLogin {...baseProps} />)

    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'wrong@imboni.edu' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'badpass' } })
    fireEvent.click(screen.getByRole('button', { name: /Sign in to Teacher Portal/ }))

    expect(await screen.findByText('Invalid credentials supplied by backend')).toBeInTheDocument()
  })

  it('toggles password visibility', () => {
    renderWithRouter(<PortalLogin {...baseProps} />)
    const pwInput = screen.getByLabelText('Password')
    expect(pwInput).toHaveAttribute('type', 'password')
    fireEvent.click(screen.getByLabelText('Toggle password visibility'))
    expect(pwInput).toHaveAttribute('type', 'text')
  })

  it('disables the submit button while logging in', async () => {
    let resolveLogin
    mockLogin.mockImplementationOnce(() => new Promise(resolve => { resolveLogin = resolve }))
    renderWithRouter(<PortalLogin {...baseProps} />)

    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'pw' } })
    fireEvent.click(screen.getByRole('button', { name: /Sign in to Teacher Portal/ }))

    expect(await screen.findByText('Signing in...')).toBeInTheDocument()
    resolveLogin()
  })

  it('opens the forgot-password modal', () => {
    renderWithRouter(<PortalLogin {...baseProps} />)
    fireEvent.click(screen.getByText('Forgot password?'))
    expect(screen.getByText('Reset Password')).toBeInTheDocument()
  })
})
