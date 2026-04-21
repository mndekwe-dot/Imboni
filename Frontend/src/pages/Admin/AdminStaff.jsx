import { useState } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { StatCard } from '../../components/layout/StatCard'
import { AdminStaffModal } from '../../components/modals/AdminStaffModal'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/admin.css'
import { adminNavItems, adminSecondaryItems, adminUser } from './adminNav'


const stats = [
    { icon: 'badge',         value: '112', label: 'Total Staff',    trend: 'All roles',        colorClass: ''        },
    { icon: 'school',        value: '85',  label: 'Teaching Staff', trend: '45 FT · 40 PT',    colorClass: 'info'    },
    { icon: 'support_agent', value: '27',  label: 'Support Staff',  trend: 'Admin & services', colorClass: 'success' },
    { icon: 'person_add',    value: '3',   label: 'Open Vacancies', trend: 'Hiring now',       colorClass: 'warning' },
]

const initialStaff = [
    { initials: 'JN', avClass: 'dos',     name: 'Dr. Jean-Claude Ndagijimana', id: 'STF-001', role: 'Director of Studies', dept: 'Academic', contract: 'Full-Time', contractClass: 'fulltime', status: 'Active',   statusClass: 'active'  },
    { initials: 'PR', avClass: 'teacher', name: 'Mr. Pacifique Rurangwa',      id: 'STF-002', role: 'Mathematics Teacher', dept: 'Academic', contract: 'Full-Time', contractClass: 'fulltime', status: 'Active',   statusClass: 'active'  },
    { initials: 'EM', avClass: 'dis',     name: 'Mr. Eric Mutabazi',           id: 'STF-003', role: 'Discipline Master',   dept: 'Welfare',  contract: 'Full-Time', contractClass: 'fulltime', status: 'Active',   statusClass: 'active'  },
    { initials: 'GH', avClass: 'matron',  name: 'Mrs. Gloriose Hakizimana',    id: 'STF-004', role: 'Matron',             dept: 'Welfare',  contract: 'Full-Time', contractClass: 'fulltime', status: 'Active',   statusClass: 'active'  },
    { initials: 'CU', avClass: 'teacher', name: 'Ms. Claudine Umutoni',        id: 'STF-005', role: 'English Teacher',    dept: 'Academic', contract: 'Full-Time', contractClass: 'fulltime', status: 'Active',   statusClass: 'active'  },
    { initials: 'RN', avClass: 'support', name: 'Mrs. Rose Nzabonimana',       id: 'STF-006', role: 'Finance Officer',    dept: 'Admin',    contract: 'Full-Time', contractClass: 'fulltime', status: 'Active',   statusClass: 'active'  },
    { initials: 'BM', avClass: 'support', name: 'Mr. Bonheur Mugabo',          id: 'STF-007', role: 'IT Technician',      dept: 'Admin',    contract: 'Part-Time', contractClass: 'parttime', status: 'Active',   statusClass: 'active'  },
    { initials: 'AI', avClass: 'teacher', name: 'Ms. Alphonsine Ingabire',     id: 'STF-008', role: 'Biology Teacher',    dept: 'Academic', contract: 'Full-Time', contractClass: 'fulltime', status: 'On Leave', statusClass: 'pending' },
]

function StaffRow({ initials, avClass, name, id, role, dept, contract, contractClass, status, statusClass, onEdit, onDelete }) {
    return (
        <tr>
            <td>
                <div className="adm-cell">
                    <div className={`adm-av ${avClass}`}>{initials}</div>
                    <div>
                        <div className="adm-name">{name}</div>
                        <div className="adm-sub">{id}</div>
                    </div>
                </div>
            </td>
            <td>{role}</td>
            <td>{dept}</td>
            <td><span className={`adm-badge ${contractClass}`}>{contract}</span></td>
            <td><span className={`adm-badge ${statusClass}`}>{status}</span></td>
            <td>
                <button className="adm-btn" onClick={onEdit}>
                    <span className="material-symbols-rounded">edit</span> Edit
                </button>
                <button className="adm-btn danger" onClick={onDelete} title="Remove staff member">
                    <span className="material-symbols-rounded">delete</span>
                </button>
            </td>
        </tr>
    )
}

