import axios from 'axios'
import client from './client'
import { SESSION_REQUEST, clearSession } from './session'

// See client.js: undefined -> dev default; empty string -> same-origin (container).
const BASE = import.meta.env.VITE_API_BASE === undefined
    ? 'http://localhost:8000'
    : import.meta.env.VITE_API_BASE

// Login uses plain axios — no token exists yet so client's 401-refresh interceptor would
// incorrectly wipe localStorage and force-redirect on every failed login attempt.
// We still want the backend's real error message though, so unwrap it manually here.
//
// `remember` decides how long the session cookie lives: ticked, it outlasts the
// browser; unticked, it goes when the browser closes. SESSION_REQUEST lets the
// browser accept that cookie when the API is on another origin (local dev).
export async function loginUser(email, password, portal, remember = false) {
    try {
        const res = await axios.post(`${BASE}/imboni/auth/login/`, {
            email, password, portal, remember,
        }, SESSION_REQUEST)
        return res.data
    } catch (err) {
        throw new Error(err.response?.data?.error || err.response?.data?.detail || 'Something went wrong')
    }
}

// Second login step for 2FA accounts — exchanges the challenge + a TOTP/backup
// code for real tokens. Plain axios: no session token exists yet.
export async function verifyTwoFactorLogin(challenge, code, remember = false) {
    try {
        const res = await axios.post(`${BASE}/imboni/auth/2fa/login/`, { challenge, code, remember }, SESSION_REQUEST)
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

// Sign out.
//
// The server revokes the refresh token and removes its cookie; that is the
// only place it can be removed from, because the page cannot touch an HttpOnly
// cookie. Plain axios, not `client`: signing out must not first try to renew
// the session it is ending.
//
// This browser is cleared in `finally`, whatever the server says. A network
// error still signs the person out here; the token then expires on its own.
export async function logoutUser() {
    try {
        await axios.post(`${BASE}/imboni/auth/logout/`, {}, SESSION_REQUEST)
    } finally {
        clearSession()
    }
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
// ── School invitation (a newly provisioned school's first admin) ─────────────
// Both endpoints are public and live on the SCHOOL's own domain: the link in
// the email points at the school, which is where the account is.

export async function checkInvitation(token) {
    try {
        const res = await axios.get(`${BASE}/imboni/onboarding/invitation/`, { params: { token } })
        return res.data      // { valid, email, school_name, expires_at }
    } catch (err) {
        throw new Error(err.response?.data?.detail || 'This invitation link is not valid.')
    }
}

export async function acceptInvitation(token, password) {
    try {
        const res = await axios.post(`${BASE}/imboni/onboarding/invitation/accept/`, { token, password })
        return res.data
    } catch (err) {
        throw new Error(err.response?.data?.detail || 'Could not set your password.')
    }
}
