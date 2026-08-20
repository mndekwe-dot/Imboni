import { useEffect } from 'react'
import { useLocation } from 'react-router'

/**
 * Stamps `data-portal` on <html> from the current route.
 *
 * Why this exists: every portal's CSS file declares its `--portal-accent` on
 * `:root`, but Vite bundles all seven into one stylesheet, so `:root` means
 * "the whole app" and the last file in the bundle silently won for every
 * portal. Scoping those blocks to `:root[data-portal="teacher"]` &c. fixes it,
 * and this hook is what supplies the attribute.
 *
 * It also gives a portal a place to opt into its own palette without touching
 * the shared files — see the DOS block in index.css.
 */

const PORTALS = ['dos', 'teacher', 'student', 'parent', 'admin', 'discipline', 'matron', 'platform']

export function portalFromPath(pathname) {
    // '/dos/students' -> 'dos'. Login routes ('/login/dos') count too, so the
    // portal's colours are already right on the sign-in screen.
    const segments = pathname.split('/').filter(Boolean)
    const candidate = segments[0] === 'login' ? segments[1] : segments[0]
    return PORTALS.includes(candidate) ? candidate : null
}

export function usePortalTheme() {
    const { pathname } = useLocation()

    useEffect(() => {
        const portal = portalFromPath(pathname)
        if (portal) {
            document.documentElement.dataset.portal = portal
        } else {
            delete document.documentElement.dataset.portal
        }
    }, [pathname])
}
