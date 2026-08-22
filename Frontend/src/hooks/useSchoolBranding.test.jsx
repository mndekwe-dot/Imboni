import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

vi.mock('../api/branding', () => ({ getSchoolBranding: vi.fn() }))

import { getSchoolBranding } from '../api/branding'
import { useSchoolBranding, __resetBrandingCache } from './useSchoolBranding'

describe('useSchoolBranding', () => {
    beforeEach(() => {
        __resetBrandingCache()
        getSchoolBranding.mockReset()
    })
    afterEach(() => __resetBrandingCache())

    it('returns the school name and logo once they arrive', async () => {
        // Resolves to the payload, not an axios response: client.js unwraps
        // to response.data in an interceptor. Mocking { data: ... } here is
        // what let a broken hook pass first time round.
        getSchoolBranding.mockResolvedValue(
            { school_name: 'Green Hills Secondary', logo: 'https://x/logo.png' })

        const { result } = renderHook(() => useSchoolBranding())

        await waitFor(() => expect(result.current.loaded).toBe(true))
        expect(result.current.schoolName).toBe('Green Hills Secondary')
        expect(result.current.logo).toBe('https://x/logo.png')
    })

    it('reports empty branding when the school has set none', async () => {
        // The common case - most schools never upload a logo. The caller falls
        // back to the Imboni mark, so this must not look like a failure.
        getSchoolBranding.mockResolvedValue({ school_name: '', logo: null })

        const { result } = renderHook(() => useSchoolBranding())

        await waitFor(() => expect(result.current.loaded).toBe(true))
        expect(result.current.schoolName).toBe('')
        expect(result.current.logo).toBeNull()
    })

    it('survives the request failing', async () => {
        /* Branding is decoration. If it 500s, every page in the app still has
           to render - so the hook resolves to empty rather than rejecting. */
        getSchoolBranding.mockRejectedValue(new Error('network down'))

        const { result } = renderHook(() => useSchoolBranding())

        await waitFor(() => expect(result.current.loaded).toBe(true))
        expect(result.current.schoolName).toBe('')
        expect(result.current.logo).toBeNull()
    })

    it('fetches once however many components ask for it', async () => {
        /* Every page renders a Sidebar. Without the module-scope cache this
           would re-request branding on each navigation. */
        getSchoolBranding.mockResolvedValue({ school_name: 'Green Hills', logo: null })

        const a = renderHook(() => useSchoolBranding())
        const b = renderHook(() => useSchoolBranding())
        await waitFor(() => expect(a.result.current.loaded).toBe(true))
        await waitFor(() => expect(b.result.current.loaded).toBe(true))

        renderHook(() => useSchoolBranding())   // a later navigation

        expect(getSchoolBranding).toHaveBeenCalledTimes(1)
    })
})
