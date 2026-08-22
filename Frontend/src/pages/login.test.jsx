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

  /* The role pills this used to assert lived in a branding column beside the
     form. The page is one centred card now and the column is gone, pills and
     all - they named the portals without linking to any of them, and this
     page does not need the user to pick one: useAuth redirects by role. What
     the card must still carry is the two ways out for someone who landed
     here wrong, and they belong above the form, not under it. */
  it('offers a language switcher above the form', () => {
    renderWithRouter(<LogIn />)
    const card = document.querySelector('.login-card')
    const lang = card.querySelector('.login-lang')
    const form = card.querySelector('.login-form')
    expect(lang).toBeInTheDocument()
    // compareDocumentPosition: FOLLOWING means the form comes after the switcher.
    expect(lang.compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('renders as a single centred card, not the old two-panel split', () => {
    renderWithRouter(<LogIn />)
    expect(document.querySelector('.login-card')).toBeInTheDocument()
    expect(document.querySelector('.login-left')).toBeNull()
    expect(document.querySelector('.login-right')).toBeNull()
  })

  it('offers no self-signup or social sign-in', () => {
    /* Portal accounts are issued by the school. The reference design this was
       built from had Google, GitHub and a Sign up link; none of them can work
       here, and a button that cannot work is worse than no button. */
    renderWithRouter(<LogIn />)
    expect(screen.queryByText(/sign up/i)).toBeNull()
    expect(screen.queryByText(/google/i)).toBeNull()
    expect(screen.queryByText(/github/i)).toBeNull()
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
