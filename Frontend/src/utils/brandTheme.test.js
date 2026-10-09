import { describe, it, expect, afterEach } from 'vitest'
import { applyBrandTheme, contrastWithWhite, deriveBrandTheme, isHexColor, isReadableBrand } from './brandTheme'

describe('brandTheme', () => {
    afterEach(() => applyBrandTheme(''))

    it('measures white-on-colour contrast the way WCAG does', () => {
        expect(contrastWithWhite('#000000')).toBeCloseTo(21, 0)
        expect(contrastWithWhite('#ffffff')).toBeCloseTo(1, 1)
        expect(contrastWithWhite('#003d7a')).toBeGreaterThan(9)
    })

    it('accepts dark colours and rejects ones white text cannot be read on', () => {
        expect(isReadableBrand('#7c2d12')).toBe(true)
        expect(isReadableBrand('#ffeb3b')).toBe(false)
        expect(isReadableBrand('#fff')).toBe(false)
        expect(isHexColor('blue')).toBe(false)
    })

    it('derives the palette from the one colour, and nothing from an unusable one', () => {
        const theme = deriveBrandTheme('#7c2d12')
        expect(theme['--primary']).toBe('#7c2d12')
        expect(theme['--chrome-from']).toBe('#7c2d12')
        expect(theme['--primary-hover']).not.toBe(theme['--primary'])
        expect(theme['--primary-light']).toBe('rgba(124, 45, 18, 0.1)')
        expect(deriveBrandTheme('#ffeb3b')).toEqual({})
    })

    it('puts the colour on the page, replaces it, and restores the default', () => {
        const root = document.documentElement
        applyBrandTheme('#7c2d12')
        expect(root.style.getPropertyValue('--primary')).toBe('#7c2d12')
        applyBrandTheme('#166534')
        expect(root.style.getPropertyValue('--primary')).toBe('#166534')
        applyBrandTheme('')
        expect(root.style.getPropertyValue('--primary')).toBe('')
        expect(root.style.getPropertyValue('--sidebar')).toBe('')
    })
})
