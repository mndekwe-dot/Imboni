import { useState } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { EmptyState } from '../../components/ui/EmptyState'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/dos.css'
import { dosNavItems, dosSecondaryItems } from './dosNav'


const teacherStats = [
    { iconClass: 'info',    icon: 'school',   trend: '+3 this term', trendClass: 'positive', value: '85',   label: 'Total Teachers'        },
    { iconClass: 'success', icon: 'badge',    trend: '53% of staff', trendClass: 'neutral',  value: '45',   label: 'Full-Time'             },
    { iconClass: 'warning', icon: 'schedule', trend: '47% of staff', trendClass: 'neutral',  value: '40',   label: 'Part-Time'             },
    { iconClass: 'info',    icon: 'groups',   trend: 'Optimal',      trendClass: 'positive', value: '1:15', label: 'Student-Teacher Ratio' },
]

const allTeachers = [
    { initials: 'CU', avClass: 'english',  name: 'Claudine Umutoni',       id: 'TST-001', subject: 'English',     type: 'Full-Time', typeClass: 'fulltime', classes: ['S1A', 'S3A'],         statusClass: 'active', status: 'Active' },
    { initials: 'PR', avClass: 'math',     name: 'Pacifique Rurangwa',      id: 'TST-002', subject: 'Mathematics', type: 'Full-Time', typeClass: 'fulltime', classes: ['S2A', 'S2B'],         statusClass: 'active', status: 'Active' },
    { initials: 'IN', avClass: 'sciences', name: 'Immaculee Nsabimana',     id: 'TST-003', subject: 'Biology',     type: 'Full-Time', typeClass: 'fulltime', classes: ['S3A', 'S3B', 'S4A'],  statusClass: 'active', status: 'Active' },
    { initials: 'TB', avClass: 'sciences', name: 'Theophile Bizimana',      id: 'TST-004', subject: 'Chemistry',   type: 'Part-Time', typeClass: 'parttime', classes: ['S2B'],                 statusClass: 'active', status: 'Active' },
    { initials: 'SU', avClass: 'sciences', name: 'Sandrine Uwera',          id: 'TST-005', subject: 'Physics',     type: 'Full-Time', typeClass: 'fulltime', classes: ['S3A', 'S3B', 'S4A'],  statusClass: 'active', status: 'Active' },
    { initials: 'JN', avClass: 'english',  name: 'Janvier Ntakirutimana',   id: 'TST-006', subject: 'History',     type: 'Full-Time', typeClass: 'fulltime', classes: ['S3A', 'S4A'],         statusClass: 'active', status: 'Active' },
]

const SUBJECTS = ['All Subjects', 'Mathematics', 'English', 'Biology', 'Chemistry', 'Physics', 'History', 'Geography', 'Kinyarwanda', 'CRE', 'Art & Design']
const TYPES    = ['All Types', 'Full-Time', 'Part-Time']

function TeacherStat({ iconClass, icon, trend, trendClass, value, label }) {
    return (
        <div className="stat-card">
            <div className="stat-header">
                <div className={`stat-icon ${iconClass}`}><span className="material-symbols-rounded">{icon}</span></div>
                <span className={`stat-trend ${trendClass}`}>{trend}</span>
            </div>
            <div className="stat-value">{value}</div>
            <div className="stat-label">{label}</div>
        </div>
    )
}

function TeacherRow({ initials, avClass, name, id, subject, type, typeClass, classes, statusClass, status }) {
    return (
        <tr>
            <td>
                <div className="tm-teacher-cell">
                    <div className={`tm-av ${avClass}`}>{initials}</div>
                    <div>
                        <div className="tm-name">{name}</div>
                        <div className="tm-id">{id}</div>
                    </div>
                </div>
            </td>
            <td>{subject}</td>
            <td><span className={`tm-badge ${typeClass}`}>{type}</span></td>
            <td>{classes.map((cls, i) => <span key={i} className="tm-chip">{cls}</span>)}</td>
            <td><span className={`tm-status ${statusClass}`}>{status}</span></td>
            <td className="tm-actions">
                <button className="tm-btn"><span className="material-symbols-rounded">edit</span> Edit</button>
                <button className="tm-btn assign"><span className="material-symbols-rounded">class</span> Assign</button>
            </td>
        </tr>
    )
}

