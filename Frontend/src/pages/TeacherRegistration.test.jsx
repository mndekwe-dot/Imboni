import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router'
import { TeacherRegistration } from './TeacherRegistration'
import { verifyInvitation, completeRegistration } from '../api/auth'

vi.mock('../api/auth', () => ({
  verifyInvitation: vi.fn(),
  completeRegistration: vi.fn(),
}))

// useParams() only resolves real values when rendered under a matching <Route>,
// so this page can't use the shared renderWithRouter helper.
function renderAtInvite(uidToken = '/register/teacher/u1/t1') {
  return render(
    <MemoryRouter initialEntries={[uidToken]}>
      <Routes>
        <Route path="/register/teacher/:uid/:token" element={<TeacherRegistration />} />
        <Route path="/login/teacher" element={<div>Teacher Login Page</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('TeacherRegistration', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows a verifying message before the invite link resolves', () => {
    verifyInvitation.mockReturnValue(new Promise(() => {}))
    renderAtInvite()
    expect(screen.getByText('Verifying your link...')).toBeInTheDocument()
  })

  it('shows an invalid-link message when verification fails', async () => {
    verifyInvitation.mockRejectedValue(new Error('not found'))
    renderAtInvite()
    await waitFor(() => expect(screen.getByText('Link Invalid')).toBeInTheDocument())
    expect(screen.getByText(/invitation link is invalid/)).toBeInTheDocument()
  })

  it('pre-fills read-only invite details once verified', async () => {
    verifyInvitation.mockResolvedValue({ data: { first_name: 'Jean', last_name: 'Habimana', email: 'jean@imboni.test' } })
    renderAtInvite()
    await waitFor(() => expect(screen.getByDisplayValue('Jean')).toBeInTheDocument())
    expect(screen.getByDisplayValue('Habimana')).toBeInTheDocument()
    expect(screen.getByDisplayValue('jean@imboni.test')).toBeInTheDocument()
  })

  it('rejects mismatched passwords without calling the API', async () => {
    verifyInvitation.mockResolvedValue({ data: { first_name: 'Jean', last_name: 'Habimana', email: 'jean@imboni.test' } })
    renderAtInvite()
    await waitFor(() => expect(screen.getByDisplayValue('Jean')).toBeInTheDocument())

    fireEvent.change(screen.getByPlaceholderText('e.g. j.habimana'), { target: { value: 'j.habimana' } })
    fireEvent.change(screen.getByPlaceholderText('Choose a strong password'), { target: { value: 'password123' } })
    fireEvent.change(screen.getByPlaceholderText('Repeat your password'), { target: { value: 'password124' } })
    fireEvent.click(screen.getByRole('button', { name: 'Complete Registration' }))

    expect(screen.getByText('Passwords do not match')).toBeInTheDocument()
    expect(completeRegistration).not.toHaveBeenCalled()
  })

  it('rejects a password shorter than 8 characters', async () => {
    verifyInvitation.mockResolvedValue({ data: { first_name: 'Jean', last_name: 'Habimana', email: 'jean@imboni.test' } })
    renderAtInvite()
    await waitFor(() => expect(screen.getByDisplayValue('Jean')).toBeInTheDocument())

    fireEvent.change(screen.getByPlaceholderText('e.g. j.habimana'), { target: { value: 'j.habimana' } })
    fireEvent.change(screen.getByPlaceholderText('Choose a strong password'), { target: { value: 'short' } })
    fireEvent.change(screen.getByPlaceholderText('Repeat your password'), { target: { value: 'short' } })
    fireEvent.click(screen.getByRole('button', { name: 'Complete Registration' }))

    expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument()
    expect(completeRegistration).not.toHaveBeenCalled()
  })

  it('completes registration and shows the success screen', async () => {
    verifyInvitation.mockResolvedValue({ data: { first_name: 'Jean', last_name: 'Habimana', email: 'jean@imboni.test' } })
    completeRegistration.mockResolvedValue({})
    renderAtInvite()
    await waitFor(() => expect(screen.getByDisplayValue('Jean')).toBeInTheDocument())

    fireEvent.change(screen.getByPlaceholderText('e.g. j.habimana'), { target: { value: 'j.habimana' } })
    fireEvent.change(screen.getByPlaceholderText('Choose a strong password'), { target: { value: 'password123' } })
    fireEvent.change(screen.getByPlaceholderText('Repeat your password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Complete Registration' }))

    await waitFor(() => expect(completeRegistration).toHaveBeenCalledWith({
      uid: 'u1', token: 't1', username: 'j.habimana', password: 'password123', password2: 'password123',
    }))
    expect(await screen.findByText('Account Created!')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Go to Teacher Login' }))
    expect(screen.getByText('Teacher Login Page')).toBeInTheDocument()
  })

  it('shows the real backend error message when registration fails', async () => {
    verifyInvitation.mockResolvedValue({ data: { first_name: 'Jean', last_name: 'Habimana', email: 'jean@imboni.test' } })
    completeRegistration.mockRejectedValue({ response: { data: { username: ['This username is already taken.'] } } })
    renderAtInvite()
    await waitFor(() => expect(screen.getByDisplayValue('Jean')).toBeInTheDocument())

    fireEvent.change(screen.getByPlaceholderText('e.g. j.habimana'), { target: { value: 'taken' } })
    fireEvent.change(screen.getByPlaceholderText('Choose a strong password'), { target: { value: 'password123' } })
    fireEvent.change(screen.getByPlaceholderText('Repeat your password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Complete Registration' }))

    expect(await screen.findByText('This username is already taken.')).toBeInTheDocument()
  })
})
