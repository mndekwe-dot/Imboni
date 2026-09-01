import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, screen, fireEvent, waitFor } from '../test/test-utils'
import { AcceptInvite } from './AcceptInvite'
import { acceptInvitation, checkInvitation } from '../api/auth'

vi.mock('../api/auth', () => ({
    checkInvitation: vi.fn(),
    acceptInvitation: vi.fn(),
}))

const VALID = {
    valid: true,
    email: 'head@greenvalley.rw',
    school_name: 'Green Valley',
    expires_at: '2026-09-06T10:00:00Z',
}

const at = (token) => ({ route: `/accept-invite?token=${token}` })

describe('AcceptInvite', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        checkInvitation.mockResolvedValue(VALID)
    })

    it('names the school and the account the password is for', async () => {
        renderWithRouter(<AcceptInvite />, at('good-token'))

        expect(await screen.findByText(/Set up Green Valley on Imboni/i)).toBeInTheDocument()
        expect(screen.getByText(/head@greenvalley\.rw/)).toBeInTheDocument()
    })

    it('checks the link before drawing a form that could not succeed', async () => {
        checkInvitation.mockRejectedValue(new Error('This invitation has expired.'))
        renderWithRouter(<AcceptInvite />, at('stale-token'))

        expect(await screen.findByText(/This link no longer works/i)).toBeInTheDocument()
        expect(screen.getByText(/This invitation has expired/i)).toBeInTheDocument()
        expect(screen.queryByLabelText(/Choose a password/i)).not.toBeInTheDocument()
    })

    it('will not submit until the password is long enough, special and matching', async () => {
        renderWithRouter(<AcceptInvite />, at('good-token'))
        await screen.findByLabelText(/Choose a password/i)

        const submit = screen.getByRole('button', { name: /Set password and continue/i })
        expect(submit).toBeDisabled()

        // Long enough, but no special character.
        fireEvent.change(screen.getByLabelText(/Choose a password/i), { target: { value: 'longenough' } })
        fireEvent.change(screen.getByLabelText(/Confirm password/i), { target: { value: 'longenough' } })
        expect(submit).toBeDisabled()

        // Special character, but the two do not match.
        fireEvent.change(screen.getByLabelText(/Choose a password/i), { target: { value: 'longenough!' } })
        expect(submit).toBeDisabled()

        fireEvent.change(screen.getByLabelText(/Confirm password/i), { target: { value: 'longenough!' } })
        expect(submit).toBeEnabled()

        expect(acceptInvitation).not.toHaveBeenCalled()
    })

    it('sends the token with the chosen password', async () => {
        acceptInvitation.mockResolvedValue({ email: VALID.email })
        renderWithRouter(<AcceptInvite />, at('good-token'))
        await screen.findByLabelText(/Choose a password/i)

        fireEvent.change(screen.getByLabelText(/Choose a password/i), { target: { value: 'a-good-one!' } })
        fireEvent.change(screen.getByLabelText(/Confirm password/i), { target: { value: 'a-good-one!' } })
        fireEvent.click(screen.getByRole('button', { name: /Set password and continue/i }))

        await waitFor(() =>
            expect(acceptInvitation).toHaveBeenCalledWith('good-token', 'a-good-one!'))
    })

    it('says so when the server refuses the password', async () => {
        acceptInvitation.mockRejectedValue(new Error('This password is too common.'))
        renderWithRouter(<AcceptInvite />, at('good-token'))
        await screen.findByLabelText(/Choose a password/i)

        fireEvent.change(screen.getByLabelText(/Choose a password/i), { target: { value: 'password123!' } })
        fireEvent.change(screen.getByLabelText(/Confirm password/i), { target: { value: 'password123!' } })
        fireEvent.click(screen.getByRole('button', { name: /Set password and continue/i }))

        expect(await screen.findByText(/too common/i)).toBeInTheDocument()
    })

    it('treats a missing token as an invalid link, without asking the server for nothing', async () => {
        checkInvitation.mockRejectedValue(new Error('This invitation link is not valid.'))
        renderWithRouter(<AcceptInvite />, { route: '/accept-invite' })

        expect(await screen.findByText(/This link no longer works/i)).toBeInTheDocument()
        expect(checkInvitation).toHaveBeenCalledWith('')
    })
})