export function DosTeachers() {
    const [search, setSearch]           = useState('')
    const [subjectFilter, setSubjectFilter] = useState('All Subjects')
    const [typeFilter, setTypeFilter]   = useState('All Types')

    const filtered = allTeachers.filter(t => {
        if (subjectFilter !== 'All Subjects' && t.subject !== subjectFilter) return false
        if (typeFilter    !== 'All Types'    && t.type    !== typeFilter)    return false
        if (search) {
            const q = search.toLowerCase()
            if (!t.name.toLowerCase().includes(q) && !t.subject.toLowerCase().includes(q) && !t.id.toLowerCase().includes(q)) return false
        }
        return true
    })

    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={dosNavItems} secondaryItems={dosSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <header className="dashboard-header">
                        <button className="mobile-menu-btn" onClick={() => document.dispatchEvent(new CustomEvent('imboni:open-sidebar'))}>
                            <span className="material-symbols-rounded">menu</span>
                        </button>
                        <div className="dashboard-header-title">
                            <h1>Teacher Management</h1>
                            <p>View, add, update teachers and manage class assignments</p>
                        </div>
                        <div className="dashboard-header-actions">
                            <button className="notification-btn">
                                <span className="material-symbols-rounded">notifications</span>
                                <span className="notification-badge">2</span>
                            </button>
                            <div className="header-user">
                                <div className="header-user-info">
                                    <span className="header-user-name">Dr. Jean-Claude Ndagijimana</span>
                                    <span className="header-user-role">Director of Studies</span>
                                </div>
                                <div className="header-user-av dos-av">JN</div>
                            </div>
                        </div>
                    </header>

                    <div className="dashboard-content">

                        <div className="quick-stats">
                            {teacherStats.map((stat, i) => <TeacherStat key={i} {...stat} />)}
                        </div>

                        {/* Toolbar container */}
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '0.75rem',
                            flexWrap: 'wrap', margin: '1rem 0',
                            background: 'var(--card)', border: '1px solid var(--border)',
                            borderRadius: 16, padding: '0.75rem 1rem',
                            boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--muted)', borderRadius: 'var(--radius)', padding: '0.4rem 0.75rem', flex: 1, minWidth: 200 }}>
                                <span className="material-symbols-rounded" style={{ fontSize: '1rem', color: 'var(--muted-foreground)' }}>search</span>
                                <input
                                    type="text"
                                    placeholder="Search by name or subject..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '0.875rem', width: '100%' }}
                                />
                                {search && (
                                    <button onClick={() => setSearch('')} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'var(--muted-foreground)' }}>
                                        <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>close</span>
                                    </button>
                                )}
                            </div>
                            <select
                                className="input input-auto"
                                value={subjectFilter}
                                onChange={e => setSubjectFilter(e.target.value)}
                                style={{ fontSize: '0.82rem' }}
                            >
                                {SUBJECTS.map(s => <option key={s}>{s}</option>)}
                            </select>
                            <select
                                className="input input-auto"
                                value={typeFilter}
                                onChange={e => setTypeFilter(e.target.value)}
                                style={{ fontSize: '0.82rem' }}
                            >
                                {TYPES.map(t => <option key={t}>{t}</option>)}
                            </select>
                            <div style={{ flex: 1 }} />
                            <button className="btn btn-primary" style={{ fontSize: '0.82rem' }}>
                                <span className="material-symbols-rounded icon-sm">person_add</span>
                                Add Teacher
                            </button>
                        </div>

                        {/* Content container or EmptyState */}
                        {filtered.length === 0 ? (
                            <EmptyState
                                icon="school"
                                title="No teachers found"
                                description={search ? `No teachers match "${search}".` : 'No teachers match the selected filters.'}
                                action={{
                                    label: 'Clear Filters',
                                    icon: 'close',
                                    onClick: () => { setSearch(''); setSubjectFilter('All Subjects'); setTypeFilter('All Types') }
                                }}
                            />
                        ) : (
                            <div style={{
                                background: 'var(--card)', border: '1px solid var(--border)',
                                borderRadius: 16, overflow: 'hidden',
                                boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                            }}>
                                <div style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)',
                                }}>
                                    <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>All Teachers</div>
                                    <span style={{ fontSize: '0.82rem', color: 'var(--muted-foreground)' }}>
                                        {filtered.length} teacher{filtered.length !== 1 ? 's' : ''}
                                    </span>
                                </div>
                                <div className="tm-table-wrap">
                                    <table className="tm-table">
                                        <thead>
                                            <tr>
                                                <th>Teacher</th>
                                                <th>Subject</th>
                                                <th>Type</th>
                                                <th>Classes Assigned</th>
                                                <th>Status</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filtered.map((t, i) => <TeacherRow key={i} {...t} />)}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </>
    )
}
