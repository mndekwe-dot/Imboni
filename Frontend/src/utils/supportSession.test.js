import { describe, it, expect, beforeEach } from 'vitest'
import { clearSupportSession, decodeJwtPayload, readSupportSession, saveSupportSession } from './supportSession'

const jwt = claims => `h.${btoa(JSON.stringify(claims)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')}.s`

describe('supportSession', () => {
    beforeEach(() => localStorage.clear())

    it('reads the claims of a token without trusting them', () => {
        expect(decodeJwtPayload(jwt({ support_session: true, exp: 5 }))).toEqual({ support_session: true, exp: 5 })
        expect(decodeJwtPayload('not-a-token')).toBeNull()
        expect(decodeJwtPayload('')).toBeNull()
    })

    it('remembers a session until it ends, and not after', () => {
        saveSupportSession({ exp: Math.floor(Date.now() / 1000) + 600, operator: 'ops@imboni.com' })
        expect(readSupportSession().operator).toBe('ops@imboni.com')
        saveSupportSession({ exp: Math.floor(Date.now() / 1000) - 1, operator: 'ops@imboni.com' })
        expect(readSupportSession()).toBeNull()
    })

    it('ending a session signs the browser out as well', () => {
        localStorage.setItem('imboni_access', 'x'); localStorage.setItem('imboni_user', '{}')
        saveSupportSession({ exp: Math.floor(Date.now() / 1000) + 600 })
        clearSupportSession()
        expect(localStorage.getItem('imboni_access')).toBeNull()
        expect(localStorage.getItem('imboni_user')).toBeNull()
        expect(readSupportSession()).toBeNull()
    })
})
