import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
    getTickets, getTicket, getTicketContext, replyTicket, setTicketStatus,
} from '../../../api/platform'
import { useToast } from '../../../context/ToastContext'
import { errorMessage } from '../../../utils/errors'
import { SkeletonList, SkeletonText } from '../../../components/ui/Skeleton'

const STATUS_CLS = { open: 'warn', in_progress: 'info', resolved: 'ok', closed: 'bad' }
const PRIORITY_CLS = { low: 'info', normal: 'info', high: 'warn', urgent: 'bad' }
const FILTERS = ['', 'open', 'in_progress', 'resolved', 'closed']

/**
 * The school, on the ticket.
 *
 * Everything here used to require leaving the ticket and looking somewhere
 * else -- and that lookup is the answer to most tickets. The two lines that
 * earn their place most often are `admin_can_sign_in` (a brand new school that
 * never opened its invitation) and `uncovered` (nobody has signed a contract),
 * because between them they explain the majority of what schools write in about.
 */
function SchoolContext({ data }) {
    const { t } = useTranslation()
    const c = (key, vars) => t(`platform.tickets.ctx.${key}`, vars)
    const statusWord = s => t(`platform.tickets.status.${s}`, { defaultValue: String(s).replace('_', ' ') })

    if (!data) return <SkeletonText lines={5} label={c('loading')} />
    if (!data.school) {
        return <p className="platform-muted pf-tight">{c('gone')}</p>
    }

    const { school, capacity, contract, last_payment: paid, invitation } = data
    const seats = (r) => {
        if (!r) return '-'
        return r.unlimited ? c('noLimit', { used: r.used }) : c('usedOf', { used: r.used, limit: r.limit })
    }
    const when = (iso) => (iso ? new Date(iso).toLocaleDateString() : c('never'))

    return (
        <div className="pf-callout pf-mb">
            <div className="pf-grid">
                <div>
                    <span className="pf-field-label">{c('plan')}</span>
                    <span className="pf-field-value pf-capitalize">
                        {t(`platform.common.plan.${school.plan}`, { defaultValue: school.plan })}{school.is_demo ? c('demo') : ''}
                    </span>
                </div>
                <div>
                    <span className="pf-field-label">{c('standing')}</span>
                    <span className="pf-field-value pf-capitalize">{t(`platform.common.status.${school.status}`, { defaultValue: statusWord(school.status) })}</span>
                </div>
                <div>
                    <span className="pf-field-label">{c('students')}</span>
                    <span className="pf-field-value">{seats(capacity?.resources?.students)}</span>
                </div>
                <div>
                    <span className="pf-field-label">{c('staff')}</span>
                    <span className="pf-field-value">{seats(capacity?.resources?.staff)}</span>
                </div>
                <div>
                    <span className="pf-field-label">{c('contract')}</span>
                    <span className="pf-field-value">
                        {contract
                            ? c('contractEnds', { date: when(contract.end_date), days: contract.days_remaining })
                            : c('noContract')}
                    </span>
                </div>
                <div>
                    <span className="pf-field-label">{c('lastPayment')}</span>
                    <span className="pf-field-value">
                        {paid ? c('paid', { currency: paid.currency, amount: paid.amount, days: paid.days_ago }) : c('none')}
                    </span>
                </div>
                <div>
                    <span className="pf-field-label">{c('lastLogin')}</span>
                    <span className="pf-field-value">{when(data.last_staff_login)}</span>
                </div>
                <div>
                    <span className="pf-field-label">{c('openTickets')}</span>
                    <span className="pf-field-value">{data.open_tickets}</span>
                </div>
            </div>

            {/* The two facts that answer most tickets on their own. */}
            {data.admin_can_sign_in === false && (
                <p className="pf-hint platform-danger">
                    {c('neverSetPassword', { state: invitation ? c('inviteIs', { state: invitation.state }) : c('inviteNever') })}
                </p>
            )}
            {data.uncovered && (
                <p className="pf-hint">{c('uncovered')}</p>
            )}
            {data.reachable === false && (
                <p className="pf-hint platform-danger">{c('unreachable')}</p>
            )}
        </div>
    )
}

