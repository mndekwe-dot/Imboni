import { useState, useEffect } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useNotifications } from '../../hooks/useNotifications'
import { ClassPicker } from '../../components/ui/ClassPicker'
import { Modal } from '../../components/ui/Modal'
import { EmptyState } from '../../components/ui/EmptyState'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/teacher.css'
import { teacherNavItems, teacherSecondaryItems } from './teacherNav'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { getTeacherMyClasses, getTeacherStudents, getTeacherResultList, bulkSaveResults } from '../../api/teacher'

const CARD_BG = ['#eef6ff', '#edfaf4', '#f3f0ff', '#fff7ed', '#e8f8fb', '#fff0f3']

const ASSESSMENT_TYPES = [
    { value: 'quiz',         label: 'Quiz'         },
    { value: 'homework',     label: 'Homework'      },
    { value: 'project',      label: 'Project'       },
    { value: 'presentation', label: 'Presentation'  },
    { value: 'lab',          label: 'Lab Work'      },
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
    if (pct >= 80) return { label: 'A', color: 'var(--success)' }
    if (pct >= 70) return { label: 'B', color: '#3b82f6' }
    if (pct >= 60) return { label: 'C', color: '#f59e0b' }
    if (pct >= 50) return { label: 'D', color: '#f97316' }
    return { label: 'F', color: 'var(--destructive)' }
}

// ── Class Card ────────────────────────────────────────────────────────────────
function ClassCard({ cls, colorIndex, onOpenStudents, onEnterResults }) {
    const bg = CARD_BG[colorIndex % CARD_BG.length]
    return (
        <div className="class-detail-card" style={{ background: bg }}>
            <div className="class-header">
                <div className="class-title-section">
                    <h3>{cls.class_name}</h3>
                    <span className="class-subject">{cls.subject_name}</span>
                </div>
            </div>

            <div className="class-stats">
                <div className="stat-item">
                    <div className="stat-value">{cls.student_count}</div>
                    <div className="stat-label">Students</div>
                </div>
                <div className="stat-item">
                    <div className="stat-value">{cls.avg_score != null ? `${cls.avg_score}%` : '-'}</div>
                    <div className="stat-label">Avg Score</div>
                </div>
            </div>

            {(cls.schedule_days || cls.room_number) && (
                <div className="class-schedule">
                    {cls.schedule_days && (
                        <div className="class-schedule-item">
                            <span className="material-symbols-rounded icon-schedule">schedule</span>
                            <span>{cls.schedule_days}{cls.schedule_time ? ` · ${cls.schedule_time.slice(0, 5)}` : ''}</span>
                        </div>
                    )}
                    {cls.room_number && (
                        <div className="class-schedule-item">
                            <span className="material-symbols-rounded icon-schedule">room</span>
                            <span>Room {cls.room_number}</span>
                        </div>
                    )}
                </div>
            )}

            <div className="class-actions">
                <button className="btn btn-primary btn-sm" onClick={() => onOpenStudents(cls)}>
                    <span className="material-symbols-rounded icon-sm">group</span>
                    View Students
                </button>
                <button className="btn btn-outline btn-sm" onClick={() => onEnterResults(cls)}>
                    <span className="material-symbols-rounded icon-sm">edit_note</span>
                    Enter Results
                </button>
            </div>
        </div>
    )
}

