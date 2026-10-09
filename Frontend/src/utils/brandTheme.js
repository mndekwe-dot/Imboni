/**
 * A school's colour, turned into the handful of tokens the app is built from.
 *
 * The school picks one colour. Everything else (hover, tinted surfaces, the
 * sidebar gradient, the focus ring) is derived from it, so the interface stays
 * one coherent palette instead of whatever five colours somebody typed.
 *
 * White text sits on the brand colour (primary buttons, the sidebar), so a
 * colour is only usable when it carries white at WCAG AA. The backend enforces
 * the same 4.5:1 rule; this is the same arithmetic run first, so the picker can
 * say why before the server has to refuse.
 */
export const DEFAULT_BRAND = '#003d7a'
export const MIN_CONTRAST = 4.5

const HEX = /^#[0-9a-f]{6}$/i

const toRgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))
const toHex = rgb => '#' + rgb.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')
const channel = v => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }

export const isHexColor = value => HEX.test(value || '')

/** Contrast ratio of white text on `hex`. */
export function contrastWithWhite(hex) {
    const [r, g, b] = toRgb(hex)
    return 1.05 / (0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b) + 0.05)
}

export const isReadableBrand = hex => isHexColor(hex) && contrastWithWhite(hex) >= MIN_CONTRAST

// Mix toward black (amount > 0 darkens) or white.
const shade = (hex, amount) => toHex(toRgb(hex).map(v => v * (1 - amount)))
const tint = (hex, amount) => toHex(toRgb(hex).map(v => v + (255 - v) * amount))

/** The CSS custom properties for a brand colour; {} for none or an unusable one. */
export function deriveBrandTheme(hex) {
    if (!isReadableBrand(hex)) return {}
    const color = hex.toLowerCase()
    const [r, g, b] = toRgb(color)
    return {
        '--primary': color,
        '--primary-hover': shade(color, 0.18),
        '--primary-text': color,
        '--primary-surface': tint(color, 0.86),
        '--primary-light': `rgba(${r}, ${g}, ${b}, 0.1)`,
        '--portal-accent': color,
        '--portal-accent-light': tint(color, 0.9),
        '--chrome-from': color,
        '--chrome-to': shade(color, 0.32),
        '--sidebar': color,
        '--sidebar-accent': shade(color, 0.18),
    }
}

let applied = []

/** Put a school's colour on the page, replacing any earlier one. No colour restores the product's. */
export function applyBrandTheme(hex) {
    const root = document.documentElement
    applied.forEach(name => root.style.removeProperty(name))
    const theme = deriveBrandTheme(hex)
    applied = Object.keys(theme)
    applied.forEach(name => root.style.setProperty(name, theme[name]))
}
