import { useEffect, useState } from 'react'
import { getLibraryAvailability } from '../api/library'
import { getLibraryCache, setLibraryCache, resetLibraryFeatureCache } from './libraryFeatureCache'

export { resetLibraryFeatureCache }

/**
 * Whether this school's plan includes the library.
 *
 * The library is the Pro-only feature, and the plan belongs to the SCHOOL, not
 * to the browser -- so this asks the server rather than reading anything the
 * client could edit. A page that gated on localStorage would be one devtools
 * edit away from rendering a portal whose every request then 402s.
 *
 * Cached at module scope, and cleared on sign-out, for the same reason
 * `useSchoolConfig` is: the answer changes about once a year, the sidebar asks
 * on every navigation, and the next person to sign in on a shared machine may
 * belong to a school on a different plan.
 *
 * `enabled` is null until the answer arrives. Callers must treat null as "not
 * yet", never as "no": rendering the upgrade notice while the request is in
 * flight tells a paying school it has not paid.
 */
export function useLibraryFeature() {
    const [enabled, setEnabled] = useState(getLibraryCache())
    const [loading, setLoading] = useState(getLibraryCache() === null)

    useEffect(() => {
        if (getLibraryCache() !== null) return
        let alive = true
        getLibraryAvailability()
            .then(data => {
                const value = Boolean(data?.enabled)
                setLibraryCache(value)
                if (alive) setEnabled(value)
            })
            // A failed check is not a "no". Leaving it null keeps the caller in
            // its loading state rather than telling a Pro school to upgrade
            // because one request timed out.
            .catch(() => { if (alive) setEnabled(null) })
            .finally(() => { if (alive) setLoading(false) })
        return () => { alive = false }
    }, [])

    return { enabled, loading }
}
