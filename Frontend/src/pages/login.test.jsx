import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, screen, fireEvent, waitFor } from '../test/test-utils'
import { LogIn } from './login'

// /login is a real, functional login now: it calls useAuth().login and lets
// useAuth redirect by role. We mock useAuth so no router navigation/network runs.
const mockLogin = vi.fn()
const mockCompleteTwoFactor = vi.fn()
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ login: mockLogin, completeTwoFactor: mockCompleteTwoFactor }),
}))

describe('LogIn (/login)', () => {
  beforeEach(() => { mockLogin.mockReset(); mockCompleteTwoFactor.mockReset() })

  it('renders the welcome heading and the sign-in form', () => {
    renderWithRouter(<LogIn />)
    expect(screen.getByText('Welcome back')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
  })

  it('renders a role pill for every supported portal', () => {
    renderWithRouter(<LogIn />)
    expect(screen.getByText('Student')).toBeInTheDocument()
    expect(screen.getByText('Teacher')).toBeInTheDocument()
    expect(screen.getByText('Parent')).toBeInTheDocument()
  })

  it('calls login with the entered email and password on submit', async () => {
    mockLogin.mockResolvedValueOnce({ requires2fa: false })
    renderWithRouter(<LogIn />)

    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'admin@school1.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => expect(mockLogin).toHaveBeenCalledWith('admin@school1.com', 'secret123'))
  })

  it('shows the real backend error message when login fails (no silent failure)', async () => {
    mockLogin.mockRejectedValueOnce(new Error('Invalid email or password'))
    renderWithRouter(<LogIn />)

    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'wrong@school1.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'badpass' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('Invalid email or password')).toBeInTheDocument()
  })

  it('toggles password visibility', () => {
    renderWithRouter(<LogIn />)
    const pw = screen.getByLabelText('Password')
    expect(pw).toHaveAttribute('type', 'password')
    fireEvent.click(screen.getByLabelText('Toggle password visibility'))
    expect(pw).toHaveAttribute('type', 'text')
  })

  it('opens and closes the forgot-password modal', () => {
    renderWithRouter(<LogIn />)
    fireEvent.click(screen.getByText('Forgot password?'))
    expect(screen.getByText('Reset Password')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Got it'))
    expect(screen.queryByText('Reset Password')).not.toBeInTheDocument()
  })
})
