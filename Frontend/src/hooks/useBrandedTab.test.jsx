import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

vi.mock('../api/branding', () => ({ getSchoolBranding: vi.fn() }))

import { getSchoolBranding } from '../api/branding'
import { __resetBrandingCache } from './useSchoolBranding'
import { useBrandedTab } from './useBrandedTab'

describe('useBrandedTab', () => {
    beforeEach(() => {
        __resetBrandingCache()
        getSchoolBranding.mockReset()
        document.title = 'Imboni'
        document.head.innerHTML = '<title>Imboni</title><link rel="icon" href="/icon-192.png">'
    })

    it('puts the school name and logo on the tab, and puts the originals back', async () => {
        getSchoolBranding.mockResolvedValue({ school_name: 'Green Hills Secondary', logo: 'https://x/logo.png' })
        const { unmount } = renderHook(() => useBrandedTab())

        await waitFor(() => expect(document.title).toBe('Green Hills Secondary'))
        expect(document.querySelector('link[rel~="icon"]').getAttribute('href')).toBe('https://x/logo.png')

        unmount()
        expect(document.title).toBe('Imboni')
        expect(document.querySelector('link[rel~="icon"]').getAttribute('href')).toBe('/icon-192.png')
    })

    it('leaves the product title and icon alone when the school has set neither', async () => {
        getSchoolBranding.mockResolvedValue({ school_name: '', logo: null })
        renderHook(() => useBrandedTab())
        await new Promise(r => setTimeout(r, 20))
        expect(document.title).toBe('Imboni')
        expect(document.querySelector('link[rel~="icon"]').getAttribute('href')).toBe('/icon-192.png')
    })
})
