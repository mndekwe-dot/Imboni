import { useState, useEffect, useRef } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { ClassPicker } from '../../components/ui/ClassPicker'
import { EmptyState } from '../../components/ui/EmptyState'
import { DataTable } from '../../components/ui/DataTable'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/teacher.css'
import '../../styles/tables.css'
import { teacherNavItems, teacherSecondaryItems } from './teacherNav'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { getTeacherMyClasses, getTeacherResultList } from '../../api/teacher'

function buildSections(classes) {
    const oLevel = { name: 'O-Level', years: [] }
    const aLevel = { name: 'A-Level', years: [] }
    for (const cls of classes) {
        const grade = parseInt(cls.grade)
        const group = grade <= 3 ? oLevel : aLevel
        const yearName = `S${cls.grade}`
        let yearObj = group.years.find(y => y.name === yearName)
        if (!yearObj) {
            yearObj = { name: yearName, streams: [] }
            group.years.push(yearObj)
        }
        if (!yearObj.streams.includes(cls.section)) yearObj.streams.push(cls.section)
    }
    return [oLevel, aLevel].filter(s => s.years.length > 0)
}

function getGrade(pct) {
    if (pct >= 80) return { label: 'A', cls: 'a' }
    if (pct >= 70) return { label: 'B', cls: 'b' }
    if (pct >= 60) return { label: 'C', cls: 'c' }
    if (pct >= 50) return { label: 'D', cls: 'd' }
    return { label: 'F', cls: 'f' }
}

