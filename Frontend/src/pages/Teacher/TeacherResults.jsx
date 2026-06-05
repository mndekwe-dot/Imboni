import { useState, useEffect, useRef } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { ClassPicker } from '../../components/ui/ClassPicker'
import { EmptyState } from '../../components/ui/EmptyState'
import { DataTable } from '../../components/ui/DataTable'
import { Modal } from '../../components/ui/Modal'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/teacher.css'
import '../../styles/tables.css'
import { teacherNavItems, teacherSecondaryItems } from './teacherNav'
import { DashboardContent } from '../../components/layout/DashboardContent'
import {
    getTeacherMyClasses, getTeacherStudents,
    getTeacherResultList, bulkSaveResults,
} from '../../api/teacher'

const ASSESSMENT_TYPES = [
    { value: 'quiz',         label: 'Quiz'         },
    { value: 'homework',     label: 'Homework'     },
    { value: 'project',      label: 'Project'      },
    { value: 'presentation', label: 'Presentation' },
    { value: 'lab',          label: 'Lab Work'     },
]

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

// ── Enter New Results Modal ───────────────────────────────────────────────────

function EnterResultsModal({ classObj, classes, onClose, onSaved }) {
    // Derive all subjects this teacher teaches in this class
    const subjectsForClass = classes
        .filter(c => String(c.class_id) === String(classObj.class_id) && c.subject_id)
        .reduce((acc, c) => {
            if (!acc.find(s => s.id === String(c.subject_id))) {
                acc.push({ id: String(c.subject_id), name: c.subject_name })
            }
            return acc
        }, [])

    const today = new Date().toISOString().slice(0, 10)

    const [form, setForm] = useState({
        title:           '',
        assessment_type: 'quiz',
        subject_id:      subjectsForClass[0]?.id || '',
        date:            today,
        max_score:       '',
    })
    const [students,     setStudents]     = useState([])
    const [scores,       setScores]       = useState({})   // student_id → number | ''
    const [skipped,      setSkipped]      = useState({})   // student_id → bool
    const [notes,        setNotes]        = useState({})   // student_id → string
    const [loadingStud,  setLoadingStud]  = useState(true)
    const [saving,       setSaving]       = useState(false)
    const [saveError,    setSaveError]    = useState(null)

    useEffect(() => {
        getTeacherStudents({ class_id: classObj.class_id })
            .then(data => {
                const list = Array.isArray(data) ? data : []
                setStudents(list)
                const initScores = {}
                const initSkip   = {}
                const initNotes  = {}
                list.forEach(s => {
                    initScores[s.student_id] = ''
                    initSkip[s.student_id]   = false
                    initNotes[s.student_id]  = ''
                })
                setScores(initScores)
                setSkipped(initSkip)
                setNotes(initNotes)
            })
            .catch(() => {})
            .finally(() => setLoadingStud(false))
    }, [classObj.class_id])

    function handle(field, value) {
        setForm(prev => ({ ...prev, [field]: value }))
    }

    function setScore(studentId, value) {
        const max = parseFloat(form.max_score)
        const num = parseFloat(value)
        if (value !== '' && !isNaN(max) && max > 0 && num > max) return
        setScores(prev => ({ ...prev, [studentId]: value }))
    }

    async function handleSave() {
        if (!form.title.trim()) return setSaveError('Please enter an assessment title.')
        if (!form.subject_id)   return setSaveError('Please select a subject.')
        if (!form.date)         return setSaveError('Please enter the assessment date.')
        if (!form.max_score || isNaN(parseFloat(form.max_score)) || parseFloat(form.max_score) < 1)
            return setSaveError('Please enter a valid max score (minimum 1).')

        const entries = students
            .filter(s => !skipped[s.student_id] && scores[s.student_id] !== '')
            .map(s => ({
                student_id:     s.student_id,
                score_obtained: parseFloat(scores[s.student_id]) || 0,
                notes:          (notes[s.student_id] || '').trim(),
            }))

        if (entries.length === 0)
            return setSaveError('Please enter at least one student score.')

        setSaving(true); setSaveError(null)
        try {
            await bulkSaveResults({
                class_id:         classObj.class_id,
                subject_id:       form.subject_id,
                assessment_title: form.title.trim(),
                assessment_type:  form.assessment_type,
                date:             form.date,
                max_score:        parseFloat(form.max_score),
                entries,
            })
            onSaved(form.title.trim())
            onClose()
        } catch (e) {
            setSaveError(e?.response?.data?.detail || e?.message || 'Failed to save results.')
        } finally {
            setSaving(false)
        }
    }

    const filledCount = students.filter(
        s => !skipped[s.student_id] && scores[s.student_id] !== ''
    ).length

    return (
        <Modal
            title="Enter New Results"
            icon="add_circle"
            onClose={onClose}
            size="wide"
            footer={
                <div className="modal-footer-row">
                    <span className="modal-footer-hint" style={{ color: saveError ? '#dc2626' : 'var(--muted-foreground)' }}>
                        {saveError || (filledCount > 0 ? `${filledCount} student${filledCount !== 1 ? 's' : ''} with scores` : '* Fill in all fields and at least one score')}
                    </span>
                    <button className="btn btn-outline" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                        <span className="material-symbols-rounded icon-sm">save</span>
                        {saving ? 'Saving…' : 'Save Results'}
                    </button>
                </div>
            }
        >
            {/* Assessment details */}
            <div className="resp-grid-2" style={{ gap: '0.75rem', marginBottom: '1.25rem' }}>
                <div className="form-group col-full">
                    <label className="form-label">Assessment Title *</label>
                    <input
                        className="form-control"
                        placeholder="e.g. Pop Quiz 1 – Algebra"
                        value={form.title}
                        onChange={e => handle('title', e.target.value)}
                    />
                </div>
                <div className="form-group">
                    <label className="form-label">Type *</label>
                    <select className="form-control" value={form.assessment_type} onChange={e => handle('assessment_type', e.target.value)}>
                        {ASSESSMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                </div>
                <div className="form-group">
                    <label className="form-label">Subject *</label>
                    <select className="form-control" value={form.subject_id} onChange={e => handle('subject_id', e.target.value)}>
                        {subjectsForClass.length === 0
                            ? <option value="">No subjects assigned</option>
                            : subjectsForClass.map(s => <option key={s.id} value={s.id}>{s.name}</option>)
                        }
                    </select>
                </div>
                <div className="form-group">
                    <label className="form-label">Date *</label>
                    <input className="form-control" type="date" value={form.date} onChange={e => handle('date', e.target.value)} />
                </div>
                <div className="form-group">
                    <label className="form-label">Max Score *</label>
                    <input
                        className="form-control"
                        type="number" min="1" step="1"
                        placeholder="e.g. 30"
                        value={form.max_score}
                        onChange={e => handle('max_score', e.target.value)}
                    />
                </div>
            </div>

            {/* Student score entry table */}
            <div className="section-label-sm" style={{ marginBottom: '0.5rem' }}>
                Student Scores — {classObj.class_name}
            </div>
            {loadingStud ? (
                <p style={{ color: 'var(--muted-foreground)', padding: '1rem 0' }}>Loading students…</p>
            ) : students.length === 0 ? (
                <p style={{ color: 'var(--muted-foreground)' }}>No students found for this class.</p>
            ) : (
                <div className="table-responsive" style={{ maxHeight: 340, overflowY: 'auto' }}>
                    <table>
                        <thead style={{ position: 'sticky', top: 0, background: 'var(--card)', zIndex: 1 }}>
                            <tr>
                                <th>Student</th>
                                <th style={{ width: 110 }}>Score {form.max_score ? `/ ${form.max_score}` : ''}</th>
                                <th>Comment <span style={{ fontWeight: 400, color: 'var(--muted-foreground)' }}>(optional)</span></th>
                                <th style={{ width: 80, textAlign: 'center' }}>Absent</th>
                            </tr>
                        </thead>
                        <tbody>
                            {students.map(s => (
                                <tr key={s.student_id} style={{ opacity: skipped[s.student_id] ? 0.45 : 1 }}>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                            <div className="dt-avatar" style={{ flexShrink: 0 }}>{s.initials}</div>
                                            <div>
                                                <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{s.full_name}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>{s.student_code}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <input
                                            type="number"
                                            min="0"
                                            max={form.max_score || undefined}
                                            step="0.5"
                                            className="form-control"
                                            style={{ padding: '0.3rem 0.5rem', fontSize: '0.875rem' }}
                                            placeholder="—"
                                            value={scores[s.student_id] ?? ''}
                                            disabled={skipped[s.student_id]}
                                            onChange={e => setScore(s.student_id, e.target.value)}
                                        />
                                    </td>
                                    <td>
                                        <input
                                            type="text"
                                            className="form-control"
                                            style={{ padding: '0.3rem 0.5rem', fontSize: '0.875rem' }}
                                            placeholder="e.g. Good effort, needs revision…"
                                            value={notes[s.student_id] ?? ''}
                                            disabled={skipped[s.student_id]}
                                            onChange={e => setNotes(prev => ({ ...prev, [s.student_id]: e.target.value }))}
                                        />
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <input
                                            type="checkbox"
                                            checked={!!skipped[s.student_id]}
                                            onChange={e => setSkipped(prev => ({ ...prev, [s.student_id]: e.target.checked }))}
                                            style={{ width: '1rem', height: '1rem', cursor: 'pointer' }}
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </Modal>
    )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function TeacherResults() {
    const [classes,    setClasses]    = useState([])
    const [sections,   setSections]   = useState([])
    const [loadingClasses, setLoadingClasses] = useState(true)
    const [loadError,  setLoadError]  = useState(null)

    const [section,    setSection]    = useState('')
    const [year,       setYear]       = useState('')
    const [classVal,   setClassVal]   = useState('')
    const [assessment, setAssessment] = useState('')
    const [titles,     setTitles]     = useState([])
    const [rows,       setRows]       = useState([])
    const [loadingData, setLoadingData] = useState(false)

    const [showEnterModal, setShowEnterModal] = useState(false)

    const fileInputRef = useRef(null)

    const storedUser = JSON.parse(localStorage.getItem('imboni_user') || '{}')
    const firstName  = storedUser.first_name || ''
    const lastName   = storedUser.last_name  || ''
    const fullName   = storedUser.full_name  || `${firstName} ${lastName}`.trim() || 'Teacher'
    const initials   = `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase() || 'T'

    useEffect(() => {
        getTeacherMyClasses()
            .then(data => {
                const list = Array.isArray(data) ? data : []
                setClasses(list)
                setSections(buildSections(list))
            })
            .catch(err => setLoadError(err?.message || 'Failed to load classes.'))
            .finally(() => setLoadingClasses(false))
    }, [])

    const selectedClass = year && classVal
        ? classes.find(c => `S${c.grade}` === year && c.section === classVal) || null
        : null
    const classKey = selectedClass ? selectedClass.class_name : ''

    function refreshResults(newTitle) {
        if (!selectedClass) return
        setLoadingData(true)
        const params = { class_id: selectedClass.class_id }
        if (newTitle) params.assessment_title = newTitle
        getTeacherResultList(params)
            .then(res => {
                const newTitles = res.assessment_titles || []
                setTitles(newTitles)
                setRows(res.results || [])
                if (newTitle && newTitles.includes(newTitle)) setAssessment(newTitle)
                else if (!assessment && newTitles.length > 0) setAssessment(newTitles[0])
            })
            .catch(() => { setTitles([]); setRows([]) })
            .finally(() => setLoadingData(false))
    }

    useEffect(() => {
        if (!selectedClass) { setTitles([]); setRows([]); setAssessment(''); return }
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

    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>

            {showEnterModal && selectedClass && (
                <EnterResultsModal
                    classObj={selectedClass}
                    classes={classes}
                    onClose={() => setShowEnterModal(false)}
                    onSaved={title => refreshResults(title)}
                />
            )}

            <div className="dashboard-layout">
                <Sidebar navItems={teacherNavItems} secondaryItems={teacherSecondaryItems} />

                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title="Results"
                        subtitle="View and enter student assessment results"
                        userName={fullName}
                        userRole="Teacher"
                        userInitials={initials}
                        avatarClass="teacher-av"
                    />

                    <DashboardContent>
                        {loadError && (
                            <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>
                                <span className="material-symbols-rounded" style={{ fontSize: '1rem', verticalAlign: 'middle', marginRight: '0.4rem' }}>error</span>
                                {loadError}
                            </div>
                        )}
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
                                    />
                                    <button
                                        className="btn btn-primary select-xs"
                                        onClick={() => setShowEnterModal(true)}
                                        disabled={!selectedClass}
                                        title={selectedClass ? 'Create a new assessment and enter marks' : 'Select a class first'}
                                    >
                                        <span className="material-symbols-rounded icon-sm">add</span>
                                        Enter Results
                                    </button>
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
                                    <EmptyState icon="school" title="No class selected" description="Use the picker above to select a section, year, and class to view or enter results." />
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
                                            emptyDesc={
                                                <span>
                                                    No results recorded{assessment ? ` for "${assessment}"` : ''} in {classKey} yet.{' '}
                                                    <button
                                                        className="btn-link"
                                                        style={{ color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 'inherit' }}
                                                        onClick={() => setShowEnterModal(true)}
                                                    >
                                                        Enter the first results now.
                                                    </button>
                                                </span>
                                            }
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