// ── Students Panel Modal ──────────────────────────────────────────────────────
function StudentsPanel({ cls, onClose, onEnterResult }) {
    const [students, setStudents] = useState([])
    const [loading,  setLoading]  = useState(true)
    const [search,   setSearch]   = useState('')
    const [panelError, setPanelError] = useState(null)

    useEffect(() => {
        getTeacherStudents({ class_id: cls.class_id })
            .then(s => setStudents(Array.isArray(s) ? s : []))
            .catch(err => { setStudents([]); setPanelError(err?.message || 'Failed to load students.') })
            .finally(() => setLoading(false))
    }, [cls.class_id])

    const filtered = students.filter(s =>
        s.full_name.toLowerCase().includes(search.toLowerCase()) ||
        s.student_code.toLowerCase().includes(search.toLowerCase())
    )

    return (
        <Modal title={`${cls.class_name} Students`} icon="group" onClose={onClose} size="wide">
            <div className="modal-search">
                <span className="material-symbols-rounded">search</span>
                <input
                    type="text"
                    placeholder="Search by name or student code…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
                {search && (
                    <button onClick={() => setSearch('')} className="modal-search-clear">
                        <span className="material-symbols-rounded">close</span>
                    </button>
                )}
            </div>

            {panelError && (
                <p className="tc-panel-err">
                    <span className="material-symbols-rounded tc-err-icon">error</span>
                    {panelError}
                </p>
            )}

            {loading ? (
                <p className="tr-empty-pad">Loading students…</p>
            ) : filtered.length === 0 ? (
                <div className="stu-empty">No students found.</div>
            ) : (
                <div className="stu-list">
                    {filtered.map(student => (
                        <div key={student.student_id} className="stu-row">
                            <div className="student-avatar stu-avatar">{student.initials}</div>
                            <div className="stu-info">
                                <div className="stu-name">{student.full_name}</div>
                                <div className="stu-meta">
                                    {student.student_code}
                                    {student.attendance_rate != null ? ` · Attendance: ${student.attendance_rate}%` : ''}
                                </div>
                            </div>
                            <div className="stu-actions">
                                <button className="btn btn-primary btn-sm" onClick={() => onEnterResult(student)}>
                                    <span className="material-symbols-rounded icon-sm">edit_note</span>
                                    Results
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </Modal>
    )
}

// ── Results Modal (assessment picker → score table) ───────────────────────────
function ResultsModal({ cls, onClose }) {
    const [step,       setStep]       = useState('pick')  // 'pick' | 'view' | 'new'
    const [titles,     setTitles]     = useState([])
    const [students,   setStudents]   = useState([])
    const [rows,       setRows]       = useState([])
    const [loadingInit, setLoadingInit] = useState(true)
    const [loadingRows, setLoadingRows] = useState(false)
    const [saving,     setSaving]     = useState(false)
    const [error,      setError]      = useState(null)
    const [savedMsg,   setSavedMsg]   = useState(false)

    const [selectedTitle, setSelectedTitle] = useState(null)
    const [scores,        setScores]        = useState({})
    const [newForm, setNewForm] = useState({
        assessment_title: '',
        assessment_type:  'quiz',
        date: new Date().toISOString().split('T')[0],
        max_score: '',
    })

    useEffect(() => {
        Promise.all([
            getTeacherResultList({ class_id: cls.class_id }).catch(() => ({ assessment_titles: [], results: [] })),
            getTeacherStudents({ class_id: cls.class_id }).catch(() => []),
        ]).then(([res, stu]) => {
            setTitles(res.assessment_titles || [])
            setStudents(Array.isArray(stu) ? stu : [])
        }).finally(() => setLoadingInit(false))
    }, [cls.class_id])

    function openExisting(title) {
        setSelectedTitle(title)
        setLoadingRows(true)
        setError(null)
        getTeacherResultList({ class_id: cls.class_id, assessment_title: title })
            .then(res => {
                const results = res.results || []
                const scoreMap = {}
                results.forEach(r => { scoreMap[r.student_id] = String(r.score_obtained) })
                setScores(scoreMap)
                setRows(results)
            })
            .catch(() => setError('Failed to load results.'))
            .finally(() => setLoadingRows(false))
        setStep('view')
    }

    function openNew() {
        setScores({})
        setRows([])
        setStep('new')
    }

    async function handleSaveNew() {
        if (!newForm.assessment_title || !newForm.max_score || !newForm.date) return
        const entries = students
            .filter(s => scores[s.student_id] !== undefined && scores[s.student_id] !== '')
            .map(s => ({ student_id: s.student_id, score_obtained: parseFloat(scores[s.student_id]) || 0 }))
        if (entries.length === 0) { setError('Enter at least one score.'); return }
        setSaving(true)
        setError(null)
        try {
            await bulkSaveResults({
                class_id:         cls.class_id,
                subject_id:       cls.subject_id,
                assessment_title: newForm.assessment_title,
                assessment_type:  newForm.assessment_type,
                date:             newForm.date,
                max_score:        parseFloat(newForm.max_score),
                entries,
            })
            setSavedMsg(true)
            setTimeout(() => setSavedMsg(false), 3000)
            setTitles(prev => prev.includes(newForm.assessment_title) ? prev : [...prev, newForm.assessment_title])
        } catch {
            setError('Failed to save results.')
        } finally {
            setSaving(false)
        }
    }

    async function handleSaveExisting() {
        if (!selectedTitle) return
        const max = rows[0]?.max_score ?? 100
        const entries = students
            .filter(s => scores[s.student_id] !== undefined && scores[s.student_id] !== '')
            .map(s => ({ student_id: s.student_id, score_obtained: parseFloat(scores[s.student_id]) || 0 }))
        if (entries.length === 0) { setError('No scores to save.'); return }
        setSaving(true)
        setError(null)
        try {
            await bulkSaveResults({
                class_id:         cls.class_id,
                subject_id:       cls.subject_id,
                assessment_title: selectedTitle,
                assessment_type:  'quiz',
                date:             rows[0]?.date || new Date().toISOString().split('T')[0],
                max_score:        max,
                entries,
            })
            setSavedMsg(true)
            setTimeout(() => setSavedMsg(false), 3000)
        } catch {
            setError('Failed to save results.')
        } finally {
            setSaving(false)
        }
    }

    // ── Step: Pick assessment ─────────────────────────────────────────────────
    if (step === 'pick') return (
        <Modal title={`Enter Results for ${cls.class_name}`} icon="edit_note" onClose={onClose} size="wide">
            <p className="modal-desc">Select an existing assessment or create a new one for <strong>{cls.class_name}</strong>.</p>
            {loadingInit ? (
                <p className="u-muted">Loading…</p>
            ) : (
                <div className="asgn-pick-list">
                    <button className="asgn-pick-btn" onClick={openNew}>
                        <div>
                            <div className="asgn-pick-title">+ New Assessment</div>
                            <div className="asgn-pick-meta">Create a new assessment and enter scores</div>
                        </div>
                        <span className="material-symbols-rounded asgn-pick-chevron">chevron_right</span>
                    </button>
                    {titles.map(title => (
                        <button key={title} className="asgn-pick-btn" onClick={() => openExisting(title)}>
                            <div>
                                <div className="asgn-pick-title">{title}</div>
                                <div className="asgn-pick-meta">View or update existing scores</div>
                            </div>
                            <span className="material-symbols-rounded asgn-pick-chevron">chevron_right</span>
                        </button>
                    ))}
                    {titles.length === 0 && (
                        <p className="tc-note-pad">No assessments recorded yet. Click "New Assessment" to start.</p>
                    )}
                </div>
            )}
        </Modal>
    )

    // ── Step: View / Edit existing assessment ─────────────────────────────────
    if (step === 'view') {
        const max = rows[0]?.max_score ?? 100
        return (
            <Modal
                title={selectedTitle}
                icon="edit_note"
                onClose={onClose}
                size="wide"
                footer={
                    <div className="modal-footer-row">
                        <button className="btn btn-outline btn-sm mr-auto" onClick={() => setStep('pick')}>
                            <span className="material-symbols-rounded icon-sm">arrow_back</span>
                            Back
                        </button>
                        {error && <span className="results-warning">{error}</span>}
                        {savedMsg && <span className="tc-saved">Saved!</span>}
                        <button className="btn btn-outline" onClick={onClose}>Close</button>
                        <button className="btn btn-primary" onClick={handleSaveExisting} disabled={saving}>
                            {saving ? 'Saving…' : 'Save Changes'}
                        </button>
                    </div>
                }
            >
                <div className="results-info-bar">
                    <div className="results-info-text">
                        <strong>{cls.class_name}</strong> · {cls.subject_name} · Max: <strong>{max}</strong>
                    </div>
                </div>
                {loadingRows ? (
                    <p className="u-muted">Loading scores…</p>
                ) : (
                    <div className="score-table-body">
                        <div className="score-table-head score-grid-2">
                            <span>Student</span>
                            <span className="center">Score / {max}</span>
                        </div>
                        {students.map(student => {
                            const scoreVal = scores[student.student_id] ?? ''
                            const pct = scoreVal !== '' ? (parseFloat(scoreVal) / max) * 100 : null
                            const grade = pct != null ? getGrade(pct) : null
                            return (
                                <div key={student.student_id} className="score-row score-grid-2">
                                    <div className="score-student-cell">
                                        <div className="student-avatar score-avatar">{student.initials}</div>
                                        <div className="score-student-info">
                                            <div className="score-student-name">{student.full_name}</div>
                                            <div className="score-student-code">{student.student_code}</div>
                                        </div>
                                    </div>
                                    <div className="score-input-cell u-row-sm">
                                        <input
                                            type="number" min="0" max={max} placeholder="-"
                                            className="score-input"
                                            value={scoreVal}
                                            onChange={e => setScores(prev => ({ ...prev, [student.student_id]: e.target.value }))}
                                        />
                                        {grade && (
                                            <span className="grade-badge tc-grade-badge" style={{ color: grade.color, background: `${grade.color}18` }}>
                                                {grade.label}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </Modal>
        )
    }

    // ── Step: New assessment ──────────────────────────────────────────────────
    return (
        <Modal
            title="New Assessment"
            icon="add"
            onClose={onClose}
            size="wide"
            footer={
                <div className="modal-footer-row">
                    <button className="btn btn-outline btn-sm mr-auto" onClick={() => setStep('pick')}>
                        <span className="material-symbols-rounded icon-sm">arrow_back</span>
                        Back
                    </button>
                    {error && <span className="results-warning">{error}</span>}
                    {savedMsg && <span className="tc-saved">Saved!</span>}
                    <button className="btn btn-outline" onClick={onClose}>Cancel</button>
                    <button
                        className="btn btn-primary"
                        onClick={handleSaveNew}
                        disabled={saving || !newForm.assessment_title || !newForm.max_score}
                    >
                        {saving ? 'Saving…' : 'Save Results'}
                    </button>
                </div>
            }
        >
            <div className="resp-grid-2 u-gap-sm u-mb-lg">
                <div className="form-group col-full">
                    <label className="form-label">Assessment Title *</label>
                    <input
                        className="form-control"
                        placeholder="e.g. Mid-Term Exam, CAT 1, Quiz 3…"
                        value={newForm.assessment_title}
                        onChange={e => setNewForm(p => ({ ...p, assessment_title: e.target.value }))}
                    />
                </div>
                <div className="form-group">
                    <label className="form-label">Type *</label>
                    <select className="form-control" value={newForm.assessment_type} onChange={e => setNewForm(p => ({ ...p, assessment_type: e.target.value }))}>
                        {ASSESSMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                </div>
                <div className="form-group">
                    <label className="form-label">Date *</label>
                    <input className="form-control" type="date" value={newForm.date} onChange={e => setNewForm(p => ({ ...p, date: e.target.value }))} />
                </div>
                <div className="form-group">
                    <label className="form-label">Max Score *</label>
                    <input className="form-control" type="number" min="1" placeholder="e.g. 100" value={newForm.max_score} onChange={e => setNewForm(p => ({ ...p, max_score: e.target.value }))} />
                </div>
            </div>

            <div className="section-label-sm">Enter Scores for {cls.class_name}</div>
            <div className="score-table-body">
                <div className="score-table-head score-grid-2">
                    <span>Student</span>
                    <span className="center">Score / {newForm.max_score || '?'}</span>
                </div>
                {students.map(student => {
                    const scoreVal = scores[student.student_id] ?? ''
                    const max = parseFloat(newForm.max_score) || 100
                    const pct = scoreVal !== '' ? (parseFloat(scoreVal) / max) * 100 : null
                    const grade = pct != null ? getGrade(pct) : null
                    return (
                        <div key={student.student_id} className="score-row score-grid-2">
                            <div className="score-student-cell">
                                <div className="student-avatar score-avatar">{student.initials}</div>
                                <div className="score-student-info">
                                    <div className="score-student-name">{student.full_name}</div>
                                    <div className="score-student-code">{student.student_code}</div>
                                </div>
                            </div>
                            <div className="score-input-cell u-row-sm">
                                <input
                                    type="number" min="0" max={newForm.max_score || undefined} placeholder="-"
                                    className="score-input"
                                    value={scoreVal}
                                    onChange={e => setScores(prev => ({ ...prev, [student.student_id]: e.target.value }))}
                                />
                                {grade && (
                                    <span className="grade-badge tc-grade-badge" style={{ color: grade.color, background: `${grade.color}18` }}>
                                        {grade.label}
                                    </span>
                                )}
                            </div>
                        </div>
                    )
                })}
                {students.length === 0 && (
                    <p className="tc-note-pad">No students found in this class.</p>
                )}
            </div>
        </Modal>
    )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export function TeacherClasses() {
    const { notifications: liveNotifications, markRead } = useNotifications()
    const [classes,       setClasses]       = useState([])
    const [loadingClasses, setLoadingClasses] = useState(true)
    const [sections,      setSections]      = useState([])
    const [section,       setSection]       = useState('')
    const [year,          setYear]          = useState('')
    const [classVal,      setClassVal]      = useState('')

    const [loadError,    setLoadError]    = useState(null)
    const [openClass,    setOpenClass]    = useState(null)
    const [resultsClass, setResultsClass] = useState(null)
    const [resultsFromStudent, setResultsFromStudent] = useState(false)

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

    const visible = classes.filter(cls => {
        const grade   = parseInt(cls.grade)
        const isO     = grade <= 3
        if (section === 'O-Level' && !isO)  return false
        if (section === 'A-Level' && isO)   return false
        if (year     && `S${cls.grade}` !== year)   return false
        if (classVal && cls.section         !== classVal) return false
        return true
    })

    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>

            {resultsClass && (
                <ResultsModal
                    cls={resultsClass}
                    onClose={() => {
                        setResultsClass(null)
                        if (resultsFromStudent) setOpenClass(resultsClass)
                        setResultsFromStudent(false)
                    }}
                />
            )}

            {openClass && (
                <StudentsPanel
                    cls={openClass}
                    onClose={() => setOpenClass(null)}
                    onEnterResult={() => {
                        setResultsFromStudent(true)
                        setResultsClass(openClass)
                        setOpenClass(null)
                    }}
                />
            )}

            <div className="dashboard-layout">
                <Sidebar navItems={teacherNavItems} secondaryItems={teacherSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title="My Classes"
                        subtitle="View your classes and manage students"
                        userName={fullName}
                        userRole="Teacher"
                        userInitials={initials}
                        avatarClass="teacher-av"
                        notifications={liveNotifications}
                        onNotificationRead={markRead}
                    />
                    <DashboardContent>
                        <ClassPicker
                            sections={sections}
                            section={section}   onSectionChange={v => { setSection(v); setYear(''); setClassVal('') }}
                            year={year}         onYearChange={v => { setYear(v); setClassVal('') }}
                            classVal={classVal} onClassChange={setClassVal}
                        />

                        <div className="classes-wrap">
                            <div className="classes-wrap-header">
                                <div className="classes-wrap-title">My Classes</div>
                                <span className="classes-wrap-count">
                                    {visible.length} class{visible.length !== 1 ? 'es' : ''}
                                </span>
                            </div>
                            <div className="classes-wrap-body">
                                {loadingClasses ? (
                                    <p className="tc-load-pad">Loading classes…</p>
                                ) : loadError ? (
                                    <div className="tc-load-err">
                                        <span className="material-symbols-rounded tc-load-err-icon">error</span>
                                        {loadError}
                                    </div>
                                ) : visible.length === 0 ? (
                                    <div className="classes-wrap-empty">No classes match the selected filter.</div>
                                ) : (
                                    <div className="classes-grid">
                                        {visible.map((cls, i) => (
                                            <ClassCard
                                                key={cls.class_id}
                                                cls={cls}
                                                colorIndex={i}
                                                onOpenStudents={setOpenClass}
                                                onEnterResults={setResultsClass}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
