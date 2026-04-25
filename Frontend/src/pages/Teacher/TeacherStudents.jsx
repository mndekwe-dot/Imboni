import { useState } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { ClassPicker } from '../../components/ui/ClassPicker'
import { Modal } from '../../components/ui/Modal'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/teacher.css'
import '../../styles/pages.css'
import { teacherNavItems, teacherSecondaryItems, teacherUser } from './teacherNav'

const SECTIONS = [
    { name: 'O-Level', years: ['S1', 'S2', 'S3'], classes: ['A', 'B', 'C'] },
    { name: 'A-Level', years: ['S4', 'S5', 'S6'], classes: ['MPG', 'PCB', 'MEG', 'MPC'] },
]

const students = [
    { initials: 'UA', name: 'Uwase Amina',         code: 'STU-001', className: 'S4A', attendance: 95, performance: 88, year: 'S4', letter: 'A', gender: 'F', isMonitor: true  },
    { initials: 'KM', name: 'Mutabazi Kevin',       code: 'STU-002', className: 'S4A', attendance: 92, performance: 85, year: 'S4', letter: 'A', gender: 'M', isMonitor: false },
    { initials: 'IM', name: 'Ingabire Marie',       code: 'STU-003', className: 'S3B', attendance: 92, performance: 90, year: 'S3', letter: 'B', gender: 'F', isMonitor: false },
    { initials: 'PN', name: 'Nkurunziza Peter',     code: 'STU-004', className: 'S4B', attendance: 90, performance: 86, year: 'S4', letter: 'B', gender: 'M', isMonitor: false },
    { initials: 'UD', name: 'Umutoni Diane',        code: 'STU-005', className: 'S2A', attendance: 87, performance: 79, year: 'S2', letter: 'A', gender: 'F', isMonitor: false },
    { initials: 'JB', name: 'Bizimana James',       code: 'STU-006', className: 'S5A', attendance: 94, performance: 91, year: 'S5', letter: 'A', gender: 'M', isMonitor: true  },
    { initials: 'HG', name: 'Hakizimana Grace',     code: 'STU-007', className: 'S3A', attendance: 85, performance: 80, year: 'S3', letter: 'A', gender: 'F', isMonitor: false },
    { initials: 'EN', name: 'Ndagijimana Eric',     code: 'STU-008', className: 'S6A', attendance: 89, performance: 75, year: 'S6', letter: 'A', gender: 'M', isMonitor: false },
    { initials: 'MS', name: 'Mukamazimpaka Sandra', code: 'STU-009', className: 'S1B', attendance: 88, performance: 77, year: 'S1', letter: 'B', gender: 'F', isMonitor: false },
    { initials: 'NP', name: 'Nsabimana Patrick',    code: 'STU-010', className: 'S2B', attendance: 91, performance: 82, year: 'S2', letter: 'B', gender: 'M', isMonitor: false },
]

function performanceBadge(pct) {
    if (pct >= 85) return { label: 'Excellent', cls: 'badge-soft-success' }
    if (pct >= 70) return { label: 'Good',      cls: 'badge-soft-info'    }
    return               { label: 'Fair',       cls: 'badge-soft-warning' }
}

function attendanceBadge(pct) {
    if (pct >= 90) return { label: `${pct}%`, cls: 'badge-soft-success' }
    if (pct >= 80) return { label: `${pct}%`, cls: 'badge-soft-warning' }
    return               { label: `${pct}%`, cls: 'badge-soft-error'   }
}

function StudentRow({ student, onView }) {
    const perf = performanceBadge(student.performance)
    const att  = attendanceBadge(student.attendance)
    return (
        <tr>
            <td>
                <div className="student-info-cell">
                    <div className="student-avatar">{student.initials}</div>
                    <div>
                        <div className="student-name">
                            {student.name}
                            {student.isMonitor && (
                                <span className="material-symbols-rounded" style={{ fontSize: '0.9rem', color: 'var(--warning)', marginLeft: 4, verticalAlign: 'middle' }}>stars</span>
                            )}
                        </div>
                        <div className="student-id-text">{student.code}</div>
                    </div>
                </div>
            </td>
            <td>{student.className}</td>
            <td><span className={`badge ${att.cls}`}>{att.label}</span></td>
            <td>
                <span className={`badge ${perf.cls}`}>{perf.label} ({student.performance}%)</span>
            </td>
            <td>
                <button className="btn btn-sm btn-outline" onClick={() => onView(student)}>
                    <span className="material-symbols-rounded icon-sm">visibility</span>
                    View
                </button>
            </td>
        </tr>
    )
}

