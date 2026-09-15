/**
 * An amount with its thousands grouped: 1,250,000 rather than 1250000.
 *
 * One place formats money so a figure reads the same on the dashboard, the
 * receipt, the debtor list and the staff register.
 */
export function formatAmount(value) {
    const amount = Number(value ?? 0)
    return Number.isFinite(amount)
        ? new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(amount)
        : '0'
}