export function TicketsSection() {
    const { t } = useTranslation()
    const toast = useToast()
    const [tickets, setTickets] = useState([])
    const [filter, setFilter]   = useState('')
    const [loading, setLoading] = useState(true)
    const [selected, setSelected] = useState(null)
    const [context, setContext] = useState(null)
    const [reply, setReply]     = useState('')
    const [busy, setBusy]       = useState(false)
    const k = key => t(`platform.tickets.${key}`)
    const statusWord = s => t(`platform.tickets.status.${s}`, { defaultValue: String(s).replace('_', ' ') })

    const load = useCallback(async () => {
        setLoading(true)
        try { setTickets(await getTickets(filter)) }
        catch (e) { toast.error(errorMessage(e, t('platform.tickets.loadFailed'))) }
        finally { setLoading(false) }
    }, [toast, filter, t])
    useEffect(() => { load() }, [load])

    async function open(id) {
        setContext(null)
        try { setSelected(await getTicket(id)); setReply('') }
        catch (e) { return toast.error(errorMessage(e, k('openFailed'))) }

        // Fetched separately and after the ticket: the thread is what the
        // operator came to read, and it should not wait on a summary that
        // reaches into another schema to build itself.
        try { setContext(await getTicketContext(id)) }
        catch { setContext({ school: null }) }
    }

    async function sendReply(e) {
        e.preventDefault()
        if (!reply.trim()) return
        setBusy(true)
        try {
            const updated = await replyTicket(selected.id, reply.trim())
            setSelected(updated); setReply('')
            setTickets(list => list.map(x => (x.id === updated.id ? { ...x, status: updated.status } : x)))
            toast.success(k('replySent'))
        } catch (err) { toast.error(errorMessage(err, k('replyFailed'))) }
        finally { setBusy(false) }
    }

    async function changeStatus(status) {
        setBusy(true)
        try {
            const updated = await setTicketStatus(selected.id, status)
            setSelected(updated)
            setTickets(list => list.map(x => (x.id === updated.id ? { ...x, status } : x)))
            toast.success(t('platform.tickets.marked', { status: statusWord(status) }))
        } catch (e) { toast.error(errorMessage(e, k('statusFailed'))) }
        finally { setBusy(false) }
    }

    return (
        <div className="platform-tickets">
            {/* Inbox */}
            <div className="card platform-ticket-list">
                <div className="card-content">
                    <div className="platform-panel-head">
                        <h2>{k('title')}</h2>
                        <select className="form-input platform-input-sm" value={filter} onChange={e => setFilter(e.target.value)}
                                aria-label={k('filterLabel')}>
                            {FILTERS.map(v => <option key={v} value={v}>{k(`filters.${v || 'all'}`)}</option>)}
                        </select>
                    </div>
                    {loading ? (
                        <SkeletonList items={3} />
                    ) : tickets.length === 0 ? (
                        <p className="platform-muted">{k('none')}</p>
                    ) : tickets.map(tk => (
                        <button key={tk.id} className={`platform-ticket-row ${selected?.id === tk.id ? 'is-active' : ''}`} onClick={() => open(tk.id)}>
                            <div className="platform-ticket-row-top">
                                <span className="platform-strong">{tk.subject}</span>
                                <span className={`platform-chip platform-chip-${STATUS_CLS[tk.status]}`}>{statusWord(tk.status)}</span>
                            </div>
                            <div className="platform-ticket-row-sub">
                                <span className={`platform-chip platform-chip-${PRIORITY_CLS[tk.priority]}`}>{t(`platform.tickets.priority.${tk.priority}`, { defaultValue: tk.priority })}</span>
                                <span className="platform-muted">{tk.school_name} · {t('platform.tickets.replies', { count: tk.reply_count })}</span>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Detail / thread */}
            <div className="card platform-ticket-detail">
                <div className="card-content">
                    {!selected ? (
                        <p className="platform-muted">{k('pickOne')}</p>
                    ) : (
                        <>
                            <div className="platform-panel-head">
                                <h2>{selected.subject}</h2>
                                <span className={`platform-chip platform-chip-${STATUS_CLS[selected.status]}`}>{statusWord(selected.status)}</span>
                            </div>
                            <p className="platform-muted pf-tight">
                                {selected.school_name} · {selected.raised_by_name || selected.raised_by_email}
                                {selected.raised_by_role ? ` (${selected.raised_by_role})` : ''}
                            </p>

                            <SchoolContext data={context} />

                            <div className="platform-thread">
                                <div className="platform-msg platform-msg-school">
                                    <div className="platform-msg-who">{selected.raised_by_name || k('school')}</div>
                                    <div className="platform-msg-body">{selected.body}</div>
                                </div>
                                {selected.replies.map(r => (
                                    <div key={r.id} className={`platform-msg platform-msg-${r.author_type}`}>
                                        <div className="platform-msg-who">{r.author_type === 'operator' ? k('you') : (r.author_name || k('school'))}</div>
                                        <div className="platform-msg-body">{r.body}</div>
                                    </div>
                                ))}
                            </div>

                            <form onSubmit={sendReply}>
                                <textarea className="form-input" rows={3} placeholder={k('writeReply')} value={reply} onChange={e => setReply(e.target.value)} aria-label={k('writeReply')} />
                                <div className="platform-reply-actions">
                                    <div className="platform-status-actions">
                                        {selected.status !== 'resolved' && <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => changeStatus('resolved')}>{k('resolve')}</button>}
                                        {selected.status !== 'closed'   && <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => changeStatus('closed')}>{k('close')}</button>}
                                        {selected.status !== 'open'     && <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => changeStatus('open')}>{k('reopen')}</button>}
                                    </div>
                                    <button type="submit" className="btn btn-primary btn-sm" disabled={busy || !reply.trim()}>{k('sendReply')}</button>
                                </div>
                            </form>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
