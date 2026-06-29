import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderWithRouter, setSessionUser, screen, fireEvent, waitFor } from '../test/test-utils'
import { Account } from './Account'
import { changePassword, getProfile, updateProfile, uploadAvatar } from '../api/account'

vi.mock('../api/account', () => ({
    getProfile: vi.fn(),
    updateProfile: vi.fn(),
    changePassword: vi.fn(),
    uploadAvatar: vi.fn(),
}))

const PROFILE = {
    first_name: 'Gloriose', last_name: 'Hakizimana', phone_number: '0788000000',
    email: 'gloriose@imboni.rw', role: 'matron',
}

describe('Account', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        setSessionUser({ first_name: 'Gloriose', last_name: 'Hakizimana', role: 'matron' })
    })

    it('renders the loading state initially', () => {
        getProfile.mockReturnValue(new Promise(() => {}))
        renderWithRouter(<Account />)
        expect(screen.getByText('Loading...')).toBeInTheDocument()
    })

    it('renders the profile form once loaded', async () => {
        getProfile.mockResolvedValue(PROFILE)
        renderWithRouter(<Account />)

        await waitFor(() => expect(screen.getByDisplayValue('Gloriose Hakizimana')).toBeInTheDocument())
        expect(screen.getByDisplayValue('gloriose@imboni.rw')).toBeInTheDocument()
        expect(screen.getByDisplayValue('0788000000')).toBeInTheDocument()
        expect(screen.getByDisplayValue('matron')).toBeInTheDocument()
    })

    it('saves profile edits via Update Profile', async () => {
        getProfile.mockResolvedValue(PROFILE)
        updateProfile.mockResolvedValue({ ...PROFILE, first_name: 'Glori', phone_number: '0788111111' })
        renderWithRouter(<Account />)
        await waitFor(() => expect(screen.getByDisplayValue('Gloriose Hakizimana')).toBeInTheDocument())

        fireEvent.change(screen.getByDisplayValue('0788000000'), { target: { value: '0788111111' } })
        fireEvent.click(screen.getByRole('button', { name: /Update Profile/ }))

        await waitFor(() => expect(updateProfile).toHaveBeenCalledWith(expect.objectContaining({
            first_name: 'Gloriose', last_name: 'Hakizimana', phone_number: '0788111111',
        })))
        await waitFor(() => expect(screen.getByRole('button', { name: 'Saved' })).toBeInTheDocument())
    })

    it('shows a mismatch error and does not call the API when new passwords differ', async () => {
        getProfile.mockResolvedValue(PROFILE)
        renderWithRouter(<Account />)
        await waitFor(() => expect(screen.getByDisplayValue('Gloriose Hakizimana')).toBeInTheDocument())

        fireEvent.change(screen.getByPlaceholderText('Enter current password'), { target: { value: 'oldpass123' } })
        fireEvent.change(screen.getByPlaceholderText('Enter new password'), { target: { value: 'newpass123' } })
        fireEvent.change(screen.getByPlaceholderText('Confirm new password'), { target: { value: 'different123' } })
        fireEvent.click(screen.getByRole('button', { name: /Change Password/ }))

        expect(screen.getByText('New password do not match')).toBeInTheDocument()
        expect(changePassword).not.toHaveBeenCalled()
    })

    it('changes the password successfully and clears the form', async () => {
        getProfile.mockResolvedValue(PROFILE)
        changePassword.mockResolvedValue({})
        renderWithRouter(<Account />)
        await waitFor(() => expect(screen.getByDisplayValue('Gloriose Hakizimana')).toBeInTheDocument())

        fireEvent.change(screen.getByPlaceholderText('Enter current password'), { target: { value: 'oldpass123' } })
        fireEvent.change(screen.getByPlaceholderText('Enter new password'), { target: { value: 'newpass123' } })
        fireEvent.change(screen.getByPlaceholderText('Confirm new password'), { target: { value: 'newpass123' } })
        fireEvent.click(screen.getByRole('button', { name: /Change Password/ }))

        await waitFor(() => expect(changePassword).toHaveBeenCalledWith({
            old_password: 'oldpass123', new_password: 'newpass123', confirm_password: 'newpass123',
        }))
        await waitFor(() => expect(screen.getByRole('button', { name: 'Password Changed!' })).toBeInTheDocument())
        expect(screen.getByPlaceholderText('Enter current password').value).toBe('')
    })

    it('shows the server error message when changePassword rejects', async () => {
        getProfile.mockResolvedValue(PROFILE)
        changePassword.mockRejectedValue(new Error('Wrong current password'))
        renderWithRouter(<Account />)
        await waitFor(() => expect(screen.getByDisplayValue('Gloriose Hakizimana')).toBeInTheDocument())

        fireEvent.change(screen.getByPlaceholderText('Enter current password'), { target: { value: 'badpass' } })
        fireEvent.change(screen.getByPlaceholderText('Enter new password'), { target: { value: 'newpass123' } })
        fireEvent.change(screen.getByPlaceholderText('Confirm new password'), { target: { value: 'newpass123' } })
        fireEvent.click(screen.getByRole('button', { name: /Change Password/ }))

        await waitFor(() => expect(screen.getByText('Wrong current password')).toBeInTheDocument())
    })

    it('uploads a new avatar when a file is chosen', async () => {
        getProfile.mockResolvedValue(PROFILE)
        uploadAvatar.mockResolvedValue({ ...PROFILE, first_name: 'Gloriose' })
        renderWithRouter(<Account />)
        await waitFor(() => expect(screen.getByDisplayValue('Gloriose Hakizimana')).toBeInTheDocument())

        const file = new File(['avatar'], 'avatar.png', { type: 'image/png' })
        const fileInput = document.querySelector('input[type="file"]')
        fireEvent.change(fileInput, { target: { files: [file] } })

        await waitFor(() => expect(uploadAvatar).toHaveBeenCalledWith(file))
    })
})
