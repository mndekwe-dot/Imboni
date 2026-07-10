import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LogIn } from './login'

// login.jsx is a static page — the form has no onChange handlers and submit
// just calls preventDefault(). There is no useAuth/login() wiring here at all
// (that logic lives in PortalLogin.jsx instead). We test it as it actually behaves.
describe('LogIn (static /login page)', () => {
  it('renders the welcome heading and the sign-in form', () => {
    render(<LogIn />)
    expect(screen.getByText('Welcome back')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
  })

  it('renders a role pill for every supported portal', () => {
    render(<LogIn />)
    expect(screen.getByText('Student')).toBeInTheDocument()
    expect(screen.getByText('Teacher')).toBeInTheDocument()
    expect(screen.getByText('Parent')).toBeInTheDocument()
  })

  it('does not throw or navigate away when the form is submitted', () => {
    render(<LogIn />)
    const submit = vi.fn(e => e.preventDefault())
    const form = document.querySelector('.login-form')
    form.onsubmit = submit
    fireEvent.submit(form)
    // Just verifying the static page doesn't crash on submit.
    expect(screen.getByText('Welcome back')).toBeInTheDocument()
  })

  it('opens the forgot-password modal', () => {
    render(<LogIn />)
    fireEvent.click(screen.getByText('Forgot password?'))
    expect(screen.getByText('Reset Password')).toBeInTheDocument()
  })

  it('closes the forgot-password modal', () => {
    render(<LogIn />)
    fireEvent.click(screen.getByText('Forgot password?'))
    fireEvent.click(screen.getByText('Got it'))
    expect(screen.queryByText('Reset Password')).not.toBeInTheDocument()
  })
})
