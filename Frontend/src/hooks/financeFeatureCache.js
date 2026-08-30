/**
 * The session's answer to "does this school's plan include finance?".
 *
 * A leaf module with NO imports, for the same reason schoolConfigCache.js and
 * libraryFeatureCache.js are: the test setup clears it between tests, and
 * importing the hook there would drag `api/finance` -- and through it axios --
 * into the module graph before any test file's `vi.mock` had registered.
 */

let enabled = null

export const getFinanceCache = () => enabled

export function setFinanceCache(value) {
    enabled = value
}

/**
 * Forget it. Called on sign-out: the plan belongs to the school that was
 * signed in, and the next sign-in on a shared machine may be a different one.
 */
export function resetFinanceFeatureCache() {
    enabled = null
}
