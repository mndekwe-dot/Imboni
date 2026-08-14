import { useEffect, useState } from 'react'
import { getSchoolIdentity } from '../api/discovery'

/**
 * The school behind the current hostname, for branding pages shown before login.
 *
 * Fails soft on purpose. If the request errors -- offline, backend restarting,
 * an old deployment without the endpoint -- the caller renders unbranded rather
 * than blocking or showing an error. Nobody should be unable to sign in because
 * a decorative school name could not be fetched.
 *
 * Returns { school, loading }, where `school` is null on the bare domain and on
 * any failure.
 */
export function useSchoolIdentity() {
    const [school, setSchool] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let alive = true

        getSchoolIdentity()
            .then(data => {
                if (!alive) return
                // The endpoint answers `{name: null}` on the bare domain; treat
                // that the same as no school rather than rendering an empty name.
                setSchool(data && data.name ? data : null)
            })
            .catch(() => {
                if (alive) setSchool(null)
            })
            .finally(() => {
                if (alive) setLoading(false)
            })

        return () => { alive = false }
    }, [])

    return { school, loading }
}
