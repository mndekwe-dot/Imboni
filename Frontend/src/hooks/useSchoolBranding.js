import { useState, useEffect } from 'react'
import { getSchoolBranding } from '../api/branding'

/**
 * The school's own name and logo, for the sidebar and the sign-in screens.
 *
 * Branding is deliberately just these two things. A school cannot set its own
 * chrome colour, because a school free to choose one is free to choose a pale
 * colour that swallows its own sidebar — and no amount of palette derivation
 * makes white text on pale yellow readable. The chrome is fixed; the identity
 * is the mark and the name.
 *
 * Cached at module scope rather than fetched per mount: every page renders a
 * Sidebar, and branding changes about once in a school's lifetime. Without
 * this the app would re-request it on every navigation.
 */
let cache = null
let inFlight = null

export function useSchoolBranding() {
    const [branding, setBranding] = useState(cache)

    useEffect(() => {
        if (cache) return
        let alive = true
        /* client.js unwraps every response to `response.data` in an
           interceptor, so this resolves to the payload itself - not an axios
           response with a .data on it. Reading res.data here silently gave
           undefined and the sidebar quietly kept the Imboni name. */
        inFlight ??= getSchoolBranding()
            .then(data => { cache = data; return cache })
            /* A school with no branding set is the normal case, and the sign-in
               screen must render either way — so a failure here resolves to
               empty rather than rejecting and taking the page down with it. */
            .catch(() => { cache = { school_name: '', logo: null }; return cache })
        inFlight.then(data => { if (alive) setBranding(data) })
        return () => { alive = false }
    }, [])

    return {
        schoolName: branding?.school_name || '',
        logo: branding?.logo || null,
        loaded: branding !== null,
    }
}

/* Tests only: module-scope cache would otherwise leak between cases. */
export function __resetBrandingCache() {
    cache = null
    inFlight = null
}
