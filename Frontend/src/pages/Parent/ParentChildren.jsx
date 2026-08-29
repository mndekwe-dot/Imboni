import { useState, useEffect } from 'react'
import { SkeletonList } from '../../components/ui/Skeleton'
import { ListSection } from '../../components/ui/ListSection'
import { EmptyState } from '../../components/ui/EmptyState'
import { useToast } from '../../context/ToastContext'
import { errorMessage } from '../../utils/errors'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
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
import '../../styles/tables.css'

/* Keys, not English. As literals the whole fee block stayed in English under
   the language switch, on a page a parent reads in their own language. */
const FEE_LABEL  = { cleared: 'common.cleared', due: 'common.due', overdue: 'common.overdue', partial: 'common.partial' }
const FEE_CLASS  = { cleared: 'status-paid', due: 'status-pending', overdue: 'status-pending', partial: 'status-pending' }

function feeStatus(t, fees = []) {
    return fees.map(f => ({
        label:      (f.category || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        value:      FEE_LABEL[f.status] ? t(FEE_LABEL[f.status]) : f.status,
        valueClass: FEE_CLASS[f.status]  || 'status-pending',
    }))
}

function ChildCard({ childId, card, fees, docs }) {
    const { t } = useTranslation()
    const { name, initials, grade, section, student_code, is_in_school, academic_focus, class_teacher } = card
    const gradeId = `${grade}${section} | ID: ${student_code}`
    const status    = is_in_school ? t('parent.children.inSchool') : t('parent.children.outOfSchool')
    const statusDot = is_in_school ? 'online' : 'offline'
    const feeRows   = feeStatus(t, fees)

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
                            <span className="material-symbols-rounded" aria-hidden="true">menu_book</span> {t('parent.children.academicFocus')}
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
                            <span className="material-symbols-rounded" aria-hidden="true">folder_open</span> {t('common.documents')}
                        </h4>
                        <div className="document-list">
                            {docs.map(doc => (
                                <a key={doc.id} href={doc.file || '#'} target="_blank" rel="noreferrer" className="doc-item">
                                    <span className="material-symbols-rounded" aria-hidden="true">picture_as_pdf</span>
                                    <span>{doc.title}</span>
                                </a>
                            ))}
                        </div>
                    </section>
                )}

                <hr className="divider" />

                {/* Both of these were dead. "Message <teacher>" was a bare
                    <button> with no handler, and beside it sat an icon-only
                    button with no label, no accessible name and nothing behind
                    it — the empty full-width bar under the card. They are links
                    now, and they go where they say. */}
                <div className="student-card-footer">
                    {class_teacher && (
                        <Link
                            to={`/parent/messages?with=${encodeURIComponent(class_teacher.id)}`}
                            className="btn btn-primary w-full"
                        >
                            <span className="material-symbols-rounded" aria-hidden="true">chat</span>
                            {t('parent.children.messageTeacher', { name: class_teacher.name })}
                        </Link>
                    )}
                    <Link to={`/parent/results?child=${encodeURIComponent(childId)}`} className="btn btn-outline w-full">
                        <span className="material-symbols-rounded" aria-hidden="true">insights</span>
                        {t('parent.children.viewResults')}
                    </Link>
                </div>
            </div>
        </div>
    )
}

function LoadingCard() {
    // Shaped like the child card that replaces it, so the grid does not
    // reflow when the real one arrives.
    return (
        <div className="card student-card pchild-loading-card">
            <SkeletonList items={1} />
        </div>
    )
}

