import { useState } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { ClassPicker } from '../../components/ui/ClassPicker'
import { EmptyState } from '../../components/ui/EmptyState'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/teacher.css'
import '../../styles/pages.css'
import { teacherNavItems, teacherSecondaryItems } from './teacherNav'

const SECTIONS = [
    { name: 'O-Level', years: ['S1', 'S2', 'S3'], classes: ['A', 'B', 'C'] },
    { name: 'A-Level', years: ['S4', 'S5', 'S6'], classes: ['A', 'B', 'C'] },
]

const MOCK_STUDENTS = {
    S3A: [
        { id: 'STU-001', initials: 'UA', name: 'Uwase Amina',      status: 'Present', note: '' },
        { id: 'STU-002', initials: 'KM', name: 'Mutabazi Kevin',   status: 'Present', note: '' },
        { id: 'STU-003', initials: 'HG', name: 'Hakizimana Grace', status: 'Present', note: '' },
        { id: 'STU-004', initials: 'IM', name: 'Ingabire Marie',   status: 'Absent',  note: 'Sick leave' },
        { id: 'STU-005', initials: 'UD', name: 'Umutoni Diane',    status: 'Late',    note: 'Arrived 10 min late' },
    ],
    S3B: [
        { id: 'STU-011', initials: 'BN', name: 'Bizimana Norbert', status: 'Present', note: '' },
        { id: 'STU-012', initials: 'RP', name: 'Rugamba Patrick',  status: 'Present', note: '' },
        { id: 'STU-013', initials: 'NK', name: 'Niyonzima Kevin',  status: 'Present', note: '' },
    ],
    S1B: [
        { id: 'STU-021', initials: 'MJ', name: 'Mugisha Jean',     status: 'Present', note: '' },
        { id: 'STU-022', initials: 'KA', name: 'Kayitesi Alice',   status: 'Late',    note: '' },
    ],
    S2A: [
        { id: 'STU-031', initials: 'TN', name: 'Tuyisenge Nina',   status: 'Present', note: '' },
        { id: 'STU-032', initials: 'RM', name: 'Rukundo Marc',     status: 'Absent',  note: 'Family emergency' },
    ],
    S4A: [
        { id: 'STU-041', initials: 'NE', name: 'Nzeyimana Eric',   status: 'Present', note: '' },
        { id: 'STU-042', initials: 'AC', name: 'Akimana Claire',   status: 'Present', note: '' },
        { id: 'STU-043', initials: 'BH', name: 'Bagirishya Henri', status: 'Present', note: '' },
    ],
}

const VIEW_TABS = ['Daily', 'Weekly', 'Monthly', 'Reports']

const STATUS_COLORS = {
    Present: 'var(--success, #16a34a)',
    Absent:  'var(--danger, #dc2626)',
    Late:    'var(--warning, #d97706)',
}

