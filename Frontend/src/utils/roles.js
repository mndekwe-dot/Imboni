/**
 * Roles, and where each one belongs.
 *
 * The nine values here are the `role` column on the backend User model
 * (`apps/authentication/models.py`, USER_ROLES) — not display labels. Changing
 * one on either side without the other silently locks a role out of its own
 * portal, so they are worth keeping literally identical.
 */

/**
 * Where a role lands when it has nowhere better to go: after a login with no
 * explicit redirect, and after being turned away from a portal that isn't
 * theirs. Every role must have an entry — a missing one falls back to /login,
 * which reads as "your session broke" rather than "you took a wrong turn".
 */
export const ROLE_HOME = {
    student:    '/student',
    teacher:    '/teacher',
    parent:     '/parent',
    dos:        '/dos',
    matron:     '/matron',
    discipline: '/discipline',
    librarian:  '/library',
    bursar:     '/finance',
    admin:      '/admin',
}

/**
 * The signed-in user, or null.
 *
 * Reads the copy persisted at login rather than asking the API, because route
 * guards run on the very first render and cannot wait for a request. The parse
 * is guarded: a half-written or hand-edited `imboni_user` should log someone
 * out, not crash the whole app on a white screen.
 */
export function readStoredUser() {
    try {
        const raw = localStorage.getItem('imboni_user')
        return raw ? JSON.parse(raw) : null
    } catch {
        return null
    }
}

/** The i18n key for a role's display name, e.g. 'roles.teacher'. */
export function roleLabelKey(role) {
    return role ? `roles.${role}` : 'roles.unknown'
}
