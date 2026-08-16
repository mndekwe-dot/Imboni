import { describe, it, expect, afterEach } from 'vitest'

import { renderWithRouter, screen } from '../test/test-utils'
import { Sidebar } from '../components/layout/Sidebar'
import i18n, { setLanguage, SUPPORTED_LANGUAGES } from './index'
import en from './en.json'
import rw from './rw.json'

/** Every leaf key as a dotted path, so the two files can be compared. */
function leafKeys(obj, prefix = '') {
    return Object.entries(obj).flatMap(([k, v]) => {
        const path = prefix ? `${prefix}.${k}` : k
        return v && typeof v === 'object' ? leafKeys(v, path) : [path]
    })
}

describe('translation files', () => {
    it('rw.json defines exactly the same keys as en.json', () => {
        const enKeys = leafKeys(en).sort()
        const rwKeys = leafKeys(rw).sort()

        // Reported as explicit diffs — "expected 82 to be 81" would not say which.
        expect(enKeys.filter(k => !rwKeys.includes(k))).toEqual([])   // missing rw
        expect(rwKeys.filter(k => !enKeys.includes(k))).toEqual([])   // orphaned rw
    })

    it('has no empty translations', () => {
        const blanks = leafKeys(rw).filter(path =>
            !path.split('.').reduce((o, k) => o?.[k], rw)?.trim())
        expect(blanks).toEqual([])
    })

    it('contains no mojibake', () => {
        // Tooling that writes these files can decode UTF-8 as cp1252, turning
        // '…' into 'â€¦' and storing it. The result looks fine in a diff but
        // renders as gibberish, so check for the tell-tale characters.
        const SUSPECT = /[ÂÃ€�]/
        const dirty = [en, rw].flatMap((file, i) =>
            leafKeys(file)
                .filter(p => SUSPECT.test(p.split('.').reduce((o, k) => o[k], file)))
                .map(p => `${i === 0 ? 'en' : 'rw'}:${p}`))
        expect(dirty).toEqual([])
    })

    it('resolves plural keys in both languages', () => {
        // i18next picks the _one / _other suffix from Intl.PluralRules for the
        // active language. If a runtime has no plural data for 'rw', or a key
        // is missing one of the two forms, t() returns the bare key — which
        // would ship "admin.settings.roomCount" as visible interface text.
        const forms = leafKeys(en).filter(k => k.endsWith('_other')).map(k => k.slice(0, -6))
        expect(forms.length).toBeGreaterThan(0)

        for (const lng of ['en', 'rw']) {
            setLanguage(lng)
            for (const base of forms) {
                for (const count of [0, 1, 5]) {
                    const out = i18n.t(base, { count })
                    expect(out, `${lng}:${base} count=${count}`).not.toContain(base)
                    expect(out).toContain(String(count))
                }
            }
        }
        setLanguage('en')
    })

    it('exposes exactly the languages the backend accepts', () => {
        // Backend UserPreferencesSerializer.SUPPORTED_LANGUAGES is ('en', 'rw');
        // if these drift, saving a preference 400s.
        expect(SUPPORTED_LANGUAGES.map(l => l.code).sort()).toEqual(['en', 'rw'])
    })
})

describe('rendering in Kinyarwanda', () => {
    afterEach(() => setLanguage('en'))

    const navItems = [{ to: '/student', labelKey: 'nav.dashboard', icon: 'dashboard', end: true }]
    const secondaryItems = [{ labelKey: 'nav.logout', action: 'logout', icon: 'logout' }]

    it('renders English by default', () => {
        renderWithRouter(<Sidebar navItems={navItems} secondaryItems={secondaryItems} />)
        expect(screen.getByText('Dashboard')).toBeInTheDocument()
    })

    it('renders Kinyarwanda after switching language', () => {
        setLanguage('rw')
        renderWithRouter(<Sidebar navItems={navItems} secondaryItems={secondaryItems} />)
        expect(screen.getByText('Imbonerahamwe')).toBeInTheDocument()
        expect(screen.getByText('Sohoka')).toBeInTheDocument()
        expect(screen.queryByText('Dashboard')).not.toBeInTheDocument()
    })

    it('sets the document lang attribute so screen readers switch voice', () => {
        setLanguage('rw')
        expect(document.documentElement.getAttribute('lang')).toBe('rw')
        setLanguage('en')
        expect(document.documentElement.getAttribute('lang')).toBe('en')
    })

    it('ignores an unsupported language code', () => {
        setLanguage('rw')
        setLanguage('fr')
        expect(i18n.language).toBe('rw')
    })
})