export function TeacherStudent() {
    const [section,  setSection]  = useState('')
    const [year,     setYear]     = useState('')
    const [classVal, setClassVal] = useState('')
    const [search,   setSearch]   = useState('')
    const [perfFilter, setPerfFilter]   = useState('all')
    const [selected, setSelected] = useState(null)

    const visible = students.filter(s => {
        if (section) {
            const sec = SECTIONS.find(x => x.name === section)
            if (sec && !sec.years.includes(s.year)) return false
        }
        if (year     && s.year   !== year)     return false
        if (classVal && s.letter !== classVal) return false
        if (search) {
            const q = search.toLowerCase()
            if (!s.name.toLowerCase().includes(q) && !s.code.toLowerCase().includes(q)) return false
        }
        if (perfFilter === 'high' && s.performance < 85) return false
        if (perfFilter === 'mid'  && (s.performance < 70 || s.performance >= 85)) return false
        if (perfFilter === 'low'  && s.performance >= 70) return false
        return true
    })

    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>

            {selected && (
                <Modal title="Student Profile" icon="person" onClose={() => setSelected(null)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
                        <div className="student-avatar" style={{ width: 52, height: 52, fontSize: '1.1rem', flexShrink: 0 }}>
                            {selected.initials}
                        </div>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{selected.name}</div>
                            <div style={{ fontSize: '0.82rem', color: 'var(--muted-foreground)' }}>{selected.code}</div>
                            {selected.isMonitor && (
                                <div style={{ fontSize: '0.78rem', color: 'var(--warning)', fontWeight: 600, marginTop: 4, display: 'flex', alignItems: 'center', gap: 3 }}>
                                    <span className="material-symbols-rounded" style={{ fontSize: '0.9rem' }}>stars</span>
                                    Class Monitor — Appointed by DOS
                                </div>
                            )}
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                        <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginBottom: 2 }}>Class</div>
                            <div style={{ fontWeight: 600 }}>{selected.className}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginBottom: 2 }}>Gender</div>
                            <div style={{ fontWeight: 600 }}>{selected.gender === 'F' ? 'Female' : 'Male'}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginBottom: 2 }}>Attendance</div>
                            <span className={`badge ${attendanceBadge(selected.attendance).cls}`}>{selected.attendance}%</span>
                        </div>
                        <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginBottom: 2 }}>Performance</div>
                            <span className={`badge ${performanceBadge(selected.performance).cls}`}>{selected.performance}%</span>
                        </div>
                    </div>
                </Modal>
            )}

            <div className="dashboard-layout">
                <Sidebar navItems={teacherNavItems} secondaryItems={teacherSecondaryItems} />

                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title="Students"
                        subtitle="View and manage students across your classes"
                        {...teacherUser}
                    />

                    <div className="dashboard-content">

                        <ClassPicker
                            sections={SECTIONS}
                            section={section}   onSectionChange={setSection}
                            year={year}         onYearChange={setYear}
                            classVal={classVal} onClassChange={setClassVal}
                        />

                        {/* Search + performance filter */}
                        <div className="search-filter-bar" style={{ marginBottom: '1.25rem' }}>
                            <div className="search-input-wrapper">
                                <span className="material-symbols-rounded search-input-icon">search</span>
                                <input
                                    type="text"
                                    className="input search-input"
                                    placeholder="Search by name or student code..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                />
                            </div>
                            <div className="filter-group">
                                <select
                                    className="input input-auto"
                                    value={perfFilter}
                                    onChange={e => setPerfFilter(e.target.value)}
                                >
                                    <option value="all">All Performance</option>
                                    <option value="high">Excellent (85%+)</option>
                                    <option value="mid">Good (70–84%)</option>
                                    <option value="low">Fair (below 70%)</option>
                                </select>
                            </div>
                        </div>

                        <div className="card">
                            <div className="card-header">
                                <h3 className="card-title">Student List</h3>
                                <span style={{ fontSize: '0.82rem', color: 'var(--muted-foreground)' }}>
                                    {visible.length} student{visible.length !== 1 ? 's' : ''}
                                </span>
                            </div>
                            <div className="card-content">
                                <div className="table-responsive">
                                    <table className="students-table">
                                        <thead>
                                            <tr>
                                                <th>Student</th>
                                                <th>Class</th>
                                                <th>Attendance</th>
                                                <th>Performance</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {visible.length > 0 ? (
                                                visible.map((s, i) => (
                                                    <StudentRow key={i} student={s} onView={setSelected} />
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan={5} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--muted-foreground)' }}>
                                                        No students match your filters.
                                                    </td>
                                                </tr>
                                            )}
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
