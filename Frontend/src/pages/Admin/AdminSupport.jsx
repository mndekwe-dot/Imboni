import { useState, useEffect, useCallback } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { useNotifications } from '../../hooks/useNotifications'
import { useToast } from '../../context/ToastContext'
import { errorMessage } from '../../utils/errors'
import { getMyTickets, raiseTicket, replyMyTicket } from '../../api/support'
import { adminNavItems, adminSecondaryItems, adminUser } from './adminNav'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/admin.css'

const STATUS_META = {
    open:        { label: 'Open',        color: '#d97706' },
    in_progress: { label: 'In progress', color: 'var(--primary)' },
    resolved:    { label: 'Resolved',    color: 'var(--success, #16a34a)' },
    closed:      { label: 'Closed',      color: 'var(--muted-foreground)' },
}
const label = s => s.replace('_', ' ')

function StatusPill({ status }) {
    const m = STATUS_META[status] || { label: status, color: 'var(--muted-foreground)' }
    return <span style={{ fontSize: '0.75rem', fontWeight: 600, color: m.color, textTransform: 'capitalize' }}>● {m.label}</span>
}

export function AdminSupport() {
    const { notifications: liveNotifications, markRead } = useNotifications()
    const toast = useToast()
    const [tickets, setTickets] = useState([])
    const [loading, setLoading] = useState(true)
    const [form, setForm]       = useState({ subject: '', priority: 'normal', body: '' })
    const [saving, setSaving]   = useState(false)
    const [openId, setOpenId]   = useState(null)
    const [reply, setReply]     = useState('')
    const [replying, setReplying] = useState(false)

    const load = useCallback(async () => {
        setLoading(true)
        try { setTickets(await getMyTickets()) }
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

    async function sendReply(ticket) {
        if (!reply.trim()) return
        setReplying(true)
        try {
            const updated = await replyMyTicket(ticket.id, reply.trim())
            setTickets(list => list.map(t => (t.id === updated.id ? updated : t)))
            setReply('')
            toast.success('Reply sent.')
        } catch (e) { toast.error(errorMessage(e, 'Could not send your reply.')) }
        finally { setReplying(false) }
    }

    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={adminNavItems} secondaryItems={adminSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title="Support"
                        subtitle="Get help from the Imboni team"
                        {...adminUser}
                        notifications={liveNotifications}
                        onNotificationRead={markRead}
                    />
                    <DashboardContent>
                        {/* New ticket */}
                        <div className="card" style={{ marginBottom: '1.5rem' }}>
                            <div className="card-content">
                                <h3 style={{ fontWeight: 700, marginBottom: '1rem' }}>Contact support</h3>
                                <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                                    <div style={{ display: 'flex', gap: '0.85rem', flexWrap: 'wrap' }}>
                                        <label style={{ flex: '2 1 260px', display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.8rem', fontWeight: 600 }}>
                                            Subject
                                            <input className="form-input" required value={form.subject} onChange={e => set('subject', e.target.value)} placeholder="Brief summary of the issue" />
                                        </label>
                                        <label style={{ flex: '1 1 140px', display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.8rem', fontWeight: 600 }}>
                                            Priority
                                            <select className="form-input" value={form.priority} onChange={e => set('priority', e.target.value)}>
                                                <option value="low">Low</option><option value="normal">Normal</option>
                                                <option value="high">High</option><option value="urgent">Urgent</option>
                                            </select>
                                        </label>
                                    </div>
                                    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.8rem', fontWeight: 600 }}>
                                        Message
                                        <textarea className="form-input" rows={4} required value={form.body} onChange={e => set('body', e.target.value)} placeholder="Describe what's happening…" />
                                    </label>
                                    <div>
                                        <button className="btn btn-primary" disabled={saving}>{saving ? 'Submitting…' : 'Submit ticket'}</button>
                                    </div>
                                </form>
                            </div>
                        </div>

                        {/* My tickets */}
                        <h3 style={{ fontWeight: 700, marginBottom: '0.75rem' }}>Your tickets</h3>
                        {loading ? (
                            <p style={{ color: 'var(--muted-foreground)' }}>Loading…</p>
                        ) : tickets.length === 0 ? (
                            <p style={{ color: 'var(--muted-foreground)' }}>You haven't raised any tickets yet.</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {tickets.map(t => {
                                    const isOpen = openId === t.id
                                    return (
                                        <div key={t.id} className="card">
                                            <div className="card-content" style={{ cursor: 'pointer' }} onClick={() => { setOpenId(isOpen ? null : t.id); setReply('') }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                                                    <div>
                                                        <p style={{ fontWeight: 600 }}>{t.subject}</p>
                                                        <p style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)', textTransform: 'capitalize' }}>
                                                            {t.priority} priority · {new Date(t.created_at).toLocaleDateString()}
                                                        </p>
                                                    </div>
                                                    <StatusPill status={t.status} />
                                                </div>

                                                {isOpen && (
                                                    <div onClick={e => e.stopPropagation()} style={{ marginTop: '1rem', borderTop: '1px solid var(--border, #e5e7eb)', paddingTop: '1rem' }}>
                                                        <p style={{ whiteSpace: 'pre-wrap', marginBottom: '0.75rem' }}>{t.body}</p>
                                                        {t.replies?.map(r => (
                                                            <div key={r.id} style={{
                                                                marginBottom: '0.5rem', padding: '0.6rem 0.8rem', borderRadius: '8px',
                                                                background: r.author_type === 'operator' ? 'rgba(79,70,229,0.08)' : 'var(--muted, #f3f4f6)',
                                                            }}>
                                                                <p style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', fontWeight: 600, marginBottom: '0.2rem' }}>
                                                                    {r.author_type === 'operator' ? 'Imboni Support' : (r.author_name || 'You')}
                                                                </p>
                                                                <p style={{ whiteSpace: 'pre-wrap', fontSize: '0.9rem' }}>{r.body}</p>
                                                            </div>
                                                        ))}
                                                        {t.status !== 'closed' && (
                                                            <div style={{ marginTop: '0.75rem' }}>
                                                                <textarea className="form-input" rows={2} placeholder="Add a reply…" value={reply} onChange={e => setReply(e.target.value)} />
                                                                <button className="btn btn-primary" style={{ marginTop: '0.5rem' }} disabled={replying || !reply.trim()} onClick={() => sendReply(t)}>
                                                                    {replying ? 'Sending…' : 'Send reply'}
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
