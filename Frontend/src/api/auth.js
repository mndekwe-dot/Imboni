import axios from 'axios'
import client from './client'

const BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

// Login uses plain axios — no token exists yet so client interceptor is not useful here
export async function loginUser(email, password, portal) {
    const res = await axios.post(`${BASE}/imboni/auth/login/`, {
        email, password, portal
    })
    return res.data
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
