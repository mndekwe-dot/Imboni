import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useNotifications } from '../../hooks/useNotifications'
import { useCurrentTerm } from '../../hooks/useCurrentTerm'
import { StatCard } from '../../components/layout/StatCard'
import { AdminPaymentModal } from '../../components/modals/AdminPaymentModal'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/admin.css'
import { adminNavItems, adminSecondaryItems, adminUser } from './adminNav'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { sendFeeReminders, getFeesOverview, getOutstandingFees } from '../../api/admin'
import { useCurrency, formatMoney } from '../../hooks/useCurrency'
import { formatDate } from '../../utils/date'


// This page previously ran on three hardcoded arrays — invented students,
// amounts and per-class collection rates — shown to every school as if real.
// Totals and outstanding fees now come from the analytics endpoints that
// already existed. There is no per-class collection endpoint, so that panel
// was removed rather than kept on fabricated numbers.

function initialsOf(name = '') {
    return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')
}

function FeeRow({ student_name, student_code, category, amount, due_date, status, currency }) {
    return (
        <tr>
            <td>
                <div className="adm-cell">
                    <div className="adm-av">{initialsOf(student_name)}</div>
                    <div>
                        <div className="adm-name">{student_name}</div>
                        <div className="adm-sub">{student_code}</div>
                    </div>
                </div>
            </td>
            <td>{formatMoney(amount, currency)}</td>
            <td>{category}</td>
            <td>{formatDate(due_date)}</td>
            <td><span className={`adm-badge ${status}`}>{status}</span></td>
        </tr>
    )
}