export function TeacherResults() {
    const [classes,    setClasses]    = useState([])
    const [sections,   setSections]   = useState([])
    const [loadingClasses, setLoadingClasses] = useState(true)

    const [section,    setSection]    = useState('')
    const [year,       setYear]       = useState('')
    const [classVal,   setClassVal]   = useState('')
    const [assessment, setAssessment] = useState('')
    const [titles,     setTitles]     = useState([])
    const [rows,       setRows]       = useState([])
    const [loadingData, setLoadingData] = useState(false)

    const fileInputRef = useRef(null)

    const storedUser = JSON.parse(localStorage.getItem('imboni_user') || '{}')
    const firstName  = storedUser.first_name || ''
    const lastName   = storedUser.last_name  || ''
    const fullName   = storedUser.full_name  || `${firstName} ${lastName}`.trim() || 'Teacher'
    const initials   = `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase() || 'T'

    // Load teacher's classes
    useEffect(() => {
        getTeacherMyClasses()
            .then(data => {
                const list = Array.isArray(data) ? data : []
                setClasses(list)
                setSections(buildSections(list))
            })
            .catch(() => {})
            .finally(() => setLoadingClasses(false))
    }, [])

    // Derive selected class object
    const selectedClass = year && classVal
        ? classes.find(c => `S${c.grade}` === year && c.section === classVal) || null
        : null
    const classKey = selectedClass ? selectedClass.class_name : ''

    // Load assessment titles + results when class or assessment changes
    useEffect(() => {
        if (!selectedClass) {
            setTitles([])
            setRows([])
            setAssessment('')
            return
        }
        setLoadingData(true)
        const params = { class_id: selectedClass.class_id }
        if (assessment) params.assessment_title = assessment
        getTeacherResultList(params)
            .then(res => {
                const newTitles = res.assessment_titles || []
                setTitles(newTitles)
                setRows(res.results || [])
                if (assessment && !newTitles.includes(assessment)) setAssessment('')
                if (!assessment && newTitles.length > 0) setAssessment(newTitles[0])
            })
            .catch(() => { setTitles([]); setRows([]) })
            .finally(() => setLoadingData(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedClass?.class_id, assessment])

    const avg      = rows.length ? Math.round(rows.reduce((s, r) => s + r.percentage, 0) / rows.length) : 0
    const highest  = rows.length ? rows.reduce((a, b) => a.percentage > b.percentage ? a : b) : null
    const passRate = rows.length ? Math.round((rows.filter(r => r.percentage >= 50).length / rows.length) * 100) : 0

    function handleExport() {
        if (!rows.length) return
        const header = 'Student,Score,Grade,Date'
        const body = rows.map(r => `"${r.full_name}",${r.score_display},${r.grade},"${r.date}"`).join('\n')
        const blob = new Blob([header + '\n' + body], { type: 'text/csv' })
        const url  = URL.createObjectURL(blob)
        const a    = document.createElement('a')
        a.href = url
        a.download = `${classKey || 'results'}-${assessment || 'all'}.csv`
        a.click()
        URL.revokeObjectURL(url)
    }

    function handleImport(e) {
        const file = e.target.files?.[0]
        if (!file) return
        // CSV import is read-only preview (no API import endpoint yet)
        e.target.value = ''
    }

    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>

            <div className="dashboard-layout">
                <Sidebar navItems={teacherNavItems} secondaryItems={teacherSecondaryItems} />

                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title="Results"
                        subtitle="View student assessment results"
                        userName={fullName}
                        userRole="Teacher"
                        userInitials={initials}
                        avatarClass="teacher-av"
                    />

                    <DashboardContent>
                        {loadingClasses ? (
                            <EmptyState icon="sync" title="Loading classes…" description="Fetching your assigned classes." />
                        ) : (
                            <>
                                <ClassPicker
                                    sections={sections}
                                    section={section}
                                    onSectionChange={v => { setSection(v); setYear(''); setClassVal('') }}
                                    year={year}
                                    onYearChange={v => { setYear(v); setClassVal('') }}
                                    classVal={classVal}
                                    onClassChange={setClassVal}
                                />

                                <div className="toolbar-card">
                                    <span className="settings-info-text fw-600">Assessment:</span>
                                    {titles.length > 0 ? (
                                        <select
                                            className="input input-auto select-xs"
                                            value={assessment}
                                            onChange={e => setAssessment(e.target.value)}
                                        >
                                            {titles.map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                    ) : (
                                        <span className="settings-info-text" style={{ color: 'var(--muted-foreground)' }}>
                                            {selectedClass ? 'No assessments yet' : 'Select a class first'}
                                        </span>
                                    )}
                                    <div className="toolbar-spacer" />
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".csv"
                                        style={{ display: 'none' }}
                                        onChange={handleImport}
                                    />
                                    <button
                                        className="btn btn-outline select-xs"
                                        onClick={handleExport}
                                        disabled={!rows.length}
                                    >
                                        <span className="material-symbols-rounded icon-sm">download</span>
                                        Export
                                    </button>
                                </div>

                                {!selectedClass ? (
                                    <EmptyState icon="school" title="No class selected" description="Use the picker above to select a section, year, and class to view results." />
                                ) : loadingData ? (
                                    <EmptyState icon="sync" title="Loading…" description={`Fetching results for ${classKey}.`} />
                                ) : (
                                    <>
                                        {rows.length > 0 && (
                                            <div className="mini-stats-row">
                                                {[
                                                    { label: 'Class Average', value: `${avg}%`,     colorClass: 'text-primary'  },
                                                    { label: 'Top Score',     value: highest ? highest.score_display : '—', colorClass: 'text-success' },
                                                    { label: 'Pass Rate',     value: `${passRate}%`, colorClass: 'text-warning'  },
                                                    { label: 'Students',      value: rows.length,    colorClass: 'text-muted'    },
                                                ].map(s => (
                                                    <div key={s.label} className="mini-stat">
                                                        <div className={`mini-stat-value ${s.colorClass}`}>{s.value}</div>
                                                        <div className="mini-stat-label">{s.label}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        <DataTable
                                            title={`${classKey}${assessment ? ` — ${assessment}` : ''}`}
                                            data={rows}
                                            columns={['Student', 'Score', 'Grade', 'Date']}
                                            renderRow={r => {
                                                const g = getGrade(r.percentage)
                                                return (
                                                    <tr key={r.assessment_id}>
                                                        <td>
                                                            <div className="dt-cell-user">
                                                                <div className="dt-avatar">{r.initials}</div>
                                                                <div>
                                                                    <div className="dt-name">{r.full_name}</div>
                                                                    <div className="dt-sub">{r.student_code}</div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td>{r.score_display}</td>
                                                        <td><span className={`grade-badge ${g.cls}`}>{g.label}</span></td>
                                                        <td>{r.date}</td>
                                                    </tr>
                                                )
                                            }}
                                            emptyIcon="assignment_late"
                                            emptyTitle="No results found"
                                            emptyDesc={`No results recorded${assessment ? ` for "${assessment}"` : ''} in ${classKey} yet.`}
                                        />
                                    </>
                                )}
                            </>
                        )}
                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
