import { useState } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { StatCard } from '../../components/layout/StatCard'
import { AdminStudentModal } from '../../components/modals/AdminStudentModal'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/admin.css'
import { adminNavItems, adminSecondaryItems, adminUser } from './adminNav'


const stats = [
    { icon: 'groups',       value: '1,245', label: 'Total Students',  trend: 'Enrolled',         colorClass: ''        },
    { icon: 'person_add',   value: '47',    label: 'New Admissions',  trend: 'Term 1 · 2026',    colorClass: 'info'    },
    { icon: 'check_circle', value: '1,198', label: 'Active',          trend: '96% enrollment',   colorClass: 'success' },
    { icon: 'person_off',   value: '47',    label: 'Deferred / Left', trend: 'This term',        colorClass: 'warning' },
]

const initialStudents = [
    { initials: 'IB', name: 'Ingabire Belise',    adm: 'ADM-2026-001', class: 'S4A', house: 'Karisimbi', fee: 'Paid',    feeClass: 'paid',    status: 'Active',   statusClass: 'active'  },
    { initials: 'ND', name: 'Ndagijimana Eric',   adm: 'ADM-2026-002', class: 'S6A', house: 'Muhabura',  fee: 'Partial', feeClass: 'partial', status: 'Active',   statusClass: 'active'  },
    { initials: 'KU', name: 'Kayitesi Ursula',    adm: 'ADM-2026-003', class: 'S3B', house: 'Bisoke',    fee: 'Paid',    feeClass: 'paid',    status: 'Active',   statusClass: 'active'  },
    { initials: 'BJ', name: 'Bizimana James',     adm: 'ADM-2026-004', class: 'S5A', house: 'Sabyinyo',  fee: 'Overdue', feeClass: 'overdue', status: 'Active',   statusClass: 'active'  },
    { initials: 'UL', name: 'Uwineza Lydia',      adm: 'ADM-2026-005', class: 'S5B', house: 'Karisimbi', fee: 'Paid',    feeClass: 'paid',    status: 'Active',   statusClass: 'active'  },
    { initials: 'NP', name: 'Nkurunziza Peter',   adm: 'ADM-2026-006', class: 'S4B', house: 'Muhabura',  fee: 'Partial', feeClass: 'partial', status: 'Active',   statusClass: 'active'  },
    { initials: 'MJ', name: 'Mukamazimpaka Joy',  adm: 'ADM-2026-007', class: 'S5A', house: 'Bisoke',    fee: 'Paid',    feeClass: 'paid',    status: 'Active',   statusClass: 'active'  },
    { initials: 'HS', name: 'Habimana Samuel',    adm: 'ADM-2026-008', class: 'S6B', house: 'Sabyinyo',  fee: 'Overdue', feeClass: 'overdue', status: 'On Leave', statusClass: 'pending' },
]

function StudentRow({ initials, name, adm, class: cls, house, fee, feeClass, status, statusClass, onView, onEdit }) {
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
            <td>{cls}</td>
            <td>{house}</td>
            <td><span className={`adm-badge ${feeClass}`}>{fee}</span></td>
            <td><span className={`adm-badge ${statusClass}`}>{status}</span></td>
            <td>
                <button className="adm-btn" onClick={onView}>
                    <span className="material-symbols-rounded">visibility</span> View
                </button>
                <button className="adm-btn" onClick={onEdit}>
                    <span className="material-symbols-rounded">edit</span> Edit
                </button>
            </td>
        </tr>
    )
}

