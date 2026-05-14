import axios from 'axios'

// Create one axios instance shared across all API files.
// baseURL means you only write the path e.g. '/imboni/dos/students/' not the full URL.
const client = axios.create({
    baseURL: import.meta.env.VITE_API_BASE || 'http://localhost:8000',
    headers: { 'Content-Type': 'application/json' },
})

// REQUEST interceptor — runs before every request is sent.
// Reads the token from localStorage and attaches it to the request headers.
// This replaces writing headers: { Authorization: `Bearer ${token}` } on every call.
client.interceptors.request.use(config => {
    const token = localStorage.getItem('imboni_access')
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config  // must return config or the request is blocked
})

// RESPONSE interceptor — runs after every response comes back.
// Takes two functions: one for success, one for error.
client.interceptors.response.use(
    // Success: unwrap response.data automatically so callers get data directly
    response => response.data,

    // Error: handle globally so each component doesn't repeat this logic
    error => {
        // 401 = token expired or missing — clear storage and go back to login
        if (error.response?.status === 401) {
            localStorage.clear()
            window.location.href = '/login'
        }
        // Pass the server's error message up to whoever made the request
        return Promise.reject(
            new Error(error.response?.data?.error || 'Something went wrong')
        )
    }
)

export default client
