// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { Signup } from './Signup'

function renderSignup() {
    return render(
        <MemoryRouter>
            <Signup />
        </MemoryRouter>
    )
}

// Fill every required field with valid values so local validation passes and
// the component actually hits fetch.
function fillValidForm() {
    fireEvent.change(screen.getByPlaceholderText('e.g. Green Hills Academy'), { target: { value: 'Green Hills Academy' } })
    fireEvent.change(screen.getByPlaceholderText('greenhills'), { target: { value: 'greenhills' } })
    fireEvent.change(screen.getByPlaceholderText('Jane'), { target: { value: 'Jane' } })
    fireEvent.change(screen.getByPlaceholderText('Doe'), { target: { value: 'Doe' } })
    fireEvent.change(screen.getByPlaceholderText('jane@greenhills.edu'), { target: { value: 'jane@greenhills.edu' } })
    fireEvent.change(screen.getByPlaceholderText('Choose a strong password'), { target: { value: 'supersecret' } })
}

beforeEach(() => {
    vi.restoreAllMocks()
})

afterEach(() => {
    cleanup()
})

describe('Signup page', () => {
    it('posts to the onboarding endpoint and shows the confirmation on success', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                school_name: 'Green Hills Academy',
                subdomain: 'greenhills',
                url: 'http://greenhills.localhost/',
                admin_email: 'jane@greenhills.edu',
                message: 'School created. You can now sign in.',
            }),
        })
        vi.stubGlobal('fetch', fetchMock)

        renderSignup()
        fillValidForm()
        fireEvent.click(screen.getByRole('button', { name: /create school/i }))

        // Confirmation renders.
        await waitFor(() => expect(screen.getByText(/is ready!/i)).toBeTruthy())
        expect(screen.getByText('http://greenhills.localhost/')).toBeTruthy()
        expect(screen.getByText('jane@greenhills.edu')).toBeTruthy()

        // Called with a relative URL, JSON content type and the right body.
        expect(fetchMock).toHaveBeenCalledTimes(1)
        const [url, opts] = fetchMock.mock.calls[0]
        expect(url).toBe('/imboni/onboarding/signup/')
        expect(opts.method).toBe('POST')
        expect(opts.headers['Content-Type']).toBe('application/json')
        expect(JSON.parse(opts.body)).toMatchObject({
            school_name: 'Green Hills Academy',
            subdomain: 'greenhills',
            admin_email: 'jane@greenhills.edu',
        })
    })

    it('shows inline field errors from a 400 response', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: false,
            json: async () => ({ subdomain: ['That subdomain is already taken.'] }),
        })
        vi.stubGlobal('fetch', fetchMock)

        renderSignup()
        fillValidForm()
        fireEvent.click(screen.getByRole('button', { name: /create school/i }))

        await waitFor(() =>
            expect(screen.getByText('That subdomain is already taken.')).toBeTruthy()
        )
        // Still on the form (no confirmation).
        expect(screen.queryByText(/is ready!/i)).toBeNull()
    })
})
