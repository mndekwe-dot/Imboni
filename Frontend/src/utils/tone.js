/**
 * A status word -> the tone that carries its colour.
 *
 * There were five families saying the same five things: `fin-status-*`,
 * `fin-expense-*`, `fin-payroll-*`, `fin-budget-*`, `lib-count-*`. Twenty
 * rules doing five jobs, and every new domain added five more -- so "pending"
 * was amber on the expenses page and grey on the payroll one for no reason
 * anybody chose.
 *
 * The word means the same thing wherever it appears, so it is mapped once. A
 * domain that needs a word this table does not have adds the WORD here rather
 * than a new family of colours.
 */
const TONES = {
    // Done, settled, arrived.
    paid: 'ok', cleared: 'ok', closed: 'ok', received: 'ok',
    found: 'ok', complete: 'ok', returned: 'ok',

    // Waiting on somebody, or only part-way there.
    pending: 'warn', partial: 'warn', submitted: 'warn', low: 'warn',

    // Live and in order: the neutral "this is fine and in progress" state,
    // which takes the portal's own accent rather than a colour of its own.
    approved: 'info', due: 'info', open: 'info', active: 'info', issued: 'info',

    // Against you.
    overdue: 'danger', rejected: 'danger', declined: 'danger',
    missing: 'danger', lost: 'danger', damaged: 'danger', over: 'danger',

    // Not yet real, or no longer running. Inert rather than wrong -- a
    // cancelled payroll run is not an error, it is a run that stopped.
    draft: 'muted', cancelled: 'muted', abandoned: 'muted',
    archived: 'muted', inactive: 'muted', retired: 'muted',
}

/**
 * `pill` / `badge` classes for a status.
 *
 *   <span className={pill(run.status)}>          -> "pill pill-ok"
 *   <span className={badge(fee.status)}>         -> "badge badge pill-warn"
 *
 * An unknown status gets the muted tone rather than no class, so a value the
 * backend adds later is legible instead of invisible.
 */
export function toneOf(status) {
    return TONES[String(status ?? '').toLowerCase()] ?? 'muted'
}

export function pill(status) {
    return `pill pill-${toneOf(status)}`
}

export function badge(status) {
    return `badge pill-${toneOf(status)}`
}
