import { describe, it, expect, afterEach } from 'vitest'
import { getTenantSubdomain, isPublicSite } from './tenant'

function setHost(hostname) {
    Object.defineProperty(window, 'location', {
        value: { hostname },
        writable: true,
        configurable: true,
    })
}

describe('getTenantSubdomain', () => {
    afterEach(() => {
        setHost('localhost')
    })

    it('reads the tenant label from a *.localhost dev host', () => {
        setHost('school1.localhost')
        expect(getTenantSubdomain()).toBe('school1')
    })

    it('returns null for bare localhost', () => {
        setHost('localhost')
        expect(getTenantSubdomain()).toBeNull()
    })

    it('returns null for a raw IP address', () => {
        setHost('127.0.0.1')
        expect(getTenantSubdomain()).toBeNull()
    })

    it('reads the tenant label from a production subdomain', () => {
        setHost('greenhills.imboni.com')
        expect(getTenantSubdomain()).toBe('greenhills')
    })

    it('returns null for the apex domain', () => {
        setHost('imboni.com')
        expect(getTenantSubdomain()).toBeNull()
    })

    it('treats www as the public site', () => {
        setHost('www.imboni.com')
        expect(getTenantSubdomain()).toBeNull()
    })
})

describe('isPublicSite', () => {
    afterEach(() => {
        setHost('localhost')
    })

    it('is true on the apex / public host', () => {
        setHost('imboni.com')
        expect(isPublicSite()).toBe(true)
    })

    it('is false on a tenant subdomain', () => {
        setHost('school1.localhost')
        expect(isPublicSite()).toBe(false)
    })
})
