import { useState } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { ClassPicker } from '../../components/ui/ClassPicker'
import { EmptyState } from '../../components/ui/EmptyState'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/dos.css'
import { dosNavItems, dosSecondaryItems } from './dosNav'


const SECTIONS = [
    { name: 'O-Level', years: ['S1', 'S2', 'S3'], classes: ['A', 'B', 'C'] },
    { name: 'A-Level', years: ['S4', 'S5', 'S6'], classes: ['A', 'B', 'C'] },
]

const studentStats = [
    { iconClass: 'info',    icon: 'people',       trend: '+15 this term',   trendClass: 'positive', value: '1,245', label: 'Total Students'      },
    { iconClass: 'success', icon: 'check_circle', trend: '96% enrollment',  trendClass: 'positive', value: '1,198', label: 'Active Students'     },
    { iconClass: 'warning', icon: 'person_add',   trend: 'This term',       trendClass: 'neutral',  value: '47',    label: 'New Admissions'      },
    { iconClass: 'success', icon: 'trending_up',  trend: '+3% improvement', trendClass: 'positive', value: '78%',   label: 'Average Performance' },
]

const allStudents = [
    { initials: 'UA', name: 'Uwase Amina',     adm: 'ADM-2026-001', year: 'S4', classLetter: 'A', house: 'Bisoke',    t1: '74%', t2: '78%', curr: '81%', standClass: 'dos-stand-good',      standing: 'Good'      },
    { initials: 'KM', name: 'Mutabazi Kevin',  adm: 'ADM-2026-002', year: 'S3', classLetter: 'B', house: 'Muhabura',  t1: '65%', t2: '68%', curr: '70%', standClass: 'dos-stand-good',      standing: 'Good'      },
    { initials: 'IM', name: 'Ingabire Marie',  adm: 'ADM-2026-003', year: 'S3', classLetter: 'A', house: 'Bisoke',    t1: '88%', t2: '91%', curr: '90%', standClass: 'dos-stand-excellent', standing: 'Excellent' },
    { initials: 'PN', name: 'Nkurunziza Peter',adm: 'ADM-2026-004', year: 'S2', classLetter: 'A', house: 'Sabyinyo',  t1: '55%', t2: '52%', curr: '58%', standClass: 'dos-stand-concern',   standing: 'Concern'   },
    { initials: 'UD', name: 'Umutoni Diane',   adm: 'ADM-2026-005', year: 'S5', classLetter: 'A', house: 'Karisimbi', t1: '79%', t2: '82%', curr: '84%', standClass: 'dos-stand-excellent', standing: 'Excellent' },
    { initials: 'JB', name: 'Bizimana James',  adm: 'ADM-2026-006', year: 'S5', classLetter: 'A', house: 'Muhabura',  t1: '61%', t2: '65%', curr: '67%', standClass: 'dos-stand-good',      standing: 'Good'      },
    { initials: 'HG', name: 'Hakizimana Grace',adm: 'ADM-2026-007', year: 'S1', classLetter: 'A', house: 'Bisoke',    t1: '93%', t2: '95%', curr: '94%', standClass: 'dos-stand-excellent', standing: 'Excellent' },
    { initials: 'EN', name: 'Ndagijimana Eric',adm: 'ADM-2026-008', year: 'S1', classLetter: 'B', house: 'Sabyinyo',  t1: '48%', t2: '55%', curr: '59%', standClass: 'dos-stand-concern',   standing: 'Concern'   },
]

function StudentStatCard({ iconClass, icon, trend, trendClass, value, label }) {
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

function StudentRow({ initials, name, adm, house, t1, t2, curr, standClass, standing }) {
    return (
        <tr>
            <td><div className="tm-teacher-cell"><div className="tm-av">{initials}</div><span>{name}</span></div></td>
            <td>{adm}</td><td>{house}</td><td>{t1}</td><td>{t2}</td><td>{curr}</td>
            <td><span className={standClass}>{standing}</span></td>
            <td><button className="tm-btn">View</button></td>
        </tr>
    )
}

export function DosStudents() {
    const [section, setSection]   = useState('')
    const [year, setYear]         = useState('')
    const [classVal, setClassVal] = useState('')
    const [search, setSearch]     = useState('')

    const filtered = allStudents.filter(s => {
        if (year && s.year !== year) return false
        if (classVal && s.classLetter !== classVal) return false
        if (search) {
            const q = search.toLowerCase()
            if (!s.name.toLowerCase().includes(q) && !s.adm.toLowerCase().includes(q)) return false
        }
        return true
    })

    const classLabel = year && classVal ? `${year}${classVal}` : year || 'All Classes'

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
                            <h1>Student Management</h1>
                            <p>Monitor student enrollment and performance</p>
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
                            {studentStats.map(stat => <StudentStatCard key={stat.label} {...stat} />)}
                        </div>

                        <ClassPicker
                            sections={SECTIONS}
                            section={section}
                            onSectionChange={s => { setSection(s); setYear(''); setClassVal('') }}
                            year={year}
                            onYearChange={y => { setYear(y); setClassVal('') }}
                            classVal={classVal}
                            onClassChange={setClassVal}
                        />

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
                                    placeholder="Search by name or admission number..."
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
                            <div style={{ flex: 1 }} />
                            <button className="btn btn-outline" style={{ fontSize: '0.82rem' }}>
                                <span className="material-symbols-rounded icon-sm">download</span>
                                Export
                            </button>
                            <button className="btn btn-primary" style={{ fontSize: '0.82rem' }}>
                                <span className="material-symbols-rounded icon-sm">person_add</span>
                                Add Student
                            </button>
                        </div>

                        {/* Content container or EmptyState */}
                        {filtered.length === 0 ? (
                            <EmptyState
                                icon="people"
                                title="No students found"
                                description={search ? `No students match "${search}".` : `No students found for ${classLabel}.`}
                                action={search ? { label: 'Clear Search', icon: 'close', onClick: () => setSearch('') } : undefined}
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
                                    <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                                        {classLabel} — Students
                                    </div>
                                    <span style={{ fontSize: '0.82rem', color: 'var(--muted-foreground)' }}>
                                        {filtered.length} student{filtered.length !== 1 ? 's' : ''}
                                    </span>
                                </div>
                                <div className="tm-table-wrap">
                                    <table className="tm-table">
                                        <thead>
                                            <tr>
                                                <th>Student</th>
                                                <th>Adm No.</th>
                                                <th>Dormitory</th>
                                                <th>Term 1</th>
                                                <th>Term 2</th>
                                                <th>Current</th>
                                                <th>Standing</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filtered.map(s => <StudentRow key={s.adm} {...s} />)}
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
