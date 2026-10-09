import { useEffect, useState } from 'react'
import { getSchoolModules } from '../api/modules'
import { getModulesCache, setModulesCache } from './schoolModulesCache'

export { resetSchoolModulesCache } from './schoolModulesCache'

/**
 * Which switchable parts of the product this school has on.
 *
 * `modules` is null until the answer arrives, and stays null if the request
 * fails. Callers hide something only when its flag is exactly `false`: a failed
 * check must never remove a part of the product the school is using. (The
 * server refuses a switched-off module's endpoints regardless, so showing a
 * link on a maybe costs nothing but a refusal.)
 */
export function useSchoolModules() {
    const [modules, setModules] = useState(getModulesCache())

    useEffect(() => {
        if (getModulesCache() !== null) return
        let alive = true
        getSchoolModules()
            .then(data => {
                if (data && typeof data === 'object') {
                    setModulesCache(data)
                    if (alive) setModules(data)
                }
            })
            .catch(() => { /* fail open: see above */ })
        return () => { alive = false }
    }, [])

    return { modules }
}
