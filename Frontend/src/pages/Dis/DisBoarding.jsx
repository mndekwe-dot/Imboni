import { useState, useEffect } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { FilterBar } from '../../components/ui/FilterBar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { DataTable } from '../../components/ui/DataTable'
import { disNavItems, disSecondaryItems, disUser } from './disNav'
import { getDisBoarding } from '../../api/discipline'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/discipline.css'
import '../../styles/tables.css'
import { DashboardContent } from '../../components/layout/DashboardContent'

const BOARDING_TYPE_LABEL = {
    full_boarder:   'Full Boarder',
    weekly_boarder: 'Weekly Boarder',
    day_scholar:    'Day Scholar',
}

function BoardingRow({ record }) {
    const { student_name, student_id, grade, section, dormitory, room_number, bed_number, boarding_type, check_in_date } = record
    const cls = `${grade || ''}${section || ''}`
    return (
        <tr>
            <td><strong>{student_name}</strong></td>
            <td><span className="class-chip">{cls}</span></td>
            <td className="text-muted">{student_id}</td>
            <td><span className="disc-badge">{dormitory}</span></td>
            <td className="text-muted">Room {room_number}{bed_number ? ` · Bed ${bed_number}` : ''}</td>
            <td>{BOARDING_TYPE_LABEL[boarding_type] || boarding_type}</td>
            <td className="text-muted">{check_in_date || '—'}</td>
        </tr>
    )
}

export function DisBoarding() {
    const [students, setStudents] = useState([])
    const [loading,  setLoading]  = useState(true)
    const [filter,   setFilter]   = useState('all')

    useEffect(() => {
        getDisBoarding()
            .then(setStudents)
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [])

    const dormitories = [...new Set(students.map(s => s.dormitory).filter(Boolean))].sort()
    const filterOptions = [
        { key: 'all', label: 'All Dormitories' },
        ...dormitories.map(d => ({ key: d, label: d })),
    ]

    const visible = filter === 'all'
        ? students
        : students.filter(s => s.dormitory === filter)

    const stats = [
        { iconClass: 'info',    icon: 'home',              value: students.filter(s => s.boarding_type === 'full_boarder').length,   label: 'Full Boarders'   },
        { iconClass: 'warning', icon: 'weekend',           value: students.filter(s => s.boarding_type === 'weekly_boarder').length, label: 'Weekly Boarders' },
        { iconClass: 'success', icon: 'directions_walk',   value: students.filter(s => s.boarding_type === 'day_scholar').length,    label: 'Day Scholars'    },
        { iconClass: '',        icon: 'groups',            value: students.length,                                                   label: 'Total Students'  },
    ]

    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={disNavItems} secondaryItems={disSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader title="Boarding" subtitle="Dormitory assignments and boarding records" {...disUser} />

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
                            <p style={{ padding: '2rem', color: 'var(--muted-foreground)' }}>Loading boarding records…</p>
                        ) : (
                            <DataTable
                                title="Boarding Students"
                                data={visible}
                                columns={['Student', 'Class', 'Student ID', 'Dormitory', 'Room / Bed', 'Type', 'Check-in']}
                                renderRow={(r, i) => <BoardingRow key={r.id || i} record={r} />}
                                emptyIcon="home"
                                emptyTitle="No boarding records"
                                emptyDesc={filter === 'all' ? 'No boarding records on file.' : `No students in ${filter}.`}
                                onClearFilters={filter !== 'all' ? () => setFilter('all') : undefined}
                            />
                        )}

                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
