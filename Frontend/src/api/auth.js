const BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

/**
 * Login a user through a specific portal.
 * The backend validates that the user's role matches the portal.
 *
 * @param {string} email
 * @param {string} password
 * @param {string} portal  - 'student' | 'teacher' | 'dos' | 'parent' | 'discipline' | 'matron' | 'admin'
 * @returns {{ access, refresh, user }}
 * @throws Error with message from the server
 */
export async function loginUser(email, password, portal) {
    const res = await fetch(`${BASE}/imboni/auth/login/`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password, portal }),
    })

    const data = await res.json()

    if (!res.ok) {
        // Use the server's error message so the user sees exactly what went wrong
        throw new Error(data.error || 'Something went wrong. Please try again.')
    }

    return data
}

/**
 * Logout — blacklists the refresh token on the server.
 */
export async function logoutUser() {
    const refresh = localStorage.getItem('imboni_refresh')
    const access  = localStorage.getItem('imboni_access')
    if (!refresh) return

    await fetch(`${BASE}/imboni/auth/logout/`, {
        method:  'POST',
        headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${access}`,
        },
        body: JSON.stringify({ refresh }),
    })

    localStorage.removeItem('imboni_access')
    localStorage.removeItem('imboni_refresh')
    localStorage.removeItem('imboni_user')
}
