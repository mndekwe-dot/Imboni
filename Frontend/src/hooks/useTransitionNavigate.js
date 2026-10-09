import { useCallback } from 'react'
import { flushSync } from 'react-dom'
import { useLocation, useNavigate } from 'react-router'

/*
 * Click handler for a nav link that moves between pages with a View Transition,
 * so the sidebar and header stay put while the content changes.
 *
 * Done by hand rather than with react-router's `viewTransition` prop because
 * that prop only works under a data router (RouterProvider); this app uses the
 * declarative <BrowserRouter>, where it is silently ignored.
 *
 * It only ever STEPS ASIDE: where the API does not exist (Firefox), when the
 * user asked for reduced motion, for a modified click (new tab, new window), or
 * for a link to the page you are already on, it does nothing and the ordinary
 * NavLink navigation proceeds. Navigation never depends on this working.
 */
export function useTransitionNavigate() {
    const navigate = useNavigate()
    const { pathname } = useLocation()

    return useCallback((to, afterClick) => event => {
        afterClick?.()

        if (event.defaultPrevented || event.button !== 0
            || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
        if (typeof document.startViewTransition !== 'function') return
        if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
        if (typeof to !== 'string' || to === pathname) return

        event.preventDefault()
        // flushSync: the browser snapshots the "after" state when this callback
        // returns, so the new route has to be in the DOM by then.
        document.startViewTransition(() => {
            flushSync(() => navigate(to))
        })
    }, [navigate, pathname])
}