export function AdminStudents() {
    const [studentList, setStudentList] = useState(initialStudents)
    const [search, setSearch]           = useState('')
    const [classFilter, setClassFilter] = useState('All Classes')
    const [feeFilter, setFeeFilter]     = useState('All Fee Status')
    const [showAdd, setShowAdd]         = useState(false)
    const [viewing, setViewing]         = useState(null)   // read-only detail
    const [editing, setEditing]         = useState(null)   // edit modal

    const classValues = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6']

    const filtered = studentList.filter(s => {
        const q = search.toLowerCase()
        const matchSearch = !q || s.name.toLowerCase().includes(q) || s.adm.toLowerCase().includes(q)
        const matchClass  = classFilter === 'All Classes' || s.class.startsWith(classFilter)
        const matchFee    = feeFilter   === 'All Fee Status' || s.fee === feeFilter
        return matchSearch && matchClass && matchFee
    })

    function handleAdmit(form) {
        const nextAdm = `ADM-2026-${String(studentList.length + 1).padStart(3, '0')}`
        setStudentList(prev => [...prev, { ...form, adm: form.adm || nextAdm }])
    }

    function handleEdit(form) {
        setStudentList(prev => prev.map(s => s.adm === editing.adm ? { ...s, ...form } : s))
    }

    return (
        <>
            {showAdd && (
                <AdminStudentModal onClose={() => setShowAdd(false)} onSave={handleAdmit} />
            )}
            {viewing && (
                <AdminStudentModal student={viewing} readOnly onClose={() => setViewing(null)} onSave={() => {}} />
            )}
            {editing && (
                <AdminStudentModal student={editing} onClose={() => setEditing(null)} onSave={handleEdit} />
            )}

            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={adminNavItems} secondaryItems={adminSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title="Student Management"
                        subtitle="Enrollment, admissions and student records"
                        userName={adminUser.userName}
                        userRole={adminUser.userRole}
                        userInitials={adminUser.userInitials}
                        avatarClass={adminUser.avatarClass}
                        notifications={adminUser.notifications}
                    />
                    <div className="dashboard-content">

                        <div className="portal-stat-grid">
                            {stats.map((s, i) => <StatCard key={i} {...s} />)}
                        </div>

                        <div className="card">
                            <div className="card-header">
                                <h2 className="card-title">All Students ({filtered.length})</h2>
                                <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>
                                    <span className="material-symbols-rounded">person_add</span>
                                    Admit Student
                                </button>
                            </div>
                            <div className="card-content">

                                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--muted)', borderRadius: 'var(--radius)', padding: '0.4rem 0.75rem', flex: 1, minWidth: '200px' }}>
                                        <span className="material-symbols-rounded" style={{ fontSize: '1rem', color: 'var(--muted-foreground)' }}>search</span>
                                        <input
                                            type="text"
                                            placeholder="Search students..."
                                            value={search}
                                            onChange={e => setSearch(e.target.value)}
                                            style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '0.875rem', width: '100%' }}
                                        />
                                        {search && (
                                            <button onClick={() => setSearch('')} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, color: 'var(--muted-foreground)', display: 'flex' }}>
                                                <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>close</span>
                                            </button>
                                        )}
                                    </div>
                                    <select className="form-input" style={{ width: 'auto' }} value={classFilter} onChange={e => setClassFilter(e.target.value)}>
                                        <option>All Classes</option>
                                        {classValues.map(c => <option key={c}>{c}</option>)}
                                    </select>
                                    <select className="form-input" style={{ width: 'auto' }} value={feeFilter} onChange={e => setFeeFilter(e.target.value)}>
                                        <option>All Fee Status</option>
                                        <option>Paid</option>
                                        <option>Partial</option>
                                        <option>Overdue</option>
                                    </select>
                                </div>

                                <div className="adm-table-wrap">
                                    <table className="adm-table">
                                        <thead>
                                            <tr>
                                                <th>Student</th>
                                                <th>Class</th>
                                                <th>House</th>
                                                <th>Fee Status</th>
                                                <th>Status</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filtered.length > 0
                                                ? filtered.map((s, i) => (
                                                    <StudentRow
                                                        key={i} {...s}
                                                        onView={() => setViewing(s)}
                                                        onEdit={() => setEditing(s)}
                                                    />
                                                ))
                                                : (
                                                    <tr>
                                                        <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted-foreground)' }}>
                                                            No students match your filters.
                                                        </td>
                                                    </tr>
                                                )
                                            }
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                    </div>
                </main>
            </div>
        </>
    )
}
