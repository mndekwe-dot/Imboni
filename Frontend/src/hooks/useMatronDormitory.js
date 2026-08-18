import { useEffect, useState } from 'react'

import { getMatronDashboard } from '../api/matron'

/**
 * The dormitory this matron is assigned to.
 *
 * The matron pages used to read this out of a hardcoded `matronUser` constant
 * ("Matron, Karisimbi House") and recover the house with
 * `userRole.split(',').pop()`, so every real matron saw one demo school's
 * dormitory name. The backend already returns the assignment on the dashboard
 * (`stats.dormitory`, from DisciplineStaff.assigned_dormitory), so read it.
 *
 * Returns '' while loading, when the request fails, or when the matron has no
 * dormitory assigned. Callers must render a sensible label for that case rather
 * than interpolating an empty string into a sentence.
 */
export function useMatronDormitory() {
    const [dormitory, setDormitory] = useState('')

    useEffect(() => {
        let cancelled = false
        getMatronDashboard()
            .then(data => {
                if (!cancelled) setDormitory(data?.stats?.dormitory || '')
            })
            .catch(() => {
                // Not worth interrupting the page for; callers fall back to a
                // house-less label.
            })
        return () => { cancelled = true }
    }, [])

    return dormitory
}
