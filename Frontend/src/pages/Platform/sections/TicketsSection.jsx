import { useState, useEffect, useCallback } from 'react'
import { getTickets, getTicket, replyTicket, setTicketStatus } from '../../../api/platform'
import { useToast } from '../../../context/ToastContext'
import { errorMessage } from '../../../utils/errors'

const STATUS_CLS = { open: 'warn', in_progress: 'info', resolved: 'ok', closed: 'bad' }
const PRIORITY_CLS = { low: 'info', normal: 'info', high: 'warn', urgent: 'bad' }
const FILTERS = [['', 'All'], ['open', 'Open'], ['in_progress', 'In progress'], ['resolved', 'Resolved'], ['closed', 'Closed']]
const label = s => s.replace('_', ' ')

export function TicketsSection() {
    const toast = useToast()
    const [tickets, setTickets] = useState([])
    const [filter, setFilter]   = useState('')
    const [loading, setLoading] = useState(true)
    const [selected, setSelected] = useState(null)
    const [reply, setReply]     = useState('')
    const [busy, setBusy]       = useState(false)

    const load = useCallback(async () => {
        setLoading(true)
        try { setTickets(await getTickets(filter)) }
        catch (e) { toast.error(errorMessage(e, 'Could not load tickets.')) }
        finally { setLoading(false) }
    }, [toast, filter])
    useEffect(() => { load() }, [load])

    async function open(id) {
        try { setSelected(await getTicket(id)); setReply('') }
        catch (e) { toast.error(errorMessage(e, 'Could not open the ticket.')) }
    }

    async function sendReply(e) {
        e.preventDefault()
        if (!reply.trim()) return
        setBusy(true)
        try {
            const updated = await replyTicket(selected.id, reply.trim())
            setSelected(updated); setReply('')
            setTickets(list => list.map(t => (t.id === updated.id ? { ...t, status: updated.status } : t)))
            toast.success('Reply sent.')
        } catch (err) { toast.error(errorMessage(err, 'Could not send the reply.')) }
        finally { setBusy(false) }
    }

    async function changeStatus(status) {
        setBusy(true)
        try {
            const updated = await setTicketStatus(selected.id, status)
            setSelected(updated)
            setTickets(list => list.map(t => (t.id === updated.id ? { ...t, status } : t)))
            toast.success(`Marked ${label(status)}.`)
        } catch (e) { toast.error(errorMessage(e, 'Could not change the status.')) }
        finally { setBusy(false) }
    }

    return (
        <div className="platform-tickets">
            {/* Inbox */}
            <div className="card platform-ticket-list">
                <div className="card-content">
                    <div className="platform-panel-head">
                        <h2>Support</h2>
                        <select className="form-input platform-input-sm" value={filter} onChange={e => setFilter(e.target.value)}>
                            {FILTERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                    </div>
                    {loading ? (
                        <p className="platform-muted">Loading…</p>
                    ) : tickets.length === 0 ? (
                        <p className="platform-muted">No tickets.</p>
                    ) : tickets.map(t => (
                        <button key={t.id} className={`platform-ticket-row ${selected?.id === t.id ? 'is-active' : ''}`} onClick={() => open(t.id)}>
                            <div className="platform-ticket-row-top">
                                <span className="platform-strong">{t.subject}</span>
                                <span className={`platform-chip platform-chip-${STATUS_CLS[t.status]}`}>{label(t.status)}</span>
                            </div>
                            <div className="platform-ticket-row-sub">
                                <span className={`platform-chip platform-chip-${PRIORITY_CLS[t.priority]}`}>{t.priority}</span>
                                <span className="platform-muted">{t.school_name} · {t.reply_count} repl{t.reply_count === 1 ? 'y' : 'ies'}</span>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Detail / thread */}
            <div className="card platform-ticket-detail">
                <div className="card-content">
                    {!selected ? (
                        <p className="platform-muted">Select a ticket to view the conversation.</p>
                    ) : (
                        <>
                            <div className="platform-panel-head">
                                <h2>{selected.subject}</h2>
                                <span className={`platform-chip platform-chip-${STATUS_CLS[selected.status]}`}>{label(selected.status)}</span>
                            </div>
                            <p className="platform-muted pf-tight">
                                {selected.school_name} · {selected.raised_by_name || selected.raised_by_email}
                                {selected.raised_by_role ? ` (${selected.raised_by_role})` : ''}
                            </p>

                            <div className="platform-thread">
                                <div className="platform-msg platform-msg-school">
                                    <div className="platform-msg-who">{selected.raised_by_name || 'School'}</div>
                                    <div className="platform-msg-body">{selected.body}</div>
                                </div>
                                {selected.replies.map(r => (
                                    <div key={r.id} className={`platform-msg platform-msg-${r.author_type}`}>
                                        <div className="platform-msg-who">{r.author_type === 'operator' ? 'You' : (r.author_name || 'School')}</div>
                                        <div className="platform-msg-body">{r.body}</div>
                                    </div>
                                ))}
                            </div>

                            <form onSubmit={sendReply}>
                                <textarea className="form-input" rows={3} placeholder="Write a reply…" value={reply} onChange={e => setReply(e.target.value)} />
                                <div className="platform-reply-actions">
                                    <div className="platform-status-actions">
                                        {selected.status !== 'resolved' && <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => changeStatus('resolved')}>Resolve</button>}
                                        {selected.status !== 'closed'   && <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => changeStatus('closed')}>Close</button>}
                                        {selected.status !== 'open'     && <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => changeStatus('open')}>Re-open</button>}
                                    </div>
                                    <button type="submit" className="btn btn-primary btn-sm" disabled={busy || !reply.trim()}>Send reply</button>
                                </div>
                            </form>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
