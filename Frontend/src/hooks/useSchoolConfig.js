import { useEffect, useState } from 'react'
import { getSchoolConfig, updateSchoolConfig } from '../api/dos'
import { getCached, getInFlight, setInFlight, setCached, resetSchoolConfigCache } from './schoolConfigCache'

export { resetSchoolConfigCache }

/**
 * The school's own structure — its sections, the years in each, the streams in
 * each year. This is the single road out of School Settings, and every class
 * picker in the app is on it.
 *
 * Cached at module scope, like `useSchoolBranding`. A school's structure
 * changes about once a year, and now that `<ClassPicker>` reads the
 * configuration itself when a page does not narrow it, a page rendering both
 * the hook and the picker would otherwise fire the same request twice on every
 * navigation. `inFlight` also collapses the concurrent case: mounting the page
 * and its picker in the same tick makes one request, not two.
 *
 * `saveConfig` refills the cache with what the server returned, so a Settings
 * page and every picker elsewhere in the session agree immediately.
 */
export function useSchoolConfig() {
    const [config, setConfig] = useState(getCached() ?? [])
    const [loading, setLoading] = useState(getCached() === null)
    const [error, setError] = useState(null)

    useEffect(() => {
        if (getCached() !== null) return
        let alive = true
        const request = getInFlight() ?? setInFlight(getSchoolConfig())
        request
            .then(data => {
                setCached(Array.isArray(data) ? data : [])
                if (alive) { setConfig(getCached()); setError(null) }
            })
            .catch(err => {
                // Not cached: one failed response must not lock every later
                // picker into an empty list for the rest of the session.
                resetSchoolConfigCache()
                if (alive) setError(err.message)
            })
            .finally(() => { if (alive) setLoading(false) })
        return () => { alive = false }
    }, [])

    /**
     * Save the structure.
     *
     * Pass `{ confirm: true }` to go through with a save the server has said
     * would remove something (it answers 409 the first time, listing what).
     *
     * Rethrows. It used to swallow the error into state, which meant the
     * caller's catch never ran and a failed save looked exactly like a
     * successful one.
     */
    async function saveConfig(updated, { confirm = false } = {}) {
        try {
            const saved = await updateSchoolConfig(updated, { confirm })
            setCached(Array.isArray(saved) ? saved : [])
            setConfig(getCached())
            setError(null)
            return saved
        } catch (err) {
            setError(err.message)
            throw err
        }
    }

    return { config, saveConfig, loading, error }
}
