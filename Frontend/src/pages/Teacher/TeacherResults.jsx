import { useState } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { ClassPicker } from '../../components/ui/ClassPicker'
import { EmptyState } from '../../components/ui/EmptyState'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/teacher.css'
import { teacherNavItems, teacherSecondaryItems } from './teacherNav'
import { DashboardContent } from '../../components/layout/DashboardContent'

const SECTIONS = [
    { name: 'O-Level', years: ['S1', 'S2', 'S3'], classes: ['A', 'B', 'C'] },
    { name: 'A-Level', years: ['S4', 'S5', 'S6'], classes: ['A', 'B', 'C'] },
]

const ASSESSMENTS = ['Mid-Term Exam', 'End Term Exam', 'CAT 1', 'CAT 2']

const MOCK_RESULTS = {
    'S3A': {
        'Mid-Term Exam': [
            { id: 'STU-001', initials: 'UA', name: 'Uwase Amina',      score: 85, max: 100, date: 'Jan 15, 2026' },
            { id: 'STU-002', initials: 'KM', name: 'Mutabazi Kevin',   score: 78, max: 100, date: 'Jan 15, 2026' },
            { id: 'STU-003', initials: 'HG', name: 'Hakizimana Grace', score: 92, max: 100, date: 'Jan 15, 2026' },
            { id: 'STU-004', initials: 'IM', name: 'Ingabire Marie',   score: 88, max: 100, date: 'Jan 15, 2026' },
            { id: 'STU-005', initials: 'PN', name: 'Nkurunziza Peter', score: 79, max: 100, date: 'Jan 15, 2026' },
            { id: 'STU-006', initials: 'JB', name: 'Bizimana James',   score: 94, max: 100, date: 'Jan 15, 2026' },
        ],
        'CAT 1': [
            { id: 'STU-001', initials: 'UA', name: 'Uwase Amina',      score: 18, max: 20, date: 'Dec 10, 2025' },
            { id: 'STU-002', initials: 'KM', name: 'Mutabazi Kevin',   score: 15, max: 20, date: 'Dec 10, 2025' },
            { id: 'STU-003', initials: 'HG', name: 'Hakizimana Grace', score: 19, max: 20, date: 'Dec 10, 2025' },
        ],
    },
    'S4A': {
        'Mid-Term Exam': [
            { id: 'STU-041', initials: 'NE', name: 'Nzeyimana Eric',   score: 72, max: 100, date: 'Jan 15, 2026' },
            { id: 'STU-042', initials: 'AC', name: 'Akimana Claire',   score: 88, max: 100, date: 'Jan 15, 2026' },
        ],
    },
}

function getGrade(score, max) {
    const pct = (score / max) * 100
    if (pct >= 80) return { label: 'A', cls: 'a' }
    if (pct >= 70) return { label: 'B', cls: 'b' }
    if (pct >= 60) return { label: 'C', cls: 'c' }
    if (pct >= 50) return { label: 'D', cls: 'd' }
    return { label: 'F', cls: 'f' }
}

export function TeacherResults() {
    const [section, setSection]     = useState('')
    const [year, setYear]           = useState('')
    const [classVal, setClassVal]   = useState('')
    const [assessment, setAssessment] = useState('Mid-Term Exam')

    const classKey = year && classVal ? `${year}${classVal}` : ''
    const rows = classKey ? (MOCK_RESULTS[classKey]?.[assessment] ?? []) : []

    const avg     = rows.length ? Math.round(rows.reduce((s, r) => s + r.score, 0) / rows.length) : 0
    const highest = rows.length ? rows.reduce((a, b) => a.score > b.score ? a : b) : null
    const passRate = rows.length ? Math.round((rows.filter(r => (r.score / r.max) >= 0.5).length / rows.length) * 100) : 0

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
                            <h1>Results</h1>
                            <p>View and manage student assessment results</p>
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

                    <DashboardContent>
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
                            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--muted-foreground)' }}>Assessment:</span>
                            <select
                                className="input input-auto"
                                value={assessment}
                                onChange={e => setAssessment(e.target.value)}
                                style={{ fontSize: '0.82rem' }}
                            >
                                {ASSESSMENTS.map(a => <option key={a}>{a}</option>)}
                            </select>
                            <div style={{ flex: 1 }} />
                            <button className="btn btn-outline" style={{ fontSize: '0.82rem' }}>
                                <span className="material-symbols-rounded icon-sm">file_upload</span>
                                Import CSV
                            </button>
                            <button className="btn btn-outline" style={{ fontSize: '0.82rem' }}>
                                <span className="material-symbols-rounded icon-sm">download</span>
                                Export
                            </button>
                        </div>

                        {/* Content area */}
                        {!classKey ? (
                            <EmptyState
                                icon="school"
                                title="No class selected"
                                description="Use the picker above to select a section, year, and class to view results."
                            />
                        ) : rows.length === 0 ? (
                            <EmptyState
                                icon="assignment_late"
                                title="No results found"
                                description={`No ${assessment} results have been recorded for ${classKey} yet.`}
                                action={{ label: 'Enter Results', icon: 'add', onClick: () => {} }}
                            />
                        ) : (
                            <>
                                {/* Quick stats */}
                                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                                    {[
                                        { label: 'Class Average', value: `${avg}%`,           color: 'var(--primary)' },
                                        { label: 'Top Score',     value: highest ? `${highest.score}/${highest.max}` : '—', color: 'var(--success, #16a34a)' },
                                        { label: 'Pass Rate',     value: `${passRate}%`,        color: 'var(--warning, #d97706)' },
                                        { label: 'Students',      value: rows.length,           color: 'var(--muted-foreground)' },
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

                                {/* Results list container */}
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
                                            {classKey} — {assessment}
                                        </div>
                                        <span style={{ fontSize: '0.82rem', color: 'var(--muted-foreground)' }}>
                                            {rows.length} student{rows.length !== 1 ? 's' : ''}
                                        </span>
                                    </div>

                                    <div className="table-responsive">
                                        <table className="results-table">
                                            <thead>
                                                <tr>
                                                    <th>Student</th>
                                                    <th>Score</th>
                                                    <th>Grade</th>
                                                    <th>Date</th>
                                                    <th>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {rows.map(r => {
                                                    const g = getGrade(r.score, r.max)
                                                    return (
                                                        <tr key={r.id}>
                                                            <td>
                                                                <div className="student-info-cell">
                                                                    <div className="student-avatar">{r.initials}</div>
                                                                    <div>
                                                                        <div className="student-name">{r.name}</div>
                                                                        <div className="student-id-text">{r.id}</div>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td>{r.score}/{r.max}</td>
                                                            <td><span className={`grade-badge ${g.cls}`}>{g.label}</span></td>
                                                            <td>{r.date}</td>
                                                            <td><button className="btn btn-sm btn-outline">Edit</button></td>
                                                        </tr>
                                                    )
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </>
                        )}
                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
