import { Navigate } from "react-router"
import { ROLE_HOME, readStoredUser } from "../utils/roles"
import { hasSession } from "../api/session"

/**
 * A route only the right role may open.
 *
 * This used to check one thing: that a token was stored in the browser.
 * Any signed-in user could therefore load any portal — an admin could open
 * /teacher/classes and get the teacher's sidebar, header and layout. The API
 * refused the data behind it ("Access restricted to teachers"), so nothing
 * leaked, but the app rendered a portal the viewer had no business being in
 * and then filled it with an error. A guard that admits everyone and lets the
 * server sort it out isn't a guard.
 *
 * Two decisions, in order:
 *
 *   1. Nobody signed in → /login.
 *   2. Signed in as the wrong role → that role's *own* home, not /login.
 *      Being in the wrong place is not the same as being logged out, and
 *      bouncing someone to a login form they don't need is how you make a
 *      wrong turn look like a broken session.
 *
 * `role` is a single role or an array. Omitting it marks the route as shared
 * by every signed-in user (e.g. /profile) — deliberate, not a default.
 */
export function ProtectedRoute({ children, role }) {
    // Whether somebody is signed in, as far as this browser knows. Not a
    // credential and not trusted as one: it decides which screen to draw,
    // and the server decides what the person may actually see.
    if (!hasSession()) {
        return <Navigate to="/login" replace />
    }

    // Shared route: any authenticated user may pass.
    if (!role) {
        return children
    }

    const user = readStoredUser()

    // A session with no readable identity is half-built —
    // cleared storage, a failed parse, a login that didn't finish. There is no
    // home to send them to, so make them sign in again.
    if (!user?.role) {
        return <Navigate to="/login" replace />
    }

    const allowed = Array.isArray(role) ? role : [role]
    // A secondary role (a teacher who is also the assistant DOS) opens that
    // portal too. The server decides what they can actually do in it.
    const held = [user.role, ...(user.extra_roles || [])]
    if (!held.some(r => allowed.includes(r))) {
        return <Navigate to={ROLE_HOME[user.role] ?? '/login'} replace />
    }

    return children
}