export function TeacherAttendance() {
    const [section, setSection]   = useState('')
    const [year, setYear]         = useState('')
    const [classVal, setClassVal] = useState('')
    const [viewMode, setViewMode] = useState('Daily')
    const [attendance, setAttendance] = useState({})

    const classKey = year && classVal ? `${year}${classVal}` : ''
    const students  = classKey ? (MOCK_STUDENTS[classKey] ?? []) : []

    function getStatus(id, fallback) { return attendance[id]?.status ?? fallback }
    function getNote(id, fallback)   { return attendance[id]?.note   ?? fallback }

    function setStudentStatus(id, status) {
        setAttendance(prev => ({ ...prev, [id]: { status, note: prev[id]?.note ?? '' } }))
    }
    function setStudentNote(id, note) {
        setAttendance(prev => ({ ...prev, [id]: { note, status: prev[id]?.status ?? 'Present' } }))
    }
    function markAllPresent() {
        const next = {}
        students.forEach(s => { next[s.id] = { status: 'Present', note: '' } })
        setAttendance(next)
    }

    const presentCount = students.filter(s => getStatus(s.id, s.status) === 'Present').length
    const absentCount  = students.filter(s => getStatus(s.id, s.status) === 'Absent').length
    const lateCount    = students.filter(s => getStatus(s.id, s.status) === 'Late').length

    const todayLabel = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })

    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>

            <div className="dashboard-layout">
                <Sidebar navItems={teacherNavItems} secondaryItems={teacherSecondaryItems} />

                <main className="dashboard-main" id="main-content">
                    <header className="dashboard-header">
                        <button className="mobile-menu-btn" onClick={() => document.dispatchEvent(new CustomEvent('imboni:open-sidebar'))}>
                            <span className="material-symbols-rounded">menu</span>
                        </button>
                        <div className="dashboard-header-title">
                            <h1>Mark Attendance</h1>
                            <p>Track student attendance for your classes</p>
                        </div>
                        <div className="dashboard-header-actions">
                            <button className="notification-btn">
                                <span className="material-symbols-rounded">notifications</span>
                                <span className="notification-badge">5</span>
                            </button>
                            <div className="header-user">
                                <div className="header-user-info">
                                    <span className="header-user-name">Pacifique Rurangwa</span>
                                    <span className="header-user-role">Teacher</span>
                                </div>
                                <div className="header-user-av teacher-av">PR</div>
                            </div>
                        </div>
                    </header>

                    <div className="dashboard-content">
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
                            background: 'var(--card)',
                            border: '1px solid var(--border)',
                            borderRadius: 16,
                            padding: '0.75rem 1rem',
                            boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                        }}>
                            {VIEW_TABS.map(tab => (
                                <button
                                    key={tab}
                                    className={`btn ${viewMode === tab ? 'btn-primary' : 'btn-outline'}`}
                                    style={{ fontSize: '0.82rem', padding: '0.35rem 0.85rem' }}
                                    onClick={() => setViewMode(tab)}
                                >
                                    {tab}
                                </button>
                            ))}
                            <div style={{ flex: 1 }} />
                            <button className="btn btn-outline" onClick={markAllPresent} style={{ fontSize: '0.82rem' }}>
                                <span className="material-symbols-rounded icon-sm">done_all</span>
                                Mark All Present
                            </button>
                            <button className="btn btn-outline" style={{ fontSize: '0.82rem' }}>
                                <span className="material-symbols-rounded icon-sm">download</span>
                                Export
                            </button>
                        </div>

                        {/* Content area */}
                        {!classKey ? (
                            <EmptyState
                                icon="fact_check"
                                title="No class selected"
                                description="Use the picker above to select a section, year, and class to mark attendance."
                            />
                        ) : students.length === 0 ? (
                            <EmptyState
                                icon="people"
                                title="No students found"
                                description={`No student records are available for ${classKey}.`}
                            />
                        ) : (
                            <>
                                {/* Quick stats */}
                                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                                    {[
                                        { label: 'Present', value: presentCount, color: STATUS_COLORS.Present },
                                        { label: 'Absent',  value: absentCount,  color: STATUS_COLORS.Absent  },
                                        { label: 'Late',    value: lateCount,    color: STATUS_COLORS.Late    },
                                        { label: 'Total',   value: students.length, color: 'var(--primary)'  },
                                    ].map(s => (
                                        <div key={s.label} style={{
                                            flex: 1, minWidth: 90,
                                            background: 'var(--card)', border: '1px solid var(--border)',
                                            borderRadius: 12, padding: '0.75rem 1rem',
                                            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                                        }}>
                                            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: s.color }}>{s.value}</div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>{s.label}</div>
                                        </div>
                                    ))}
                                </div>

                                {/* Attendance list container */}
                                <div style={{
                                    background: 'var(--card)',
                                    border: '1px solid var(--border)',
                                    borderRadius: 16,
                                    overflow: 'hidden',
                                    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                                }}>
                                    <div style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)',
                                    }}>
                                        <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                                            {classKey} — {students.length} Students
                                        </div>
                                        <select className="input input-auto" style={{ fontSize: '0.82rem' }}>
                                            <option>Today — {todayLabel}</option>
                                            <option>Yesterday</option>
                                        </select>
                                    </div>

                                    <div className="table-responsive">
                                        <table className="students-table">
                                            <thead>
                                                <tr>
                                                    <th>Student</th>
                                                    <th>Status</th>
                                                    <th>Notes</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {students.map(s => (
                                                    <tr key={s.id}>
                                                        <td>
                                                            <div className="student-info-cell">
                                                                <div className="student-avatar">{s.initials}</div>
                                                                <div>
                                                                    <div className="student-name">{s.name}</div>
                                                                    <div className="student-id-text">{s.id}</div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <select
                                                                className="input input-auto"
                                                                value={getStatus(s.id, s.status)}
                                                                onChange={e => setStudentStatus(s.id, e.target.value)}
                                                                style={{ color: STATUS_COLORS[getStatus(s.id, s.status)] }}
                                                            >
                                                                <option>Present</option>
                                                                <option>Absent</option>
                                                                <option>Late</option>
                                                            </select>
                                                        </td>
                                                        <td>
                                                            <input
                                                                type="text"
                                                                className="input"
                                                                placeholder="Optional notes..."
                                                                value={getNote(s.id, s.note)}
                                                                onChange={e => setStudentNote(s.id, e.target.value)}
                                                            />
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    <div style={{
                                        display: 'flex', justifyContent: 'flex-end', gap: '0.75rem',
                                        padding: '1rem 1.25rem', borderTop: '1px solid var(--border)',
                                    }}>
                                        <button className="btn btn-outline" onClick={() => setAttendance({})}>Reset</button>
                                        <button className="btn btn-primary">
                                            <span className="material-symbols-rounded icon-sm">save</span>
                                            Save Attendance
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </main>
            </div>
        </>
    )
}
