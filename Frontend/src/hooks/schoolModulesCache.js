/**
 * The session's answer to "which switchable parts of Imboni does this school have on?".
 *
 * A leaf module with no imports, like libraryFeatureCache.js, so the test setup
 * can clear it without pulling the API client into the module graph early.
 * Cleared on sign-out: the next person on a shared machine may belong to a
 * school with different modules switched off.
 */

let modules = null

export const getModulesCache = () => modules

export function setModulesCache(value) {
    modules = value
}

export function resetSchoolModulesCache() {
    modules = null
}
