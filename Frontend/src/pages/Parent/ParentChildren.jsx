import { useState, useEffect } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useNotifications } from '../../hooks/useNotifications'
import { useSessionUser } from '../../hooks/useSessionUser'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { parentNavItems, parentSecondaryItems } from './parentNav'
import {
    getMyChildren, getChildCard, getChildFees, getChildDocuments,
    getConsentRequests, respondToConsent,
} from '../../api/parent'

function toList(data) {
    return Array.isArray(data) ? data : (data?.results ?? [])
}
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/parent.css'
import '../../styles/my-children.css'

const FEE_LABEL  = { cleared: 'Cleared', due: 'Due', overdue: 'Overdue', partial: 'Partial' }
const FEE_CLASS  = { cleared: 'status-paid', due: 'status-pending', overdue: 'status-pending', partial: 'status-pending' }

function feeStatus(fees = []) {
    return fees.map(f => ({
        label:      (f.category || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        value:      FEE_LABEL[f.status]  || f.status,
        valueClass: FEE_CLASS[f.status]  || 'status-pending',
    }))
}

function ChildCard({ card, fees, docs }) {
    const { name, initials, grade, section, student_code, is_in_school, academic_focus, class_teacher } = card
    const gradeId = `${grade}${section} | ID: ${student_code}`
    const status    = is_in_school ? 'In School' : 'Out of School'
    const statusDot = is_in_school ? 'online' : 'offline'
    const feeRows   = feeStatus(fees)

    return (
        <div className="card student-card">
            <div className="student-card-header">
                <div className="student-avatar-large">{initials}</div>
                <div className="student-meta">
                    <h3>{name}</h3>
                    <p className="student-id-tag">{gradeId}</p>
                </div>
                <div className="status-indicator">
                    <span className={`dot ${statusDot}`}></span>
                    <span className="status-text">{status}</span>
                </div>
            </div>

            <div className="card-content">
                {academic_focus?.length > 0 && (
                    <section className="detail-section">
                        <h4 className="section-title">
                            <span className="material-symbols-rounded">menu_book</span> Academic Focus
                        </h4>
                        <div className="subject-tags">
                            {academic_focus.map((s, i) => <span key={i} className="tag">{s}</span>)}
                        </div>
                    </section>
                )}

                {feeRows.length > 0 && (
                    <section className="detail-section financial-brief">
                        {feeRows.map((fee, i) => (
                            <div key={i} className="financial-row">
                                <span className="label">{fee.label}:</span>
                                <span className={`value ${fee.valueClass}`}>{fee.value}</span>
                            </div>
                        ))}
                    </section>
                )}

                {docs?.length > 0 && (
                    <section className="detail-section">
                        <h4 className="section-title">
                            <span className="material-symbols-rounded">folder_open</span> Documents
                        </h4>
                        <div className="document-list">
                            {docs.map(doc => (
                                <a key={doc.id} href={doc.file || '#'} target="_blank" rel="noreferrer" className="doc-item">
                                    <span className="material-symbols-rounded">picture_as_pdf</span>
                                    <span>{doc.title}</span>
                                </a>
                            ))}
                        </div>
                    </section>
                )}

                <hr className="divider" />

                <div className="student-card-footer">
                    {class_teacher && (
                        <button className="btn btn-primary w-full">
                            <span className="material-symbols-rounded">chat</span>
                            Message {class_teacher.name}
                        </button>
                    )}
                    <div className="footer-secondary-btns">
                        <button className="btn btn-outline btn-icon">
                            <span className="material-symbols-rounded">visibility</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

function LoadingCard() {
    return (
        <div className="card student-card" style={{ minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ color: 'var(--muted-foreground)' }}>Loading…</p>
        </div>
    )
}

function ConsentCard() {
    const [requests, setRequests] = useState([])
    const [loading, setLoading]   = useState(true)
    const [busy, setBusy]         = useState(null)   // "requestId|studentId"

    function load() {
        getConsentRequests()
            .then(data => setRequests(Array.isArray(data) ? data : []))
            .catch(() => setRequests([]))
            .finally(() => setLoading(false))
    }

    useEffect(() => { load() }, [])

    async function respond(requestId, studentId, status) {
        const key = `${requestId}|${studentId}`
        setBusy(key)
        try {
            await respondToConsent(requestId, { student_id: studentId, status })
            load()
        } finally {
            setBusy(null)
        }
    }

    const pendingCount = requests.reduce(
        (n, r) => n + (r.children || []).filter(c => !c.status).length, 0)

    if (!loading && requests.length === 0) return null

    return (
        <div className="card mb-1-5">
            <div className="card-header">
                <h2 className="card-title">
                    <span className="material-symbols-rounded" style={{ verticalAlign: 'middle', marginRight: '0.4rem' }}>approval</span>
                    Consent Requests
                </h2>
                {pendingCount > 0 && <span className="badge">{pendingCount} pending</span>}
            </div>
            <div className="card-content">
                {loading ? (
                    <p style={{ color: 'var(--muted-foreground)' }}>Loading consent requests…</p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {requests.map(req => (
                            <div key={req.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '0.75rem 1rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{req.title}</div>
                                        <div style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)', marginTop: '0.15rem' }}>
                                            {req.event_date}
                                            {req.response_deadline && ` · respond by ${req.response_deadline}`}
                                            {req.created_by && ` · from ${req.created_by}`}
                                        </div>
                                    </div>
                                </div>
                                <p style={{ fontSize: '0.83rem', margin: '0.5rem 0 0.75rem' }}>{req.description}</p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                    {(req.children || []).map(child => {
                                        const key = `${req.id}|${child.student_id}`
                                        return (
                                            <div key={child.student_id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                                                <span style={{ fontSize: '0.85rem', fontWeight: 500, minWidth: 140 }}>{child.student_name}</span>
                                                {child.status ? (
                                                    <span style={{
                                                        fontSize: '0.78rem', fontWeight: 600,
                                                        color: child.status === 'approved' ? 'var(--success)' : '#dc2626',
                                                        display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                                                    }}>
                                                        <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>
                                                            {child.status === 'approved' ? 'check_circle' : 'cancel'}
                                                        </span>
                                                        {child.status === 'approved' ? 'Approved' : 'Declined'}
                                                    </span>
                                                ) : (
                                                    <span style={{ display: 'flex', gap: '0.4rem' }}>
                                                        <button className="btn btn-primary btn-sm"
                                                            disabled={busy === key}
                                                            onClick={() => respond(req.id, child.student_id, 'approved')}>
                                                            Approve
                                                        </button>
                                                        <button className="btn btn-outline btn-sm"
                                                            disabled={busy === key}
                                                            onClick={() => respond(req.id, child.student_id, 'declined')}>
                                                            Decline
                                                        </button>
                                                    </span>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

export function ParentChildren() {
    const { notifications: liveNotifications, markRead } = useNotifications()
    const sessionUser = useSessionUser()
    const [children, setChildren] = useState([])
    const [cards,    setCards]    = useState({})
    const [fees,     setFees]     = useState({})
    const [docs,     setDocs]     = useState({})
    const [loading,  setLoading]  = useState(true)

    useEffect(() => {
        getMyChildren()
            .then(raw => {
                const list = toList(raw)
                setChildren(list)
                list.forEach(c => {
                    Promise.all([
                        getChildCard(c.id).catch(() => null),
                        getChildFees(c.id).catch(() => []),
                        getChildDocuments(c.id).catch(() => []),
                    ]).then(([card, feeData, docData]) => {
                        if (card) setCards(prev => ({ ...prev, [c.id]: card }))
                        setFees(prev => ({ ...prev, [c.id]: toList(feeData) }))
                        setDocs(prev => ({ ...prev, [c.id]: toList(docData) }))
                    })
                })
            })
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [])

    return (
        <>
            <div className="dashboard-layout">
                <Sidebar navItems={parentNavItems} secondaryItems={parentSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title="My Children"
                        subtitle="Overview of your children's profiles"
                        {...sessionUser}
                        notifications={liveNotifications}
                        onNotificationRead={markRead}
                    />
                    <DashboardContent>
                        <ConsentCard />
                        {loading ? (
                            <p style={{ padding: '2rem', color: 'var(--muted-foreground)' }}>Loading children…</p>
                        ) : children.length === 0 ? (
                            <p style={{ padding: '2rem', color: 'var(--muted-foreground)' }}>No children linked to your account.</p>
                        ) : (
                            <div className="student-grid">
                                {children.map(c => (
                                    cards[c.id]
                                        ? <ChildCard key={c.id} card={cards[c.id]} fees={fees[c.id] || []} docs={docs[c.id] || []} />
                                        : <LoadingCard key={c.id} />
                                ))}
                            </div>
                        )}
                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
