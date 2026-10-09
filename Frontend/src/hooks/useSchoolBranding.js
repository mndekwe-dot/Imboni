import { useState, useEffect } from 'react'
import { getSchoolBranding } from '../api/branding'

/**
 * The school's own name and logo, for the sidebar and the sign-in screens.
 *
 * Branding is the school's name, its mark and one colour. The colour is only
 * accepted when white text stays readable on it (the sidebar and every primary
 * button put white on it), which is checked in the picker and again on the
 * server, so a school cannot choose one that swallows its own sidebar.
 *
 * Cached at module scope rather than fetched per mount: every page renders a
 * Sidebar, and branding changes about once in a school's lifetime. Without
 * this the app would re-request it on every navigation. When it does change,
 * `refreshSchoolBranding()` re-reads it and every mounted consumer follows, so
 * a new logo shows in the sidebar the moment it is saved rather than at the
 * next reload.
 */
let cache = null
let inFlight = null
const listeners = new Set()

function load() {
    /* client.js unwraps every response to `response.data` in an
       interceptor, so this resolves to the payload itself - not an axios
       response with a .data on it. Reading res.data here silently gave
       undefined and the sidebar quietly kept the Imboni name. */
    inFlight ??= getSchoolBranding()
        .then(data => { cache = data; return cache })
        /* A school with no branding set is the normal case, and the sign-in
           screen must render either way — so a failure here resolves to
           empty rather than rejecting and taking the page down with it. */
        .catch(() => { cache = cache || { school_name: '', logo: null, brand_color: '' }; return cache })
        .finally(() => { inFlight = null })
    return inFlight
}

/** Re-read the branding and tell everything showing it. */
export function refreshSchoolBranding() {
    cache = null
    inFlight = null
    return load().then(data => { listeners.forEach(fn => fn(data)); return data })
}

export function useSchoolBranding() {
    const [branding, setBranding] = useState(cache)

    useEffect(() => {
        let alive = true
        const follow = data => { if (alive) setBranding(data) }
        listeners.add(follow)
        if (!cache) load().then(follow)
        return () => { alive = false; listeners.delete(follow) }
    }, [])

    return {
        schoolName: branding?.school_name || '',
        logo: branding?.logo || null,
        brandColor: branding?.brand_color || '',
        loaded: branding !== null,
    }
}

/* Tests only: module-scope cache would otherwise leak between cases. */
export function __resetBrandingCache() {
    cache = null
    inFlight = null
    listeners.clear()
}
