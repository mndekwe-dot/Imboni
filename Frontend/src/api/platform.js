import axios from 'axios'

// Platform (vendor) console API — the control plane for ALL schools (Phase 5).
// This is a DIFFERENT principal from school users, so it keeps its OWN token,
// separate from the per-school imboni_access token. These endpoints live on the
// PUBLIC schema, so the console must be used on the bare domain (not a subdomain).

// Same convention as api/client.js: undefined -> dev default; '' -> same-origin.
const BASE = import.meta.env.VITE_API_BASE === undefined
    ? 'http://localhost:8000'
    : import.meta.env.VITE_API_BASE

const ACCESS_KEY  = 'imboni_platform_access'
const REFRESH_KEY = 'imboni_platform_refresh'
const USER_KEY    = 'imboni_platform_user'

export function isPlatformAuthed() {
    return !!localStorage.getItem(ACCESS_KEY)
}

export function platformUser() {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
}

export function storePlatformSession(data) {
    localStorage.setItem(ACCESS_KEY, data.access)
    localStorage.setItem(REFRESH_KEY, data.refresh)
    localStorage.setItem(USER_KEY, JSON.stringify(data.user || {}))
}

export function platformLogout() {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
    localStorage.removeItem(USER_KEY)
}

// Authenticated client — attaches the platform bearer token.
const client = axios.create({ baseURL: BASE })
client.interceptors.request.use(cfg => {
    const token = localStorage.getItem(ACCESS_KEY)
    if (token) cfg.headers.Authorization = `Bearer ${token}`
    return cfg
})
// On an expired/invalid platform token, drop the session and bounce to login.
client.interceptors.response.use(
    res => res,
    err => {
        if (err.response?.status === 401 && isPlatformAuthed()) {
            platformLogout()
            if (!window.location.pathname.startsWith('/platform/login')) {
                window.location.assign('/platform/login')
            }
        }
        return Promise.reject(err)
    },
)

// Login uses plain axios (no token yet, and we don't want the 401 interceptor).
export async function platformLogin(email, password) {
    const res = await axios.post(`${BASE}/imboni/platform/auth/login/`, { email, password })
    return res.data   // { access, refresh, user }
}

// The list endpoint is DRF-paginated; normalise to a plain array.
export async function getPlatformSchools() {
    const { data } = await client.get('/imboni/platform/schools/')
    return Array.isArray(data) ? data : (data?.results ?? [])
}

export const suspendSchool    = (id) => client.post(`/imboni/platform/schools/${id}/suspend/`).then(r => r.data)
export const reactivateSchool = (id) => client.post(`/imboni/platform/schools/${id}/reactivate/`).then(r => r.data)
