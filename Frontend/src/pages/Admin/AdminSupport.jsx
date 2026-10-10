import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { Modal } from '../../components/ui/Modal'
import { useNotifications } from '../../hooks/useNotifications'
import { getMyTickets, raiseTicket, replyMyTicket } from '../../api/support'
import { toList } from '../../api/client'
import { adminNavItems, adminSecondaryItems, adminUser } from './adminNav'
import { formatDate } from '../../utils/date'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/admin.css'
import '../../styles/support.css'
import { useToast } from '../../context/ToastContext'
import { errorMessage } from '../../utils/errors'
import { asButton } from '../../utils/a11y'
import { SkeletonCards } from '../../components/ui/Skeleton'

const STATUS_LABEL = { open: 'Open', in_progress: 'In progress', resolved: 'Resolved', closed: 'Closed' }

function StatusPill({ status }) {
    return <span className={`support-status support-status-${status}`}>● {STATUS_LABEL[status] || status}</span>
}

function TicketModal({ ticket, onClose, onReplied }) {
    const { t } = useTranslation()
    const toast = useToast()
    const [reply, setReply] = useState('')
    const [busy, setBusy] = useState(false)

    async function send() {
        if (!reply.trim()) return
        setBusy(true)
        try {
            const updated = await replyMyTicket(ticket.id, reply.trim())
            onReplied(updated)
            setReply('')
            toast.success('Reply sent.')
        } catch (e) { toast.error(errorMessage(e, 'Could not send your reply.')) }
        finally { setBusy(false) }
    }

    const footer = ticket.status !== 'closed' ? (
        <button className="btn btn-primary" disabled={busy || !reply.trim()} onClick={send}>
            {busy ? 'Sending…' : 'Send reply'}
        </button>
    ) : null

    return (
        <Modal title={ticket.subject} icon="support_agent" onClose={onClose} footer={footer}>
            <div className="support-row">
                <StatusPill status={ticket.status} />
                <span className="support-ticket-meta support-right">{ticket.priority} priority</span>
            </div>

            <div className="support-thread">
                <div className="support-msg support-msg-you">
                    <div className="support-msg-who">You</div>
                    <div className="support-msg-body">{ticket.body}</div>
                </div>
                {ticket.replies?.map(r => (
                    <div key={r.id} className={`support-msg support-msg-${r.author_type === 'operator' ? 'operator' : 'you'}`}>
                        <div className="support-msg-who">{r.author_type === 'operator' ? 'Imboni Support' : (r.author_name || 'You')}</div>
                        <div className="support-msg-body">{r.body}</div>
                    </div>
                ))}
            </div>

            {ticket.status !== 'closed' && (
                <div className="support-reply">
                    <textarea className="form-input" rows={3} placeholder={t('admin.copy.addAReply')} value={reply} onChange={e => setReply(e.target.value)}  aria-label={t('admin.copy.addAReply')}/>
                </div>
            )}
        </Modal>
    )
}

export function AdminSupport() {
    const { t } = useTranslation()
    const { notifications: liveNotifications, markRead } = useNotifications()
    const toast = useToast()
    const [tickets, setTickets] = useState([])
    const [loading, setLoading] = useState(true)
    const [form, setForm]       = useState({ subject: '', priority: 'normal', body: '' })
    const [saving, setSaving]   = useState(false)
    const [active, setActive]   = useState(null)

    const load = useCallback(async () => {
        setLoading(true)
        try { setTickets(toList(await getMyTickets())) }
        catch (e) { toast.error(errorMessage(e, 'Could not load your tickets.')) }
        finally { setLoading(false) }
    }, [toast])
    useEffect(() => { load() }, [load])

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

    async function submit(e) {
        e.preventDefault()
        if (!form.subject.trim() || !form.body.trim()) return
        setSaving(true)
        try {
            await raiseTicket(form)
            toast.success('Support ticket submitted. Our team will get back to you.')
            setForm({ subject: '', priority: 'normal', body: '' })
            load()
        } catch (err) { toast.error(errorMessage(err, 'Could not submit your ticket.')) }
        finally { setSaving(false) }
    }

    function onReplied(updated) {
        setTickets(list => list.map(t => (t.id === updated.id ? updated : t)))
        setActive(updated)
    }

    return (
        <>
            <a href="#main-content" className="skip-link">{t('common.skipToContent')}</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={adminNavItems} secondaryItems={adminSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title={t('nav.support')}
                        subtitle={t('admin.support.subtitle')}
                        {...adminUser}
                        notifications={liveNotifications}
                        onNotificationRead={markRead}
                    />
                    <DashboardContent>
                        {/* New ticket */}
                        <div className="card mb-1-5">
                            <div className="card-content">
                                <h3 className="support-h3">{t('admin.copy.contactSupport')}</h3>
                                <form onSubmit={submit} className="support-stack">
                                    <div className="support-form-row">
                                        <label className="support-field support-field-subject">
                                            {t('common.subject')}
                                            <input className="form-input" required value={form.subject} onChange={e => set('subject', e.target.value)} placeholder={t('admin.copy.briefSummaryOfTheIssue')} />
                                        </label>
                                        <label className="support-field support-field-priority">
                                            {t('common.priority')}
                                            <select className="form-input" value={form.priority} onChange={e => set('priority', e.target.value)}>
                                                <option value="low">Low</option><option value="normal">{t('admin.copy.normal')}</option>
                                                <option value="high">High</option><option value="urgent">{t('common.urgent')}</option>
                                            </select>
                                        </label>
                                    </div>
                                    <label className="support-field">
                                        {t('landing.contact.message')}
                                        <textarea className="form-input" rows={4} required value={form.body} onChange={e => set('body', e.target.value)} placeholder={t('admin.copy.describeWhatSHappening')} />
                                    </label>
                                    <div>
                                        <button className="btn btn-primary" disabled={saving}>{saving ? 'Submitting…' : 'Submit ticket'}</button>
                                    </div>
                                </form>
                            </div>
                        </div>

                        {/* My tickets */}
                        <h3 className="support-h3">{t('admin.copy.yourTickets')}</h3>
                        {loading ? (
                            <SkeletonCards count={2} lines={2} />
                        ) : tickets.length === 0 ? (
                            <p className="support-muted">You haven&apos;t raised any tickets yet.</p>
                        ) : (
                            <div className="support-stack">
                                {tickets.map(t => (
                                    <div key={t.id} className="card support-ticket" {...asButton(() => setActive(t))}>
                                        <div className="card-content">
                                            <div>
                                                <p className="support-ticket-title">{t.subject}</p>
                                                <p className="support-ticket-meta">{t.priority} priority · {formatDate(t.created_at)}</p>
                                            </div>
                                            <StatusPill status={t.status} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </DashboardContent>
                </main>
            </div>
            {active && <TicketModal ticket={active} onClose={() => setActive(null)} onReplied={onReplied} />}
        </>
    )
}
