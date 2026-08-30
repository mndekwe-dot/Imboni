/**
 * The session's answer to "does this school's plan include the library?".
 *
 * A leaf module with NO imports, for the same reason schoolConfigCache.js is
 * one: the test setup clears it between tests, and importing the hook there
 * would drag `api/library` -- and through it axios -- into the module graph
 * before any test file's `vi.mock` had registered.
 */

let enabled = null

export const getLibraryCache = () => enabled

export function setLibraryCache(value) {
    enabled = value
}

/**
 * Forget it.
 *
 * Called on sign-out, because the plan belongs to the school that was signed
 * in: on a shared office machine the next sign-in may be a different school on
 * a different plan, and it must not inherit this answer.
 */
export function resetLibraryFeatureCache() {
    enabled = null
}
