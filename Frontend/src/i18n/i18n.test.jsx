import { describe, it, expect, afterEach } from 'vitest'

import { renderWithRouter, screen } from '../test/test-utils'
import { Sidebar } from '../components/layout/Sidebar'
import i18n, { setLanguage, SUPPORTED_LANGUAGES } from './index'
import en from './translations/en'
import rw from './translations/rw'
import fr from './translations/fr'

/**
 * Every language keyed by code. English is the reference the others are held
 * against, so it is kept out of TRANSLATIONS and compared to individually.
 */
const TRANSLATIONS = { rw, fr }
const ALL = { en, ...TRANSLATIONS }

/** Every leaf key as a dotted path, so two languages can be compared. */
function leafKeys(obj, prefix = '') {
    return Object.entries(obj).flatMap(([k, v]) => {
        const path = prefix ? `${prefix}.${k}` : k
        return v && typeof v === 'object' ? leafKeys(v, path) : [path]
    })
}

const read = (file, path) => path.split('.').reduce((o, k) => o?.[k], file)

/** The {{name}} interpolations in a string, sorted, as a comparable key. */
const placeholders = s => ((s.match(/\{\{[^}]+\}\}/g)) || []).sort().join(',')

describe.each(Object.entries(TRANSLATIONS))('%s translations', (lng, file) => {
    it('defines exactly the same keys as English', () => {
        const enKeys = leafKeys(en).sort()
        const keys = leafKeys(file).sort()

        // Reported as explicit diffs — "expected 82 to be 81" would not say which.
        expect(enKeys.filter(k => !keys.includes(k))).toEqual([])   // missing
        expect(keys.filter(k => !enKeys.includes(k))).toEqual([])   // orphaned
    })

    it('has no empty translations', () => {
        expect(leafKeys(file).filter(p => !read(file, p)?.trim())).toEqual([])
    })

    it('keeps the same interpolation placeholders as English', () => {
        // A translator working word-by-word can "translate" the inside of a
        // placeholder — {{total}} becoming {{àtal}} — which i18next cannot
        // resolve, so the raw braces render as visible interface text. The
        // names are code, not prose: they must survive translation untouched.
        const drifted = leafKeys(en)
            .filter(p => placeholders(read(en, p)) !== placeholders(read(file, p)))
            .map(p => `${p}\n    en: ${read(en, p)}\n    ${lng}: ${read(file, p)}`)
        expect(drifted).toEqual([])
    })
})

describe('translation files', () => {
    it('contains no mojibake', () => {
        // Tooling that writes these files can decode UTF-8 as cp1252, turning
        // '…' into 'â€¦' and storing it. The result looks fine in a diff but
        // renders as gibberish, so check for the tell-tale characters.
        const SUSPECT = /[ÂÃ€�]/
        const dirty = Object.entries(ALL).flatMap(([lng, file]) =>
            leafKeys(file)
                .filter(p => SUSPECT.test(read(file, p)))
                .map(p => `${lng}:${p}`))
        expect(dirty).toEqual([])
    })

    it('resolves plural keys in every language', () => {
        // i18next picks the _one / _other suffix from Intl.PluralRules for the
        // active language. If a runtime has no plural data for 'rw', or a key
        // is missing one of the two forms, t() returns the bare key — which
        // would ship "admin.settings.roomCount" as visible interface text.
        const forms = leafKeys(en).filter(k => k.endsWith('_other')).map(k => k.slice(0, -6))
        expect(forms.length).toBeGreaterThan(0)

        // Most plural strings print the number, but not all of them: some only
        // change a pronoun ("Keep it" / "Keep them"). Demand the number back
        // only from the ones that asked for it.
        const shows = base => /\{\{\s*count\s*\}\}/.test(read(en, `${base}_other`))

        for (const lng of Object.keys(ALL)) {
            setLanguage(lng)
            for (const base of forms) {
                for (const count of [0, 1, 5]) {
                    const out = i18n.t(base, { count })
                    expect(out, `${lng}:${base} count=${count}`).not.toContain(base)
                    if (shows(base)) expect(out, `${lng}:${base} count=${count}`).toContain(String(count))
                }
            }
        }
        setLanguage('en')
    })

    it('ships a file for exactly the languages the backend accepts', () => {
        // Backend UserPreferencesSerializer.SUPPORTED_LANGUAGES is ('en', 'fr', 'rw');
        // if these drift, saving a preference 400s.
        expect(SUPPORTED_LANGUAGES.map(l => l.code).sort()).toEqual(['en', 'fr', 'rw'])
        expect(Object.keys(ALL).sort()).toEqual(SUPPORTED_LANGUAGES.map(l => l.code).sort())
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
        setLanguage('de')
        expect(i18n.language).toBe('rw')
    })
})

describe('rendering in French', () => {
    afterEach(() => setLanguage('en'))

    const navItems = [{ to: '/student', labelKey: 'nav.dashboard', icon: 'dashboard', end: true }]
    const secondaryItems = [{ labelKey: 'nav.logout', action: 'logout', icon: 'logout' }]

    it('renders French after switching language', () => {
        setLanguage('fr')
        renderWithRouter(<Sidebar navItems={navItems} secondaryItems={secondaryItems} />)
        expect(screen.getByText('Tableau de bord')).toBeInTheDocument()
        expect(screen.getByText('Déconnexion')).toBeInTheDocument()
        expect(screen.queryByText('Dashboard')).not.toBeInTheDocument()
    })

    it('sets the document lang attribute to fr', () => {
        setLanguage('fr')
        expect(document.documentElement.getAttribute('lang')).toBe('fr')
    })
})
