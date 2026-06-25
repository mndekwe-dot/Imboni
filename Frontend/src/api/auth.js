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