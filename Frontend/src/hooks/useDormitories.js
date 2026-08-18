import { useEffect, useState } from 'react'

import { getDormitories } from '../api/discipline'

/**
 * The school's own dormitories.
 *
 * These were hardcoded in two places as Karisimbi / Muhabura / Bisoke /
 * Sabyinyo — one demo school's houses, shown to every tenant. A school with
 * different houses (or none) got a list it could not use. They come from
 * DisFacility rows of type 'dormitory', which schools manage in settings.
 *
 * Normalises the API's lowercase gender ('girls') to the capitalised form the
 * UI groups by, and derives a stable `key` from the name for form values.
 *
 * Returns [] while loading or on failure; callers must handle an empty list —
 * a school that has not configured dormitories yet is a legitimate state, not
 * an error.
 */
export function useDormitories() {
    const [dormitories, setDormitories] = useState([])

    useEffect(() => {
        let cancelled = false
        getDormitories()
            .then(data => {
                const list = Array.isArray(data) ? data : (data?.results ?? [])
                if (cancelled) return
                setDormitories(list.map(d => ({
                    id:     d.id,
                    key:    String(d.name || '').toLowerCase().replace(/\s+/g, '-'),
                    name:   d.name,
                    // 'girls' -> 'Girls'; anything else ('mixed', 'na') stays as-is.
                    gender: d.gender ? d.gender.charAt(0).toUpperCase() + d.gender.slice(1) : '',
                })))
            })
            .catch(() => { /* leave empty; callers render an empty-state */ })
        return () => { cancelled = true }
    }, [])

    return dormitories
}
