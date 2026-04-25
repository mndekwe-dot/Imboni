import { useState } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { StatCard } from '../../components/layout/StatCard'
import { AdminPaymentModal } from '../../components/modals/AdminPaymentModal'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/admin.css'
import { adminNavItems, adminSecondaryItems, adminUser } from './adminNav'
import { DashboardContent } from '../../components/layout/DashboardContent'


const stats = [
    { icon: 'payments',        value: 'RWF 184M', label: 'Total Fee Expected', trend: 'Term 2 · 2026',  colorClass: ''        },
    { icon: 'check_circle',    value: 'RWF 173M', label: 'Collected',          trend: '94% of target',  colorClass: 'success' },
    { icon: 'pending',         value: 'RWF 11M',  label: 'Outstanding',        trend: '143 students',   colorClass: 'warning' },
    { icon: 'account_balance', value: 'RWF 26M',  label: 'Monthly Expenses',   trend: 'March 2026',     colorClass: 'info'    },
]

const feeCollectionByClass = [
    { class: 'S6', collected: '98%', width: '98%' },
    { class: 'S5', collected: '96%', width: '96%' },
    { class: 'S4', collected: '95%', width: '95%' },
    { class: 'S3', collected: '94%', width: '94%' },
    { class: 'S2', collected: '91%', width: '91%' },
    { class: 'S1', collected: '89%', width: '89%' },
]

const initialTransactions = [
    { initials: 'IB', name: 'Ingabire Belise',    adm: 'ADM-2026-001', amount: 'RWF 580,000', date: 'Mar 8, 2026', type: 'Full Payment', typeClass: 'paid'    },
    { initials: 'ND', name: 'Ndagijimana Eric',   adm: 'ADM-2026-002', amount: 'RWF 290,000', date: 'Mar 7, 2026', type: 'Partial',      typeClass: 'partial' },
    { initials: 'KU', name: 'Kayitesi Ursula',    adm: 'ADM-2026-003', amount: 'RWF 580,000', date: 'Mar 7, 2026', type: 'Full Payment', typeClass: 'paid'    },
    { initials: 'UL', name: 'Uwineza Lydia',      adm: 'ADM-2026-005', amount: 'RWF 580,000', date: 'Mar 5, 2026', type: 'Full Payment', typeClass: 'paid'    },
    { initials: 'NP', name: 'Nkurunziza Peter',   adm: 'ADM-2026-006', amount: 'RWF 150,000', date: 'Mar 4, 2026', type: 'Partial',      typeClass: 'partial' },
    { initials: 'BJ', name: 'Bizimana James',     adm: 'ADM-2026-004', amount: '—',            date: '—',           type: 'Overdue',      typeClass: 'overdue' },
]

function TxRow({ initials, name, adm, amount, date, type, typeClass }) {
    return (
        <tr>
            <td>
                <div className="adm-cell">
                    <div className="adm-av">{initials}</div>
                    <div>
                        <div className="adm-name">{name}</div>
                        <div className="adm-sub">{adm}</div>
                    </div>
                </div>
            </td>
            <td>{amount}</td>
            <td>{date}</td>
            <td><span className={`adm-badge ${typeClass}`}>{type}</span></td>
            <td>
                <button className="adm-btn">
                    <span className="material-symbols-rounded">receipt</span> Receipt
                </button>
            </td>
        </tr>
    )
}

export function AdminFinance() {
    const [txList, setTxList]           = useState(initialTransactions)
    const [statusFilter, setStatusFilter] = useState('All')
    const [showPayment, setShowPayment] = useState(false)
    const [exportMsg, setExportMsg]     = useState('')

    const filtered = statusFilter === 'All'
        ? txList
        : txList.filter(tx => tx.typeClass === statusFilter.toLowerCase())

    function handleAddPayment(payment) {
        setTxList(prev => [payment, ...prev])
    }

    function handleExport() {
        setExportMsg('Exported!')
        setTimeout(() => setExportMsg(''), 2000)
    }

    function handleSendReminder() {
        const btn = document.getElementById('reminder-btn')
        if (!btn) return
        btn.textContent = 'Reminders Sent!'
        btn.disabled = true
        setTimeout(() => {
            btn.textContent = 'Send Fee Reminder — All Overdue'
            btn.disabled = false
        }, 2500)
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
                        title="Finance"
                        subtitle="Fee collection, payments and school budget — Term 2, 2026"
                        userName={adminUser.userName}
                        userRole={adminUser.userRole}
                        userInitials={adminUser.userInitials}
                        avatarClass={adminUser.avatarClass}
                        notifications={adminUser.notifications}
                    />
                    <DashboardContent>

                        <div className="portal-stat-grid">
                            {stats.map((s, i) => <StatCard key={i} {...s} />)}
                        </div>

                        <div className="adm-finance-grid">

                            {/* Left: transactions table */}
                            <div className="card">
                                <div className="card-header">
                                    <h2 className="card-title">Transactions ({filtered.length})</h2>
                                    <button className="btn btn-outline btn-sm" onClick={handleExport}>
                                        <span className="material-symbols-rounded">download</span>
                                        {exportMsg || 'Export'}
                                    </button>
                                </div>
                                <div className="card-content">
                                    {/* Status filter chips */}
                                    <div className="filter-chips">
                                        {['All', 'Paid', 'Partial', 'Overdue'].map(f => (
                                            <button
                                                key={f}
                                                className={`filter-chip${statusFilter === f ? ' active' : ''}`}
                                                onClick={() => setStatusFilter(f)}
                                            >{f}</button>
                                        ))}
                                    </div>
                                    <div className="adm-table-wrap">
                                        <table className="adm-table">
                                            <thead>
                                                <tr>
                                                    <th>Student</th>
                                                    <th>Amount</th>
                                                    <th>Date</th>
                                                    <th>Status</th>
                                                    <th>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filtered.length > 0
                                                    ? filtered.map((tx, i) => <TxRow key={i} {...tx} />)
                                                    : (
                                                        <tr>
                                                            <td colSpan={5} className="td-empty">
                                                                No transactions for this filter.
                                                            </td>
                                                        </tr>
                                                    )
                                                }
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>

                            {/* Right: collection by class + quick actions */}
                            <div className="card">
                                <div className="card-header">
                                    <h2 className="card-title">Collection by Class</h2>
                                    <p className="card-description">Term 2 · 2026</p>
                                </div>
                                <div className="card-content">
                                    {feeCollectionByClass.map((item, i) => (
                                        <div key={i} className="adm-progress-row">
                                            <span className="adm-progress-label">{item.class}</span>
                                            <div className="adm-progress-bar">
                                                <div className="adm-progress-fill" style={{ width: item.width }}></div>
                                            </div>
                                            <span className="adm-progress-value">{item.collected}</span>
                                        </div>
                                    ))}

                                    <div className="quick-actions-section">
                                        <p className="quick-actions-label">Quick Actions</p>
                                        <div className="quick-actions-btns">
                                            <button
                                                id="reminder-btn"
                                                className="btn btn-outline btn-sm btn-left"
                                                onClick={handleSendReminder}
                                            >
                                                <span className="material-symbols-rounded">mail</span>
                                                Send Fee Reminder — All Overdue
                                            </button>
                                            <button className="btn btn-outline btn-sm btn-left" onClick={handleExport}>
                                                <span className="material-symbols-rounded">summarize</span>
                                                Generate Term 1 Finance Report
                                            </button>
                                            <button className="btn btn-primary btn-sm btn-left" onClick={() => setShowPayment(true)}>
                                                <span className="material-symbols-rounded">add_card</span>
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
