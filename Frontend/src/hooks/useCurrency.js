import { useSchoolSettings } from './useSchoolSetting'

/**
 * The ISO 4217 code the school bills in, from school settings.
 *
 * Amounts used to be formatted with a literal — 'RWF' on most screens and
 * 'KES' in the payment modal — so the two disagreed and a school outside
 * Rwanda had no way to correct either. Schools now set this themselves.
 *
 * Falls back to RWF, matching the model default, so a school that has not
 * touched the setting behaves exactly as before.
 */
export function useCurrency() {
    const { setting } = useSchoolSettings()
    return setting?.currency || 'RWF'
}

/**
 * "RWF 580,000" — an amount rendered in the school's currency.
 *
 * Kept next to useCurrency so every screen formats money the same way. Returns
 * an empty string for null/undefined rather than "RWF NaN".
 */
export function formatMoney(amount, currency = 'RWF') {
    if (amount === null || amount === undefined || amount === '') return ''
    const n = typeof amount === 'number' ? amount : Number(String(amount).replace(/[^0-9.-]/g, ''))
    if (Number.isNaN(n)) return ''
    return `${currency} ${n.toLocaleString()}`
}
