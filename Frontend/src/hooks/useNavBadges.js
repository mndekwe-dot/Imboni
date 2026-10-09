import { useEffect, useState } from 'react'
import { getNavBadges } from '../api/navBadges'

const REFRESH_MS = 60_000

/**
 * The numbers beside sidebar entries.
 *
 * Only asks when some nav item declares a `badge`, so portals that have not
 * opted in cost nothing. Every page mounts its own Sidebar, so this re-reads on
 * each navigation as well as once a minute.
 *
 * A failed read leaves the numbers as they were. These are a convenience on top
 * of pages that report their own load errors, so a toast here would only be
 * noise on every page of an offline session.
 */
export function useNavBadges(items) {
    const wanted = items.some(item => item.badge)
    const [counts, setCounts] = useState({})

    useEffect(() => {
        if (!wanted) return
        let alive = true
        const load = () => getNavBadges()
            .then(res => { if (alive && res?.data) setCounts(res.data) })
            .catch(() => {})
        load()
        const timer = setInterval(load, REFRESH_MS)
        return () => { alive = false; clearInterval(timer) }
    }, [wanted])

    return counts
}
