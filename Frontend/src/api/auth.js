import axios from 'axios'
import client from './client'

const BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

// Login uses plain axios — no token exists yet so client's 401-refresh interceptor would
// incorrectly wipe localStorage and force-redirect on every failed login attempt.
// We still want the backend's real error message though, so unwrap it manually here.
export async function loginUser(email, password, portal) {
    try {
        const res = await axios.post(`${BASE}/imboni/auth/login/`, {
            email, password, portal
        })
        return res.data
    } catch (err) {
        throw new Error(err.response?.data?.error || err.response?.data?.detail || 'Something went wrong')
    }
}

// Second login step for 2FA accounts — exchanges the challenge + a TOTP/backup
// code for real tokens. Plain axios: no session token exists yet.
export async function verifyTwoFactorLogin(challenge, code) {
    try {
        const res = await axios.post(`${BASE}/imboni/auth/2fa/login/`, { challenge, code })
        return res.data
    } catch (err) {
        throw new Error(err.response?.data?.error || err.response?.data?.detail || 'Invalid or expired code')
    }
}

// ── 2FA self-service management (authenticated — use client for the auth header) ──
export const getTwoFactorStatus = () => client.get('/imboni/auth/2fa/status/')
export const setupTwoFactor     = () => client.post('/imboni/auth/2fa/setup/')
export const verifyTwoFactor    = (code) => client.post('/imboni/auth/2fa/verify/', { code })
export const disableTwoFactor   = (password) => client.post('/imboni/auth/2fa/disable/', { password })

// Logout uses client — user is logged in so the interceptor attaches the token automatically
export async function logoutUser() {
    const refresh = localStorage.getItem('imboni_refresh')
    if (!refresh) return

    await client.post('/imboni/auth/logout/', { refresh })

    localStorage.removeItem('imboni_access')
    localStorage.removeItem('imboni_refresh')
    localStorage.removeItem('imboni_user')
}

//send password reset email - no token needed, user is not logged in
export const requestPasswordReset = (email) =>
    axios.post(`${BASE}/imboni/auth/password-reset/`, { email })

// Step 2 of the reset flow — submit the new password with the uid/token from the email link.
// Same reasoning as loginUser: plain axios so the client's 401-refresh interceptor (which
// assumes a logged-in session) doesn't fire, but unwrap the backend's real error message.
export async function confirmPasswordReset(uid, token, newPassword) {
    try {
        const res = await axios.post(`${BASE}/imboni/auth/password-reset/confirm/`, {
            uid, token, new_password: newPassword,
        })
        return res.data
    } catch (err) {
        throw new Error(err.response?.data?.error || err.response?.data?.detail || 'Something went wrong')
    }
}

// Send invitation — DOS is logged in, use client for auth header
export const sendInvitation = (data) => client.post('/imboni/auth/invite/', data)

// Verify invitation link — public, no token needed
export const verifyInvitation = (uid, token) =>
    axios.get(`${BASE}/imboni/auth/register/verify/${uid}/${token}/`)

// Complete registration — public, no token needed
export const completeRegistration = (data) =>
    axios.post(`${BASE}/imboni/auth/register/complete/`, data)

// List invitations sent by the current user
export const getInvitations = () => client.get('/imboni/auth/invite/list/')

// Resend an invitation (generates a fresh token and re-sends)
export const resendInvitation = (id) => client.post(`/imboni/auth/invite/resend/${id}/`)

// Cancel (delete) a pending invitation
export const cancelInvitation = (id) => client.delete(`/imboni/auth/invite/${id}/cancel/`)