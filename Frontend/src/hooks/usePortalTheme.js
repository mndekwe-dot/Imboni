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

const PORTALS = ['dos', 'teacher', 'student', 'parent', 'admin', 'discipline', 'matron',
    'library', 'finance', 'platform']

/* Signed-in routes that belong to no single portal. /profile is reached from
   inside every portal, so it has no portal in its path - and it was therefore
   rendering with no palette at all, as the one page in the app that did not
   match the portal the user had just come from. */
const SHARED_ROUTES = ['profile']

const REMEMBERED = 'imboni_last_portal'

export function portalFromPath(pathname) {
    // '/dos/students' -> 'dos'. Login routes ('/login/dos') count too, so the
    // portal's colours are already right on the sign-in screen.
    const segments = pathname.split('/').filter(Boolean)
    const candidate = segments[0] === 'login' ? segments[1] : segments[0]
    if (PORTALS.includes(candidate)) return candidate

    /* A shared route keeps the portal the user arrived from. Read back from
       sessionStorage rather than a ref so it survives a reload on /profile -
       otherwise refreshing the page would strip the theme it just had. */
    if (SHARED_ROUTES.includes(candidate)) {
        try {
            const last = sessionStorage.getItem(REMEMBERED)
            return PORTALS.includes(last) ? last : null
        } catch {
            return null   // private mode / storage blocked; unthemed is fine
        }
    }
    return null
}

export function usePortalTheme() {
    const { pathname } = useLocation()

    useEffect(() => {
        const portal = portalFromPath(pathname)
        if (portal) {
            document.documentElement.dataset.portal = portal
            // Only a real portal path updates the memory. A shared route reads
            // it; if it wrote too, nothing would ever change it back.
            const segments = pathname.split('/').filter(Boolean)
            if (PORTALS.includes(segments[0])) {
                try { sessionStorage.setItem(REMEMBERED, portal) } catch { /* ignore */ }
            }
        } else {
            delete document.documentElement.dataset.portal
        }
    }, [pathname])
}