export function AdminStaff() {
    const [staffList, setStaffList]   = useState(initialStaff)
    const [search, setSearch]         = useState('')
    const [deptFilter, setDeptFilter] = useState('All Departments')
    const [ctFilter, setCtFilter]     = useState('All Contracts')
    const [showAdd, setShowAdd]       = useState(false)
    const [editing, setEditing]       = useState(null)   // staff object or null
    const [deleteId, setDeleteId]     = useState(null)   // id to confirm delete

    const filtered = staffList.filter(s => {
        const q = search.toLowerCase()
        const matchSearch = !q || s.name.toLowerCase().includes(q) || s.role.toLowerCase().includes(q) || s.id.toLowerCase().includes(q)
        const matchDept   = deptFilter === 'All Departments' || s.dept === deptFilter
        const matchCt     = ctFilter   === 'All Contracts'   || s.contract === ctFilter
        return matchSearch && matchDept && matchCt
    })

    function handleAdd(form) {
        const avClassMap = { Academic: 'teacher', Welfare: 'matron', Admin: 'support' }
        const nextId = `STF-${String(staffList.length + 1).padStart(3, '0')}`
        setStaffList(prev => [...prev, { ...form, id: form.id || nextId, avClass: avClassMap[form.dept] || 'support' }])
    }

    function handleEdit(form) {
        setStaffList(prev => prev.map(s => s.id === editing.id ? { ...s, ...form } : s))
    }

    function confirmDelete(id) {
        setDeleteId(id)
    }

    function handleDelete() {
        setStaffList(prev => prev.filter(s => s.id !== deleteId))
        setDeleteId(null)
    }

    return (
        <>
            {showAdd && (
                <AdminStaffModal onClose={() => setShowAdd(false)} onSave={handleAdd} />
            )}
            {editing && (
                <AdminStaffModal staff={editing} onClose={() => setEditing(null)} onSave={handleEdit} />
            )}
            {deleteId && (
                <div className="modal-overlay" onClick={() => setDeleteId(null)}>
                    <div className="modal-box modal-box-sm" onClick={e => e.stopPropagation()} style={{ padding: '1.5rem' }}>
                        <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.05rem' }}>Remove Staff Member?</h2>
                        <p style={{ margin: '0 0 1.25rem', color: 'var(--muted-foreground)', fontSize: '0.875rem' }}>
                            This will remove <strong>{staffList.find(s => s.id === deleteId)?.name}</strong> from the list.
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.625rem' }}>
                            <button className="btn btn-secondary" onClick={() => setDeleteId(null)}>Cancel</button>
                            <button className="btn btn-primary" style={{ background: 'var(--destructive)' }} onClick={handleDelete}>
                                <span className="material-symbols-rounded">delete</span>Remove
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={adminNavItems} secondaryItems={adminSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title="Staff Management"
                        subtitle="All staff — teachers, welfare, administration and support"
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
                                <h2 className="card-title">All Staff ({filtered.length})</h2>
                                <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>
                                    <span className="material-symbols-rounded">person_add</span>
                                    Add Staff Member
                                </button>
                            </div>
                            <div className="card-content">

                                {/* Filter bar */}
                                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--muted)', borderRadius: 'var(--radius)', padding: '0.4rem 0.75rem', flex: 1, minWidth: '200px' }}>
                                        <span className="material-symbols-rounded" style={{ fontSize: '1rem', color: 'var(--muted-foreground)' }}>search</span>
                                        <input
                                            type="text"
                                            placeholder="Search staff..."
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
                                    <select className="form-input" style={{ width: 'auto' }} value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
                                        <option>All Departments</option>
                                        <option>Academic</option>
                                        <option>Welfare</option>
                                        <option>Admin</option>
                                    </select>
                                    <select className="form-input" style={{ width: 'auto' }} value={ctFilter} onChange={e => setCtFilter(e.target.value)}>
                                        <option>All Contracts</option>
                                        <option>Full-Time</option>
                                        <option>Part-Time</option>
                                    </select>
                                </div>

                                <div className="adm-table-wrap">
                                    <table className="adm-table">
                                        <thead>
                                            <tr>
                                                <th>Name</th>
                                                <th>Role</th>
                                                <th>Department</th>
                                                <th>Contract</th>
                                                <th>Status</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filtered.length > 0
                                                ? filtered.map((s, i) => (
                                                    <StaffRow
                                                        key={i} {...s}
                                                        onEdit={() => setEditing(s)}
                                                        onDelete={() => confirmDelete(s.id)}
                                                    />
                                                ))
                                                : (
                                                    <tr>
                                                        <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted-foreground)' }}>
                                                            No staff match your filters.
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
