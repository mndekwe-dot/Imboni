import client from './client'

/**
 * Ask the platform to email the school links for an address.
 *
 * Served from the BARE domain (public schema), so this is only meaningful on
 * imboni.tech, not on a school subdomain.
 *
 * The response is identical whether or not the address is registered -- the
 * backend deliberately gives nothing away, so there is nothing here to branch
 * on. Show the returned message and stop.
 */
export const findMySchool = (email) =>
    client.post('/imboni/find-school/', { email })

/**
 * Turn a typed school code into the school's name and host.
 *
 * Bare domain only. Rejects with a 404 for any code that is not a school, so
 * callers can tell "no such school" (404) from "could not reach us".
 */
export const lookupSchoolByCode = (code) =>
    client.get('/imboni/school-by-code/', { params: { code } })

/**
 * The school behind the current hostname, for branding the login page.
 *
 * Unauthenticated by design: the name has to render before anyone signs in.
 * On the bare domain it resolves with `{ name: null }` rather than failing, so
 * callers can render unbranded without special-casing.
 */
export const getSchoolIdentity = () =>
    client.get('/imboni/school/identity/')
