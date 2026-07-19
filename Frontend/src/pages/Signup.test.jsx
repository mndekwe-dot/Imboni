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
    it('accepts a 202, polls status, and shows the confirmation when ready', async () => {
        const fetchMock = vi.fn()
            // 1) POST /signup -> 202 Accepted with a status URL to poll.
            .mockResolvedValueOnce({
                status: 202,
                ok: true,
                json: async () => ({
                    provision_id: 'abc',
                    status: 'pending',
                    subdomain: 'greenhills',
                    status_url: '/imboni/onboarding/status/abc/',
                    message: 'Creating your school. This takes a moment.',
                }),
            })
            // 2) GET status -> ready (first poll happens immediately).
            .mockResolvedValue({
                ok: true,
                json: async () => ({
                    status: 'ready',
                    school_name: 'Green Hills Academy',
                    subdomain: 'greenhills',
                    admin_email: 'jane@greenhills.edu',
                    url: 'http://greenhills.localhost/',
                }),
            })
        vi.stubGlobal('fetch', fetchMock)

        renderSignup()
        fillValidForm()
        fireEvent.click(screen.getByRole('button', { name: /create school/i }))

        // Confirmation renders once the poll returns ready.
        await waitFor(() => expect(screen.getByText(/is ready!/i)).toBeTruthy())
        expect(screen.getByText('http://greenhills.localhost/')).toBeTruthy()
        expect(screen.getByText('jane@greenhills.edu')).toBeTruthy()

        // First call is the signup POST (relative url, JSON body).
        const [url, opts] = fetchMock.mock.calls[0]
        expect(url).toBe('/imboni/onboarding/signup/')
        expect(opts.method).toBe('POST')
        expect(opts.headers['Content-Type']).toBe('application/json')
        expect(JSON.parse(opts.body)).toMatchObject({
            school_name: 'Green Hills Academy',
            subdomain: 'greenhills',
            admin_email: 'jane@greenhills.edu',
        })
        // Second call polls the status endpoint from the 202 response.
        expect(fetchMock.mock.calls[1][0]).toBe('/imboni/onboarding/status/abc/')
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
