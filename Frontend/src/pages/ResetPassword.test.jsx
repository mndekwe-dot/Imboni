import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router'
import { ResetPassword } from './ResetPassword'
import { confirmPasswordReset } from '../api/auth'

vi.mock('../api/auth', () => ({
  confirmPasswordReset: vi.fn(),
}))

function renderResetPassword() {
  return render(
    <MemoryRouter initialEntries={['/reset-password/u123/tok456']}>
      <Routes>
        <Route path="/reset-password/:uid/:token" element={<ResetPassword />} />
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('ResetPassword (confirm step — uid/token from URL)', () => {
  beforeEach(() => {
    confirmPasswordReset.mockReset()
  })

  it('renders the set-new-password form', () => {
    renderResetPassword()
    expect(screen.getByText('Set new password')).toBeInTheDocument()
  })

  it('disables submit until password meets length, special-char, and match rules', () => {
    renderResetPassword()
    const submit = screen.getByRole('button', { name: /Reset password/ })
    expect(submit).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'short1!' } })
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'short1!' } })
    expect(submit).toBeDisabled() // too short (7 chars)

    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'longenough' } })
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'longenough' } })
    expect(submit).toBeDisabled() // no special char

    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'longenough!' } })
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'longenough!' } })
    expect(submit).not.toBeDisabled()
  })

  it('calls confirmPasswordReset with uid, token and password, then redirects to /login on success', async () => {
    confirmPasswordReset.mockResolvedValueOnce({})
    renderResetPassword()

    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'longenough!' } })
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'longenough!' } })
    fireEvent.click(screen.getByRole('button', { name: /Reset password/ }))

    await waitFor(() => expect(confirmPasswordReset).toHaveBeenCalledWith('u123', 'tok456', 'longenough!'))
    expect(await screen.findByText('Login Page')).toBeInTheDocument()
  })

  it('shows the real backend error message when the reset fails', async () => {
    confirmPasswordReset.mockRejectedValueOnce(new Error('Reset link has expired'))
    renderResetPassword()

    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'longenough!' } })
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'longenough!' } })
    fireEvent.click(screen.getByRole('button', { name: /Reset password/ }))

    expect(await screen.findByText('Reset link has expired')).toBeInTheDocument()
  })
})
