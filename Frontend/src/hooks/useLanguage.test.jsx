import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'

import { useLanguage, useSyncStoredLanguage } from './useLanguage'
import { getMyPreferences, updateMyPreferences } from '../api/account'
import i18n, { setLanguage } from '../i18n'

vi.mock('../api/account')

const TOKEN_KEY = 'imboni_access'
const PENDING_KEY = 'imboni_language_pending'

describe('useLanguage', () => {
    beforeEach(() => {
        localStorage.clear()
        vi.mocked(updateMyPreferences).mockResolvedValue({})
        vi.mocked(getMyPreferences).mockResolvedValue({ language: 'en' })
    })
    afterEach(() => { setLanguage('en'); vi.clearAllMocks() })

    it('applies the language immediately, before any network call', async () => {
        localStorage.setItem(TOKEN_KEY, 'tok')
        // Never resolves: the switch must not wait on it.
        vi.mocked(updateMyPreferences).mockReturnValue(new Promise(() => {}))

        const { result } = renderHook(() => useLanguage())
        act(() => { result.current.change('rw') })

        expect(i18n.language).toBe('rw')
    })

    describe('signed out', () => {
        it('does not call the authenticated endpoint', async () => {
            // The preferences route is authenticated, so calling it here would
            // 401 and roll the choice back in front of the user — on the login
            // page, which is exactly where someone who cannot read English needs
            // the switch to work.
            const { result } = renderHook(() => useLanguage())
            await act(async () => { await result.current.change('rw') })

            expect(updateMyPreferences).not.toHaveBeenCalled()
            expect(i18n.language).toBe('rw')
        })

        it('marks the choice so sign-in does not overwrite it', async () => {
            const { result } = renderHook(() => useLanguage())
            await act(async () => { await result.current.change('rw') })

            expect(localStorage.getItem(PENDING_KEY)).toBe('rw')
        })
    })

    describe('signed in', () => {
        beforeEach(() => localStorage.setItem(TOKEN_KEY, 'tok'))

        it('saves to the account', async () => {
            const { result } = renderHook(() => useLanguage())
            await act(async () => { await result.current.change('fr') })

            expect(updateMyPreferences).toHaveBeenCalledWith({ language: 'fr' })
        })

        it('rolls back and rejects when the save fails', async () => {
            vi.mocked(updateMyPreferences).mockRejectedValue(new Error('offline'))

            const { result } = renderHook(() => useLanguage())
            await expect(
                act(async () => { await result.current.change('rw') })
            ).rejects.toThrow()

            // Leaving the UI in a language the account disagrees with would be
            // a lie about what was saved.
            expect(i18n.language).toBe('en')
        })
    })
})

describe('useSyncStoredLanguage', () => {
    beforeEach(() => {
        localStorage.clear()
        vi.mocked(updateMyPreferences).mockResolvedValue({})
    })
    afterEach(() => { setLanguage('en'); vi.clearAllMocks() })

    it('does nothing at all when signed out', () => {
        renderHook(() => useSyncStoredLanguage())
        expect(getMyPreferences).not.toHaveBeenCalled()
        expect(updateMyPreferences).not.toHaveBeenCalled()
    })

    it('pulls the stored language down', async () => {
        localStorage.setItem(TOKEN_KEY, 'tok')
        vi.mocked(getMyPreferences).mockResolvedValue({ language: 'rw' })

        renderHook(() => useSyncStoredLanguage())
        await waitFor(() => expect(i18n.language).toBe('rw'))
    })

    it('pushes a language chosen before sign-in instead of pulling', async () => {
        // Every account is created with language='en', so pulling here would
        // discard the choice the user just made on the login page.
        localStorage.setItem(TOKEN_KEY, 'tok')
        localStorage.setItem(PENDING_KEY, 'rw')
        vi.mocked(getMyPreferences).mockResolvedValue({ language: 'en' })

        renderHook(() => useSyncStoredLanguage())

        await waitFor(() =>
            expect(updateMyPreferences).toHaveBeenCalledWith({ language: 'rw' }))
        expect(getMyPreferences).not.toHaveBeenCalled()
        await waitFor(() => expect(localStorage.getItem(PENDING_KEY)).toBeNull())
    })

    it('keeps the pending marker when the push fails', async () => {
        localStorage.setItem(TOKEN_KEY, 'tok')
        localStorage.setItem(PENDING_KEY, 'rw')
        vi.mocked(updateMyPreferences).mockRejectedValue(new Error('offline'))

        renderHook(() => useSyncStoredLanguage())

        await waitFor(() => expect(updateMyPreferences).toHaveBeenCalled())
        // Next sign-in gets another chance to save it.
        expect(localStorage.getItem(PENDING_KEY)).toBe('rw')
    })

    it('ignores a language code the frontend does not ship', async () => {
        localStorage.setItem(TOKEN_KEY, 'tok')
        vi.mocked(getMyPreferences).mockResolvedValue({ language: 'de' })

        renderHook(() => useSyncStoredLanguage())
        await waitFor(() => expect(getMyPreferences).toHaveBeenCalled())
        expect(i18n.language).toBe('en')
    })
})
