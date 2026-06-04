import axios from 'axios'

const BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

const client = axios.create({
    baseURL: BASE,
    headers: { 'Content-Type': 'application/json' },
})

// REQUEST — attach access token
client.interceptors.request.use(config => {
    const token = localStorage.getItem('imboni_access')
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
})

// Track whether a refresh is already in-flight so we don't fire multiple
let _refreshing = false
let _queue = []   // { resolve, reject } pairs waiting for the new token

function _processQueue(error, token) {
    _queue.forEach(({ resolve, reject }) => error ? reject(error) : resolve(token))
    _queue = []
}

// RESPONSE — unwrap data on success; silently refresh the access token on 401
client.interceptors.response.use(
    response => response.data,
    async error => {
        const original = error.config

        // Only attempt a silent refresh on 401 and only once per request
        if (error.response?.status === 401 && !original._retry) {
            const refresh = localStorage.getItem('imboni_refresh')
            if (!refresh) {
                localStorage.clear()
                window.location.href = '/login'
                return Promise.reject(error)
            }

            if (_refreshing) {
                // Queue this request until the in-flight refresh completes
                return new Promise((resolve, reject) => {
                    _queue.push({ resolve, reject })
                }).then(token => {
                    original.headers.Authorization = `Bearer ${token}`
                    return client(original)
                })
            }

            original._retry = true
            _refreshing = true

            try {
                const res = await axios.post(`${BASE}/imboni/auth/token/refresh/`, { refresh })
                const newAccess = res.data.access
                localStorage.setItem('imboni_access', newAccess)
                if (res.data.refresh) localStorage.setItem('imboni_refresh', res.data.refresh)
                client.defaults.headers.common.Authorization = `Bearer ${newAccess}`
                _processQueue(null, newAccess)
                original.headers.Authorization = `Bearer ${newAccess}`
                return client(original)
            } catch (refreshError) {
                _processQueue(refreshError, null)
                localStorage.clear()
                window.location.href = '/login'
                return Promise.reject(refreshError)
            } finally {
                _refreshing = false
            }
        }

        return Promise.reject(
            new Error(error.response?.data?.error || error.response?.data?.detail || 'Something went wrong')
        )
    }
)

export default client
