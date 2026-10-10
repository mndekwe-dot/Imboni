import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('axios', () => ({ default: { post: vi.fn() } }))

const OURS = { withCredentials: true, headers: { 'X-Requested-With': 'XMLHttpRequest' } }
const REFRESH = expect.stringContaining('/imboni/auth/token/refresh/')
const ended = () => Object.assign(new Error('ended'), { response: { status: 401 } })

describe('api/session.js', () => {
    let axios, session

    beforeEach(async () => {
        vi.resetModules()
        localStorage.clear()
        sessionStorage.clear()
        axios = (await import('axios')).default
        axios.post.mockReset()
        session = await import('./session')
    })

    afterEach(() => { vi.unstubAllGlobals() })

    it('starts with no access token: a reload forgets it', () => {
        expect(session.getAccessToken()).toBeNull()
    })

    it('is signed in when a profile is stored, and that profile is not a credential', () => {
        expect(session.hasSession()).toBe(false)
        localStorage.setItem('imboni_user', JSON.stringify({ id: 1, role: 'teacher' }))
        expect(session.hasSession()).toBe(true)
        expect(session.getAccessToken()).toBeNull()
    })

    it('buys an access token with the cookie and keeps it in memory only', async () => {
        axios.post.mockResolvedValue({ data: { access: 'SECRET-ACCESS' } })

        expect(await session.refreshAccessToken()).toBe('SECRET-ACCESS')

        expect(axios.post).toHaveBeenCalledWith(REFRESH, {}, OURS)
        expect(session.getAccessToken()).toBe('SECRET-ACCESS')
        expect(JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage })).not.toContain('SECRET-ACCESS')
    })

    it('makes one request however many callers ask at once', async () => {
        let resolve
        axios.post.mockReturnValue(new Promise(r => { resolve = r }))

        const all = Promise.all([session.refreshAccessToken(), session.refreshAccessToken(), session.ensureAccessToken()])
        await Promise.resolve()
        resolve({ data: { access: 'tok' } })

        expect(await all).toEqual(['tok', 'tok', 'tok'])
        expect(axios.post).toHaveBeenCalledTimes(1)
    })

    it('does not ask again while it already holds a token', async () => {
        session.setAccessToken('have-one')
        expect(await session.ensureAccessToken()).toBe('have-one')
        expect(axios.post).not.toHaveBeenCalled()
    })

    it('takes turns with other tabs, so two do not spend the same cookie at once', async () => {
        const request = vi.fn((_name, task) => task())
        vi.stubGlobal('navigator', { ...navigator, locks: { request } })
        axios.post.mockResolvedValue({ data: { access: 'tok' } })

        await session.refreshAccessToken()

        expect(request).toHaveBeenCalledWith('imboni-session-refresh', expect.any(Function))
    })

    it('tries once more when another tab got there first', async () => {
        // The other tab's refresh retired the cookie this one sent. A moment
        // later the browser holds the new one.
        axios.post.mockRejectedValueOnce(ended()).mockResolvedValueOnce({ data: { access: 'second-try' } })

        expect(await session.refreshAccessToken()).toBe('second-try')
        expect(axios.post).toHaveBeenCalledTimes(2)
    })

    it('gives up, saying the session is over, when the server refuses twice', async () => {
        axios.post.mockRejectedValue(ended())

        await expect(session.refreshAccessToken()).rejects.toMatchObject({ response: { status: 401 } })
        expect(axios.post).toHaveBeenCalledTimes(2)
        expect(session.getAccessToken()).toBeNull()
    })

    it('does not retry, and reports no response, when the server cannot be reached', async () => {
        axios.post.mockRejectedValue(new Error('Network Error'))

        const err = await session.refreshAccessToken().catch(e => e)
        expect(err.response).toBeUndefined()
        expect(axios.post).toHaveBeenCalledTimes(1)
    })

    describe('a browser that signed in before the cookie existed', () => {
        beforeEach(() => {
            localStorage.setItem('imboni_user', JSON.stringify({ id: 1 }))
            localStorage.setItem('imboni_access', 'old-access')
            localStorage.setItem('imboni_refresh', 'old-refresh')
        })

        it('hands its stored token over once, and then holds none', async () => {
            axios.post.mockResolvedValue({ data: { access: 'new-access' } })

            await session.refreshAccessToken()

            expect(axios.post).toHaveBeenCalledWith(REFRESH, { refresh: 'old-refresh' }, OURS)
            expect(localStorage.getItem('imboni_refresh')).toBeNull()
            expect(localStorage.getItem('imboni_access')).toBeNull()
            expect(localStorage.getItem('imboni_user')).not.toBeNull()     // still signed in

            await session.refreshAccessToken()
            expect(axios.post).toHaveBeenLastCalledWith(REFRESH, {}, OURS)   // the cookie from now on
        })

        it('keeps the stored token while offline: it is the only way back in', async () => {
            axios.post.mockRejectedValue(new Error('Network Error'))

            await session.refreshAccessToken().catch(() => {})

            expect(localStorage.getItem('imboni_refresh')).toBe('old-refresh')
        })

        it('drops the stored token once the server has refused it', async () => {
            axios.post.mockRejectedValue(ended())

            await session.refreshAccessToken().catch(() => {})

            expect(localStorage.getItem('imboni_refresh')).toBeNull()
        })
    })

    describe('support sessions', () => {
        it('are held for the tab, survive a reload inside it, and are never in localStorage', async () => {
            session.startSupportSession('support-token')
            expect(session.isSupportSession()).toBe(true)
            expect(JSON.stringify({ ...localStorage })).not.toContain('support-token')

            vi.resetModules()                                   // a reload of the page
            const reloaded = await import('./session')
            expect(reloaded.getAccessToken()).toBe('support-token')
        })
    })

    it('clearSession forgets everything on this browser', () => {
        localStorage.setItem('imboni_user', '{}')
        localStorage.setItem('imboni_access', 'old')
        localStorage.setItem('imboni_refresh', 'old')
        session.startSupportSession('support-token')

        session.clearSession()

        expect(session.getAccessToken()).toBeNull()
        expect(session.hasSession()).toBe(false)
        expect(session.isSupportSession()).toBe(false)
        expect(localStorage.getItem('imboni_access')).toBeNull()
        expect(localStorage.getItem('imboni_refresh')).toBeNull()
    })
})
