import { useState, useRef } from 'react'
import { Link } from 'react-router'
import { Sidebar } from '../../components/layout/Sidebar'
import { ClassPicker } from '../../components/ui/ClassPicker'
import { EmptyState } from '../../components/ui/EmptyState'
import { DataTable } from '../../components/ui/DataTable'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/teacher.css'
import '../../styles/tables.css'
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
    const [section, setSection]       = useState('')
    const [year, setYear]             = useState('')
    const [classVal, setClassVal]     = useState('')
    const [assessment, setAssessment] = useState('Mid-Term Exam')
    const [importedMap, setImportedMap] = useState({})
    const fileInputRef = useRef(null)

    const classKey   = year && classVal ? `${year}${classVal}` : ''
    const mapKey     = `${classKey}:${assessment}`
    const baseRows   = classKey ? (MOCK_RESULTS[classKey]?.[assessment] ?? []) : []
    const rows       = importedMap[mapKey] ?? baseRows

    const avg      = rows.length ? Math.round(rows.reduce((s, r) => s + r.score, 0) / rows.length) : 0
    const highest  = rows.length ? rows.reduce((a, b) => a.score > b.score ? a : b) : null
    const passRate = rows.length ? Math.round((rows.filter(r => (r.score / r.max) >= 0.5).length / rows.length) * 100) : 0

    function handleExport() {
        if (!rows.length) return
        const header = 'Student,Score,Max,Grade,Date'
        const body = rows.map(r => {
            const g = getGrade(r.score, r.max)
            return `"${r.name}",${r.score},${r.max},${g.label},"${r.date}"`
        }).join('\n')
        const blob = new Blob([header + '\n' + body], { type: 'text/csv' })
        const url  = URL.createObjectURL(blob)
        const a    = document.createElement('a')
        a.href = url; a.download = `${classKey || 'results'}-${assessment}.csv`; a.click()
        URL.revokeObjectURL(url)
    }

    function handleImport(e) {
        const file = e.target.files?.[0]
        if (!file || !classKey) return
        const reader = new FileReader()
        reader.onload = ev => {
            const lines = ev.target.result.split('\n').filter(l => l.trim())
            const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase())
            const parsed = lines.slice(1).map((line, i) => {
                const vals = line.split(',').map(v => v.replace(/"/g, '').trim())
                const obj  = Object.fromEntries(headers.map((h, j) => [h, vals[j] ?? '']))
                return {
                    id:       `IMP-${String(i + 1).padStart(3, '0')}`,
                    initials: (obj.student || obj.name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase(),
                    name:     obj.student || obj.name || `Student ${i + 1}`,
                    score:    parseInt(obj.score) || 0,
                    max:      parseInt(obj.max)   || 100,
                    date:     obj.date || 'Imported',
                }
            }).filter(r => r.name)
            if (parsed.length) setImportedMap(prev => ({ ...prev, [mapKey]: parsed }))
        }
        reader.readAsText(file)
        e.target.value = ''
    }

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
                                <Link to="/profile" className="header-user-av teacher-av">PR</Link>
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
                        <div className="toolbar-card">
                            <span className="settings-info-text fw-600">Assessment:</span>
                            <select
                                className="input input-auto select-xs"
                                value={assessment}
                                onChange={e => setAssessment(e.target.value)}
                            >
                                {ASSESSMENTS.map(a => <option key={a}>{a}</option>)}
                            </select>
                            <div className="toolbar-spacer" />
                            <input ref={fileInputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleImport} />
                            <button className="btn btn-outline select-xs" onClick={() => classKey && fileInputRef.current?.click()} title={classKey ? 'Import results from CSV' : 'Select a class first'}>
                                <span className="material-symbols-rounded icon-sm">file_upload</span>
                                Import CSV
                            </button>
                            <button className="btn btn-outline select-xs" onClick={handleExport} disabled={!rows.length}>
                                <span className="material-symbols-rounded icon-sm">download</span>
                                Export
                            </button>
                        </div>

                        {/* Content area */}
                        {!classKey ? (
                            <EmptyState icon="school" title="No class selected" description="Use the picker above to select a section, year, and class to view results." />
                        ) : (
                            <>
                                {/* Quick stats */}
                                {rows.length > 0 && (
                                    <div className="mini-stats-row">
                                        {[
                                            { label:'Class Average', value:`${avg}%`,      colorClass:'text-primary'  },
                                            { label:'Top Score',     value: highest ? `${highest.score}/${highest.max}` : '—', colorClass:'text-success' },
                                            { label:'Pass Rate',     value:`${passRate}%`,  colorClass:'text-warning'  },
                                            { label:'Students',      value: rows.length,    colorClass:'text-muted'    },
                                        ].map(s => (
                                            <div key={s.label} className="mini-stat">
                                                <div className={`mini-stat-value ${s.colorClass}`}>{s.value}</div>
                                                <div className="mini-stat-label">{s.label}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <DataTable
                                    title={`${classKey} — ${assessment}`}
                                    data={rows}
                                    columns={['Student','Score','Grade','Date','Actions']}
                                    renderRow={r => {
                                        const g = getGrade(r.score, r.max)
                                        return (
                                            <tr key={r.id}>
                                                <td>
                                                    <div className="dt-cell-user">
                                                        <div className="dt-avatar">{r.initials}</div>
                                                        <div><div className="dt-name">{r.name}</div><div className="dt-sub">{r.id}</div></div>
                                                    </div>
                                                </td>
                                                <td>{r.score}/{r.max}</td>
                                                <td><span className={`grade-badge ${g.cls}`}>{g.label}</span></td>
                                                <td>{r.date}</td>
                                                <td><button className="btn btn-sm btn-outline">Edit</button></td>
                                            </tr>
                                        )
                                    }}
                                    emptyIcon="assignment_late"
                                    emptyTitle="No results found"
                                    emptyDesc={`No ${assessment} results recorded for ${classKey} yet.`}
                                />
                            </>
                        )}
                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
