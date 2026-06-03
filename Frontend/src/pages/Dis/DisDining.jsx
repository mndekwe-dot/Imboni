import { useState, useEffect } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { FilterBar } from '../../components/ui/FilterBar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { DataTable } from '../../components/ui/DataTable'
import { disNavItems, disSecondaryItems, disUser } from './disNav'
import { getDisDining } from '../../api/discipline'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/discipline.css'
import { DashboardContent } from '../../components/layout/DashboardContent'

const PLAN_TYPE_LABEL = {
    full_board:  'Full Board',
    half_board:  'Half Board',
    day_scholar: 'Day Scholar',
}

const PLAN_TYPE_CLS = {
    full_board:  'success',
    half_board:  'warning',
    day_scholar: '',
}

const filterOptions = [
    { key: 'all',        label: 'All Students' },
    { key: 'full_board', label: 'Full Board'   },
    { key: 'half_board', label: 'Half Board'   },
    { key: 'day_scholar',label: 'Day Scholar'  },
]

function DiningRow({ plan }) {
    const { student_name, student_id, plan_type, term_name } = plan
    const label = PLAN_TYPE_LABEL[plan_type] || plan_type
    const cls   = PLAN_TYPE_CLS[plan_type] || ''
    return (
        <tr>
            <td><strong>{student_name}</strong></td>
            <td className="text-muted">{student_id}</td>
            <td>
                <span className={`badge${cls ? ' badge-' + cls : ''}`}>{label}</span>
            </td>
            <td className="text-muted">{term_name || '—'}</td>
        </tr>
    )
}

export function DisDining() {
    const [plans,   setPlans]   = useState([])
    const [loading, setLoading] = useState(true)
    const [filter,  setFilter]  = useState('all')

    useEffect(() => {
        getDisDining()
            .then(setPlans)
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [])

    const visible = filter === 'all'
        ? plans
        : plans.filter(p => p.plan_type === filter)

    const stats = [
        { iconClass: 'success', icon: 'restaurant',      value: plans.filter(p => p.plan_type === 'full_board').length,  label: 'Full Board'   },
        { iconClass: 'warning', icon: 'lunch_dining',    value: plans.filter(p => p.plan_type === 'half_board').length,  label: 'Half Board'   },
        { iconClass: '',        icon: 'directions_walk', value: plans.filter(p => p.plan_type === 'day_scholar').length, label: 'Day Scholars' },
        { iconClass: 'info',    icon: 'groups',          value: plans.length,                                            label: 'Total Plans'  },
    ]

    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={disNavItems} secondaryItems={disSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader title="Dining" subtitle="Student dining plans for the current term" {...disUser} />

                    <DashboardContent>

                        <div className="disc-stat-grid">
                            {stats.map((s, i) => (
                                <div key={i} className="disc-stat-card">
                                    <div className={`disc-stat-icon ${s.iconClass}`}><span className="material-symbols-rounded">{s.icon}</span></div>
                                    <div>
                                        <div className="disc-stat-value">{loading ? '—' : s.value}</div>
                                        <div className="disc-stat-label">{s.label}</div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="card mb-1-5">
                            <div className="card-content">
                                <FilterBar options={filterOptions} active={filter} onChange={setFilter} />
                            </div>
                        </div>

                        {loading ? (
                            <p style={{ padding: '2rem', color: 'var(--muted-foreground)' }}>Loading dining plans…</p>
                        ) : (
                            <DataTable
                                title="Dining Plans"
                                data={visible}
                                columns={['Student', 'Student ID', 'Plan Type', 'Term']}
                                renderRow={(p, i) => <DiningRow key={p.id || i} plan={p} />}
                                emptyIcon="restaurant"
                                emptyTitle="No dining plans"
                                emptyDesc={filter === 'all' ? 'No dining plans on record.' : `No ${PLAN_TYPE_LABEL[filter] || filter} plans.`}
                                onClearFilters={filter !== 'all' ? () => setFilter('all') : undefined}
                            />
                        )}

                    </DashboardContent>
                </main>
            </div>
        </>
    )
}

// Legacy export kept for DisBoarding import compatibility
export function DisDiningPanel() { return null }
