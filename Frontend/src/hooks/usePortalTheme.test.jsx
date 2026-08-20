import { describe, it, expect, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { usePortalTheme, portalFromPath } from './usePortalTheme'

describe('portalFromPath', () => {
    it('reads the portal off the first segment', () => {
        expect(portalFromPath('/dos')).toBe('dos')
        expect(portalFromPath('/dos/students')).toBe('dos')
        expect(portalFromPath('/teacher/attendance')).toBe('teacher')
    })

    it('looks past /login so the sign-in screen is already themed', () => {
        expect(portalFromPath('/login/dos')).toBe('dos')
        expect(portalFromPath('/login/matron')).toBe('matron')
    })

    // Public pages must not inherit a portal's palette — the landing page and
    // the pricing page belong to no portal.
    it('returns null for routes outside any portal', () => {
        expect(portalFromPath('/')).toBeNull()
        expect(portalFromPath('/pricing')).toBeNull()
        expect(portalFromPath('/login')).toBeNull()
        expect(portalFromPath('/profile')).toBeNull()
    })

    it('does not treat an unknown first segment as a portal', () => {
        expect(portalFromPath('/dosser')).toBeNull()
        expect(portalFromPath('/admins')).toBeNull()
    })
})

describe('usePortalTheme', () => {
    afterEach(() => {
        delete document.documentElement.dataset.portal
    })

    const at = path => renderHook(() => usePortalTheme(), {
        wrapper: ({ children }) => <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>,
    })

    it('stamps the portal on <html>', () => {
        at('/dos/results')
        expect(document.documentElement.dataset.portal).toBe('dos')
    })

    it('clears the attribute when the route leaves every portal', () => {
        document.documentElement.dataset.portal = 'dos'
        at('/pricing')
        expect(document.documentElement.dataset.portal).toBeUndefined()
    })
})
