/**
 * The session's copy of the school structure.
 *
 * It lives in its own module, with NO imports, on purpose. The test setup file
 * has to be able to clear it between tests, and importing the hook there would
 * pull `api/dos` — and through it axios — into the module graph before any test
 * file's `vi.mock('../../api/dos')` had been registered. The hook would then
 * stay bound to the real API module and every mocked test would make a real
 * request. A leaf module with no dependencies cannot do that to anyone.
 */

let value = null
let inFlight = null

export const getCached = () => value
export const getInFlight = () => inFlight

export function setInFlight(promise) {
    inFlight = promise
    return inFlight
}

export function setCached(next) {
    value = next
    inFlight = Promise.resolve(next)
}

/**
 * Forget it.
 *
 * Called on sign-out — the structure belongs to the school that was signed in,
 * and on a shared office machine the next sign-in may be a different school
 * whose class pickers must not inherit these years and streams — and after
 * every test, because a module cache otherwise outlives the test that filled it.
 */
export function resetSchoolConfigCache() {
    value = null
    inFlight = null
}
