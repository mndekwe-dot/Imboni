/**
 * Tenant (school) resolution from the browser host.
 *
 * Imboni is multi-tenant: each school is served at its own subdomain, e.g.
 * `school1.localhost:5173` in dev and `greenhills.imboni.com` in production.
 * The bare domain (`localhost`, `imboni.com`, `www.imboni.com`) is the public
 * marketing / signup site, which belongs to no school.
 *
 * These helpers derive the current tenant from `window.location.hostname` so
 * the app can, for example, point API calls at the right subdomain and show
 * the right school's branding.
 */

/**
 * Return the tenant subdomain label for the current host, or `null` for the
 * public site.
 *
 *   school1.localhost      -> 'school1'
 *   localhost / 127.0.0.1  -> null
 *   greenhills.imboni.com  -> 'greenhills'
 *   imboni.com             -> null   (apex = public)
 *   www.imboni.com         -> null   ('www' is treated as public)
 */
export function getTenantSubdomain() {
    const host =
        (typeof window !== 'undefined' && window.location && window.location.hostname) || ''

    // No host, bare localhost, or a raw IPv4 address -> public.
    if (!host || host === 'localhost' || /^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
        return null
    }

    const parts = host.split('.')
    const isLocalhost = parts[parts.length - 1] === 'localhost'

    // On `*.localhost` a single leading label is already a subdomain
    // (school1.localhost -> 2 parts). On a real domain we need at least three
    // parts (sub.apex.tld) so that a bare `apex.tld` is treated as public.
    const minParts = isLocalhost ? 2 : 3
    if (parts.length < minParts) {
        return null
    }

    const sub = parts[0]
    // `www` is a conventional alias for the public site, not a school.
    if (sub === 'www') {
        return null
    }
    return sub
}

/** True when the current host is the public (non-tenant) site. */
export function isPublicSite() {
    return getTenantSubdomain() === null
}