export function AdminFinance() {
    const { t } = useTranslation()
    const { term } = useCurrentTerm()
    const { notifications: liveNotifications, markRead } = useNotifications()
    const currency = useCurrency()
    const [overview, setOverview]         = useState(null)
    const [outstanding, setOutstanding]   = useState([])
    const [loadingFees, setLoadingFees]   = useState(true)
    const [feesError, setFeesError]       = useState(false)
    const [statusFilter, setStatusFilter] = useState('All')
    const [showPayment, setShowPayment] = useState(false)
    const [exportMsg, setExportMsg]     = useState('')

    useEffect(() => {
        let cancelled = false
        Promise.all([
            getFeesOverview().catch(() => null),
            getOutstandingFees().catch(() => []),
        ]).then(([ov, out]) => {
            if (cancelled) return
            // Both endpoints 404 when no term is marked current — a real state
            // for a school mid-setup, not an error to hide behind zeros.
            if (!ov) setFeesError(true)
            setOverview(ov)
            setOutstanding(Array.isArray(out) ? out : (out?.results ?? []))
        }).finally(() => { if (!cancelled) setLoadingFees(false) })
        return () => { cancelled = true }
    }, [])

    const filtered = statusFilter === 'All'
        ? outstanding
        : outstanding.filter(f => (f.status || '').toLowerCase() === statusFilter.toLowerCase())

    function handleAddPayment() {
        // Re-read rather than splicing a local row in: the server decides what
        // the fee's new status and outstanding balance are.
        getOutstandingFees().then(out =>
            setOutstanding(Array.isArray(out) ? out : (out?.results ?? []))).catch(() => {})
    }

    const stats = overview ? [
        { icon: 'payments',     value: formatMoney(overview.total_billed, currency),
          label: t('admin.finance.totalExpected'), trend: overview.term || '', colorClass: '' },
        { icon: 'check_circle', value: formatMoney(overview.total_collected, currency),
          label: t('admin.finance.collected'),
          trend: t('admin.finance.ofTarget', { rate: overview.collection_rate }), colorClass: 'success' },
        { icon: 'pending',      value: formatMoney(overview.total_outstanding, currency),
          label: t('admin.finance.outstanding'),
          trend: t('admin.finance.overdueCount', { count: overview.overdue_count ?? 0 }), colorClass: 'warning' },
    ] : []

    function handleExport() {
        setExportMsg('Exported!')
        setTimeout(() => setExportMsg(''), 2000)
    }

    const [reminderState, setReminderState] = useState({ sending: false, message: '' })

    async function handleSendReminder() {
        if (reminderState.sending) return
        setReminderState({ sending: true, message: '' })
        try {
            const res = await sendFeeReminders()
            setReminderState({
                sending: false,
                message: `Reminded ${res.parents_notified} parent${res.parents_notified === 1 ? '' : 's'} (${res.students} student${res.students === 1 ? '' : 's'})`,
            })
        } catch {
            setReminderState({ sending: false, message: 'Failed to send reminders.' })
        }
        setTimeout(() => setReminderState(s => ({ ...s, message: '' })), 4000)
    }

    return (
        <>
            {showPayment && (
                <AdminPaymentModal onClose={() => setShowPayment(false)} onSave={handleAddPayment} />
            )}

            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={adminNavItems} secondaryItems={adminSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title={t('admin.finance.title')}
                        subtitle={term
                            ? t('admin.finance.subtitleWithTerm', { term: term.name, year: term.year })
                            : t('admin.finance.subtitle')}
                        userName={adminUser.userName}
                        userRole={adminUser.userRole}
                        userInitials={adminUser.userInitials}
                        avatarClass={adminUser.avatarClass}
                        notifications={liveNotifications}
                        onNotificationRead={markRead}
                    />
                    <DashboardContent>

                        <div className="portal-stat-grid">
                            {stats.map((s, i) => <StatCard key={i} {...s} />)}
                        </div>

                        <div className="adm-finance-grid">

                            {/* Left: transactions table */}
                            <div className="card">
                                <div className="card-header">
                                    <h2 className="card-title">{t('admin.finance.outstandingTitle')} ({filtered.length})</h2>
                                    <button className="btn btn-outline btn-sm" onClick={handleExport}>
                                        <span className="material-symbols-rounded" aria-hidden="true">download</span>
                                        {exportMsg || 'Export'}
                                    </button>
                                </div>
                                <div className="card-content">
                                    {/* Status filter chips */}
                                    <div className="filter-chips">
                                        {['All', 'Due', 'Partial', 'Overdue'].map(f => (
                                            <button
                                                key={f}
                                                className={`filter-chip${statusFilter === f ? ' active' : ''}`}
                                                onClick={() => setStatusFilter(f)}
                                            >{f}</button>
                                        ))}
                                    </div>
                                    <div className="data-table-wrap">
                                        <table className="data-table">
                                            <thead>
                                                <tr>
                                                    <th>{t('admin.finance.student')}</th>
                                                    <th>{t('common.amount')}</th>
                                                    <th>{t('admin.finance.category')}</th>
                                                    <th>{t('admin.finance.dueDate')}</th>
                                                    <th>{t('common.status')}</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {loadingFees ? (
                                                    <tr><td colSpan={5} className="td-empty">{t('admin.finance.loading')}</td></tr>
                                                ) : feesError ? (
                                                    <tr><td colSpan={5} className="td-empty">{t('admin.finance.unavailable')}</td></tr>
                                                ) : filtered.length > 0 ? (
                                                    filtered.map((f, i) => <FeeRow key={i} {...f} currency={currency} />)
                                                ) : (
                                                    <tr><td colSpan={5} className="td-empty">{t('admin.finance.noOutstanding')}</td></tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>

                            {/* Right: collection by class + quick actions */}
                            <div className="card">
                                <div className="card-header">
                                    <h2 className="card-title">{t('admin.finance.quickActions')}</h2>
                                </div>
                                <div className="card-content">
                                    {/* "Collection by Class" lived here on six invented
                                        percentages. There is no per-class collection
                                        endpoint, so the panel is gone rather than lying. */}
                                    <div className="quick-actions-section">
                                        <div className="quick-actions-btns">
                                            <button
                                                className="btn btn-outline btn-sm btn-left"
                                                onClick={handleSendReminder}
                                                disabled={reminderState.sending}
                                            >
                                                <span className="material-symbols-rounded" aria-hidden="true">mail</span>
                                                {reminderState.sending
                                                    ? 'Sending…'
                                                    : reminderState.message || 'Send Fee Reminder to All Overdue'}
                                            </button>
                                            <button className="btn btn-outline btn-sm btn-left" onClick={handleExport}>
                                                <span className="material-symbols-rounded" aria-hidden="true">summarize</span>
                                                Generate Term 1 Finance Report
                                            </button>
                                            <button className="btn btn-primary btn-sm btn-left" onClick={() => setShowPayment(true)}>
                                                <span className="material-symbols-rounded" aria-hidden="true">add_card</span>
                                                Record New Payment
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
