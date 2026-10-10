import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router'
import { SupportSession } from './SupportSession'
import client from '../api/client'
import { __resetSession, getAccessToken, isSupportSession } from '../api/session'

vi.mock('../api/client', () => ({ default: { get: vi.fn() } }))

const jwt = claims => `h.${btoa(JSON.stringify(claims)).replace(/=+$/, '')}.s`
const future = () => Math.floor(Date.now() / 1000) + 600

function open(hash) {
    window.location.hash = hash
    return render(
        <MemoryRouter initialEntries={['/support-session']}>
            <Routes>
                <Route path="/support-session" element={<SupportSession />} />
                <Route path="/admin" element={<div>Admin Home</div>} />
            </Routes>
        </MemoryRouter>)
}

describe('SupportSession', () => {
    beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear(); __resetSession() })

    it('signs the operator in as the administrator and lands them on the admin portal', async () => {
        client.get.mockResolvedValue({ role: 'admin', first_name: 'Head' })
        open(`#token=${jwt({ support_session: true, exp: future(), operator: 'ops@imboni.com' })}`)

        expect(await screen.findByText('Admin Home')).toBeInTheDocument()
        expect(JSON.parse(localStorage.getItem('imboni_user')).role).toBe('admin')
        expect(JSON.parse(localStorage.getItem('imboni_support')).operator).toBe('ops@imboni.com')
        expect(isSupportSession()).toBe(true)
        expect(getAccessToken()).toBeTruthy()                          // held for this tab only
        expect(localStorage.getItem('imboni_access')).toBeNull()       // and never in localStorage
        expect(window.location.hash).toBe('')                          // the token is wiped from the address bar
    })

    it('refuses an ordinary token, or an expired one', async () => {
        open(`#token=${jwt({ exp: future() })}`)
        expect(await screen.findByText('This support link is not valid or has expired.')).toBeInTheDocument()
        expect(getAccessToken()).toBeNull()
        expect(isSupportSession()).toBe(false)
    })

    it('refuses a link with no token at all', async () => {
        open('')
        expect(await screen.findByText('This support link is not valid or has expired.')).toBeInTheDocument()
    })

    it('does not keep a login the server would not confirm', async () => {
        client.get.mockRejectedValue({ response: { status: 401 } })
        open(`#token=${jwt({ support_session: true, exp: future() })}`)
        await waitFor(() => expect(screen.getByText('This support link is not valid or has expired.')).toBeInTheDocument())
        expect(getAccessToken()).toBeNull()
        expect(isSupportSession()).toBe(false)
    })
})
