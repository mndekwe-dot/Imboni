import { useEffect, useState } from 'react'
import { getFinanceAvailability } from '../api/finance'
import { getFinanceCache, setFinanceCache, resetFinanceFeatureCache } from './financeFeatureCache'

export { resetFinanceFeatureCache }

/**
 * Whether this school's plan includes the finance office.
 *
 * Asks the SERVER, like the library's twin of this hook: the plan belongs to
 * the school, and a gate reading anything the client could edit would be one
 * devtools change from rendering a portal whose every request then 402s.
 *
 * `enabled` is null until the answer arrives, and null is NOT "no". Showing a
 * paying school the upgrade notice because a request had not come back yet is
 * worse than a moment of blank content.
 */
export function useFinanceFeature() {
    const [enabled, setEnabled] = useState(getFinanceCache())
    const [loading, setLoading] = useState(getFinanceCache() === null)

    useEffect(() => {
        if (getFinanceCache() !== null) return
        let alive = true
        getFinanceAvailability()
            .then(data => {
                const value = Boolean(data?.enabled)
                setFinanceCache(value)
                if (alive) setEnabled(value)
            })
            .catch(() => { if (alive) setEnabled(null) })
            .finally(() => { if (alive) setLoading(false) })
        return () => { alive = false }
    }, [])

    return { enabled, loading }
}