function ConsentCard() {
    const { t } = useTranslation()
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
        <ListSection
            className="mb-1-5"
            icon="approval"
            title={t('parent.children.consentTitle')}
            count={pendingCount > 0 ? t('parent.children.pendingCount', { count: pendingCount }) : null}
        >
            <div>
                {loading ? (
                    <p className="u-muted">{t('parent.children.loadingConsent')}</p>
                ) : (
                    <div className="u-stack-sm">
                        {requests.map(req => (
                            <div key={req.id} className="pchild-consent-item">
                                <div className="pchild-consent-row">
                                    <div>
                                        <div className="pchild-consent-title">{req.title}</div>
                                        <div className="pchild-consent-sub">
                                            {req.event_date}
                                            {req.response_deadline && ` · ${t('parent.children.respondBy', { date: req.response_deadline })}`}
                                            {req.created_by && ` · ${t('parent.children.requestedBy', { name: req.created_by })}`}
                                        </div>
                                    </div>
                                </div>
                                <p className="pchild-consent-desc">{req.description}</p>
                                <div className="pchild-consent-children">
                                    {(req.children || []).map(child => {
                                        const key = `${req.id}|${child.student_id}`
                                        return (
                                            <div key={child.student_id} className="pchild-consent-child">
                                                <span className="pchild-consent-name">{child.student_name}</span>
                                                {child.status ? (
                                                    <span className="pchild-consent-status"
                                                        style={{ '--pchild-status': child.status === 'approved' ? 'var(--success)' : '#dc2626' }}>
                                                        <span className="material-symbols-rounded pchild-status-icon" aria-hidden="true">
                                                            {child.status === 'approved' ? 'check_circle' : 'cancel'}
                                                        </span>
                                                        {child.status === 'approved' ? t('common.approved') : t('common.declined')}
                                                    </span>
                                                ) : (
                                                    <span className="pchild-consent-actions">
                                                        <button className="btn btn-primary btn-sm"
                                                            disabled={busy === key}
                                                            onClick={() => respond(req.id, child.student_id, 'approved')}>
                                                            {t('common.approve')}
                                                        </button>
                                                        <button className="btn btn-outline btn-sm"
                                                            disabled={busy === key}
                                                            onClick={() => respond(req.id, child.student_id, 'declined')}>
                                                            {t('common.decline')}
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
        </ListSection>
    )
}

export function ParentChildren() {
    const { t } = useTranslation()
    const { notifications: liveNotifications, markRead } = useNotifications()
    const sessionUser = useSessionUser()
    const [children, setChildren] = useState([])
    const [cards,    setCards]    = useState({})
    const [fees,     setFees]     = useState({})
    const [docs,     setDocs]     = useState({})
    const [loading,  setLoading]  = useState(true)
    const toast = useToast()

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
            // A failure here left the page saying "no children linked", which
            // is a different and much more alarming thing than "this did not
            // load". See the error-handling convention.
            .catch(e => toast.error(errorMessage(e, t('parent.children.loadFailed'))))
            .finally(() => setLoading(false))
    }, [toast, t])

    return (
        <>
            <a href="#main-content" className="skip-link">{t('common.skipToContent')}</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={parentNavItems} secondaryItems={parentSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title={t('parent.children.title')}
                        subtitle={t('parent.children.subtitle')}
                        {...sessionUser}
                        notifications={liveNotifications}
                        onNotificationRead={markRead}
                    />
                    <DashboardContent>
                        <ConsentCard />
                        {/* The grid is in the same frame as the consent panel
                            above it, titled and counted, rather than floating
                            on the page background beneath a card. */}
                        <ListSection
                            icon="family_restroom"
                            title={t('parent.children.title')}
                            count={loading ? null : t('parent.children.childCount', { count: children.length })}
                        >
                            {loading ? (
                                <p className="u-muted">{t('parent.children.loadingChildren')}</p>
                            ) : children.length === 0 ? (
                                <EmptyState
                                    icon="family_restroom"
                                    title={t('parent.children.noneLinked')}
                                    description={t('parent.children.noneLinkedDesc')}
                                />
                            ) : (
                                <div className="student-grid">
                                    {children.map(c => (
                                        cards[c.id]
                                            ? <ChildCard key={c.id} childId={c.id} card={cards[c.id]} fees={fees[c.id] || []} docs={docs[c.id] || []} />
                                            : <LoadingCard key={c.id} />
                                    ))}
                                </div>
                            )}
                        </ListSection>
                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
