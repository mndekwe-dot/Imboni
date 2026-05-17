import client from './client'

// Fetch the logged-in user's full profile from the server.
// Returns fresh data — not the stale copy saved in localStorage at login time.
export const getProfile = () =>
    client.get('/imboni/account/profile/')

// Save edits the user made to their profile (name, phone, bio etc).
// PATCH means send only the changed fields — not the whole object.
export const updateProfile = (data) =>
    client.patch('/imboni/account/profile/', data)

// Change the user's password.
// Expects: { old_password, new_password, confirm_password }
export const changePassword = (data) =>
    client.post('/imboni/users/change_password/', data)

// Load the user's notification preferences (email alerts, SMS etc).
// Needs userId because the URL includes the user's id: /users/12/preferences/
export const getPreferences = (userId) =>
    client.get(`/imboni/users/${userId}/preferences/`)

// Save updated notification preferences.
// PATCH — only send the toggles that changed.
export const updatePreferences = (userId, data) =>
    client.patch(`/imboni/users/${userId}/preferences/`, data)

// Upload a new profile photo.
// Uses FormData instead of JSON because images are binary files, not text.
// multipart/form-data tells the server to expect a file, not JSON.
export const uploadAvatar = (file) => {
    const form = new FormData()
    form.append('avatar', file)     // 'avatar' must match the field name the backend expects
    return client.patch('/imboni/account/avatar/', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
    })
}
