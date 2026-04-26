import { useState } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { ClassPicker } from '../../components/ui/ClassPicker'
import { Modal } from '../../components/ui/Modal'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/teacher.css'
import { teacherNavItems, teacherSecondaryItems, teacherUser } from './teacherNav'
import { DashboardContent } from '../../components/layout/DashboardContent'

// ── Static data ───────────────────────────────────────────────────────────────
const SECTIONS = [
    { name: 'O-Level', years: ['S1', 'S2', 'S3'], classes: ['A', 'B', 'C'] },
    { name: 'A-Level', years: ['S4', 'S5', 'S6'], classes: ['MPG', 'PCB', 'MEG', 'MPC'] },
]

const CLASSES = [
    {
        id: 'S1B', year: 'S1', letter: 'B', subject: 'Mathematics',
        schedule: 'Mon, Wed, Fri • 1:00 PM', room: 'Room 107', avgScore: '70%',
        students: [
            { id: 1,  name: 'Nshimiyimana Eric',  code: 'STU-101', gender: 'M', isMonitor: true  },
            { id: 2,  name: 'Mukamana Celestine', code: 'STU-102', gender: 'F', isMonitor: false },
            { id: 3,  name: 'Habimana Patrick',   code: 'STU-103', gender: 'M', isMonitor: false },
            { id: 4,  name: 'Ingabire Solange',   code: 'STU-104', gender: 'F', isMonitor: false },
            { id: 5,  name: 'Bizimana Kevin',     code: 'STU-105', gender: 'M', isMonitor: false },
        ],
    },
    {
        id: 'S2A', year: 'S2', letter: 'A', subject: 'Mathematics',
        schedule: 'Tue, Thu • 2:00 PM', room: 'Room 105', avgScore: '76%',
        students: [
            { id: 6,  name: 'Uwimana Grace',      code: 'STU-201', gender: 'F', isMonitor: true  },
            { id: 7,  name: 'Nsabimana Jean',     code: 'STU-202', gender: 'M', isMonitor: false },
            { id: 8,  name: 'Mutoni Esperance',   code: 'STU-203', gender: 'F', isMonitor: false },
            { id: 9,  name: 'Hakizimana Claude',  code: 'STU-204', gender: 'M', isMonitor: false },
            { id: 10, name: 'Ntakirutimana Alice',code: 'STU-205', gender: 'F', isMonitor: false },
        ],
    },
    {
        id: 'S3A', year: 'S3', letter: 'A', subject: 'Mathematics',
        schedule: 'Mon, Wed, Fri • 8:00 AM', room: 'Room 101', avgScore: '85%',
        students: [
            { id: 11, name: 'Uwase Amina',        code: 'STU-301', gender: 'F', isMonitor: true  },
            { id: 12, name: 'Bizimana James',     code: 'STU-302', gender: 'M', isMonitor: false },
            { id: 13, name: 'Mukamana Sandra',    code: 'STU-303', gender: 'F', isMonitor: false },
            { id: 14, name: 'Nkurunziza Paul',    code: 'STU-304', gender: 'M', isMonitor: false },
            { id: 15, name: 'Ingabire Diane',     code: 'STU-305', gender: 'F', isMonitor: false },
        ],
    },
    {
        id: 'S3B', year: 'S3', letter: 'B', subject: 'Mathematics',
        schedule: 'Tue, Thu • 10:00 AM', room: 'Room 102', avgScore: '78%',
        students: [
            { id: 16, name: 'Habimana Robert',    code: 'STU-306', gender: 'M', isMonitor: true  },
            { id: 17, name: 'Umutoni Claire',     code: 'STU-307', gender: 'F', isMonitor: false },
            { id: 18, name: 'Nzabonimpa Yves',   code: 'STU-308', gender: 'M', isMonitor: false },
            { id: 19, name: 'Kayitesi Liliane',   code: 'STU-309', gender: 'F', isMonitor: false },
            { id: 20, name: 'Ndayisaba Andre',    code: 'STU-310', gender: 'M', isMonitor: false },
        ],
    },
    {
        id: 'S4A', year: 'S4', letter: 'A', subject: 'Mathematics',
        schedule: 'Mon, Wed, Fri • 11:00 AM', room: 'Room 103', avgScore: '82%',
        students: [
            { id: 21, name: 'Niyonzima Bruno',    code: 'STU-401', gender: 'M', isMonitor: true  },
            { id: 22, name: 'Mukandekwe Faith',   code: 'STU-402', gender: 'F', isMonitor: false },
            { id: 23, name: 'Habimana Samuel',    code: 'STU-403', gender: 'M', isMonitor: false },
            { id: 24, name: 'Uwera Josephine',    code: 'STU-404', gender: 'F', isMonitor: false },
            { id: 25, name: 'Ndagijimana Victor', code: 'STU-405', gender: 'M', isMonitor: false },
        ],
    },
]

const ASSIGNMENTS = [
    { id: 1,  classId: 'S3A', title: 'Chapter 5 Test',    type: 'Class Test', mode: 'paper',  status: 'published', maxScore: 30 },
    { id: 2,  classId: 'S3A', title: 'End of Term Exam',  type: 'Exam',       mode: 'paper',  status: 'published', maxScore: 70 },
    { id: 3,  classId: 'S3A', title: 'Chapter 6 Quiz',    type: 'Quiz',       mode: 'online', status: 'published', maxScore: 20,
      autoScores: { 11: 17, 12: 14, 13: 19, 14: 11, 15: 16 } },
    { id: 4,  classId: 'S3A', title: 'Algebra Basics',    type: 'Quiz',       mode: 'online', status: 'draft',     maxScore: 15 },
    { id: 5,  classId: 'S3B', title: 'Trig Test',         type: 'Class Test', mode: 'paper',  status: 'published', maxScore: 30 },
    { id: 6,  classId: 'S3B', title: 'End of Term Exam',  type: 'Exam',       mode: 'paper',  status: 'published', maxScore: 70 },
    { id: 7,  classId: 'S3B', title: 'Identities Quiz',   type: 'Quiz',       mode: 'online', status: 'published', maxScore: 20,
      autoScores: { 16: 18, 17: 15, 18: 20, 19: 12, 20: 17 } },
    { id: 8,  classId: 'S4A', title: 'Calculus CAT',      type: 'Class Test', mode: 'paper',  status: 'published', maxScore: 30 },
    { id: 9,  classId: 'S4A', title: 'End of Term Exam',  type: 'Exam',       mode: 'paper',  status: 'published', maxScore: 70 },
    { id: 10, classId: 'S4A', title: 'Integration Quiz',  type: 'Quiz',       mode: 'online', status: 'published', maxScore: 25,
      autoScores: { 21: 22, 22: 19, 23: 24, 24: 17, 25: 21 } },
    { id: 11, classId: 'S2A', title: 'Algebra Test',      type: 'Class Test', mode: 'paper',  status: 'published', maxScore: 30 },
    { id: 12, classId: 'S1B', title: 'Basic Ops Test',    type: 'Class Test', mode: 'paper',  status: 'draft',     maxScore: 20 },
]

const CARD_BACKGROUNDS = [
    '#eef6ff',  // soft blue
    '#edfaf4',  // soft green
    '#f3f0ff',  // soft purple
    '#fff7ed',  // soft orange
    '#e8f8fb',  // soft teal
    '#fff0f3',  // soft rose
]

// ── Class Card ────────────────────────────────────────────────────────────────
function ClassCard({ cls, colorIndex, onOpenStudents, onEnterResults }) {
    const bg      = CARD_BACKGROUNDS[colorIndex % CARD_BACKGROUNDS.length]
    const monitor = cls.students.find(s => s.isMonitor)

    return (
        <div className="class-detail-card" style={{ background: bg }}>
            <div className="class-header">
                <div className="class-title-section">
                    <h3>{cls.id}</h3>
                    <span className="class-subject">{cls.subject}</span>
                </div>
            </div>

            {monitor && (
                <div className="class-monitor-badge">
                    <span className="material-symbols-rounded">stars</span>
                    Monitor: {monitor.name}
                </div>
            )}

            <div className="class-stats">
                <div className="stat-item">
                    <div className="stat-value">{cls.students.length}</div>
                    <div className="stat-label">Students</div>
                </div>
                <div className="stat-item">
                    <div className="stat-value">{cls.avgScore}</div>
                    <div className="stat-label">Avg Score</div>
                </div>
            </div>

            <div className="class-schedule">
                <div className="class-schedule-item">
                    <span className="material-symbols-rounded icon-schedule">schedule</span>
                    <span>{cls.schedule}</span>
                </div>
                <div className="class-schedule-item">
                    <span className="material-symbols-rounded icon-schedule">room</span>
                    <span>{cls.room}</span>
                </div>
            </div>

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

// ── Results Modal (2-step) ────────────────────────────────────────────────────
function ResultsModal({ cls, onClose }) {
    const [step,       setStep]       = useState(1)           // 1 = pick assignment, 2 = enter scores
    const [assignment, setAssignment] = useState(null)
    const [scores,     setScores]     = useState({})          // { studentId: value }
    const [flagged,    setFlagged]    = useState({})          // { studentId: true } for online review

    const published = ASSIGNMENTS.filter(
        a => a.classId === cls.id && a.status === 'published'
    )

    function selectAssignment(a) {
        setAssignment(a)
        // pre-fill scores from autoScores if online
        if (a.mode === 'online' && a.autoScores) {
            setScores(Object.fromEntries(
                Object.entries(a.autoScores).map(([k, v]) => [k, String(v)])
            ))
        } else {
            setScores({})
        }
        setFlagged({})
        setStep(2)
    }

    function toggleFlag(studentId) {
        setFlagged(prev => ({ ...prev, [studentId]: !prev[studentId] }))
    }

    const modeBadge = mode => mode === 'online'
        ? { label: 'Online • Auto-marked', bg: 'rgba(16,185,129,0.1)', color: 'var(--success)' }
        : { label: 'Paper • Manual entry', bg: 'rgba(99,102,241,0.1)', color: '#6366f1' }

    // ── Step 1 — pick assignment ──────────────────────────────────────────────
    if (step === 1) return (
        <Modal title={`Enter Results — ${cls.id}`} icon="edit_note" onClose={onClose} size="wide">
            <p className="modal-desc">
                Select a published assignment to enter or review scores for <strong>{cls.id}</strong>.
            </p>

            {published.length === 0 ? (
                <div className="results-empty">
                    <span className="material-symbols-rounded">assignment_late</span>
                    <div className="results-empty-title">No published assignments</div>
                    <div className="results-empty-sub">Publish an assignment for {cls.id} first.</div>
                </div>
            ) : (
                <div className="asgn-pick-list">
                    {published.map(a => {
                        const badge = modeBadge(a.mode)
                        return (
                            <button key={a.id} onClick={() => selectAssignment(a)} className="asgn-pick-btn">
                                <div>
                                    <div className="asgn-pick-title">{a.title}</div>
                                    <div className="asgn-pick-meta">{a.type} • Max score: {a.maxScore}</div>
                                </div>
                                <div className="asgn-pick-right">
                                    <span className="asgn-pick-badge" style={{ background: badge.bg, color: badge.color }}>{badge.label}</span>
                                    <span className="material-symbols-rounded asgn-pick-chevron">chevron_right</span>
                                </div>
                            </button>
                        )
                    })}
                </div>
            )}
        </Modal>
    )

    // ── Step 2 — enter / review scores ───────────────────────────────────────
    const isPaper  = assignment.mode === 'paper'
    const badge    = modeBadge(assignment.mode)
    const flagCount = Object.values(flagged).filter(Boolean).length

    return (
        <Modal
            title={assignment.title}
            icon={isPaper ? 'edit_note' : 'auto_awesome'}
            onClose={onClose}
            size="wide"
            footer={
                <div className="modal-footer-row">
                    <button className="btn btn-outline btn-sm mr-auto" onClick={() => { setStep(1); setAssignment(null) }}>
                        <span className="material-symbols-rounded icon-sm">arrow_back</span>
                        Back
                    </button>
                    {!isPaper && flagCount > 0 && (
                        <span className="results-warning">
                            {flagCount} score{flagCount > 1 ? 's' : ''} flagged for review
                        </span>
                    )}
                    <button className="btn btn-outline" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" onClick={onClose}>
                        {isPaper ? 'Save as Draft' : 'Submit to DOS'}
                    </button>
                </div>
            }
        >
            {/* Assignment info bar */}
            <div className="results-info-bar">
                <div className="results-info-text">
                    <strong>{cls.id}</strong> • {assignment.type} • Max: <strong>{assignment.maxScore}</strong>
                </div>
                <span className="results-info-pill" style={{ background: badge.bg, color: badge.color }}>{badge.label}</span>
            </div>

            {/* Online mode notice */}
            {!isPaper && (
                <div className="results-online-notice">
                    <span className="material-symbols-rounded">info</span>
                    Scores were auto-marked by the system. Review and flag any suspicious results before submitting to DOS.
                </div>
            )}

            {/* Score table */}
            <div className="score-table-body">
                {/* Header row */}
                <div className={`score-table-head ${isPaper ? 'score-grid-2' : 'score-grid-3'}`}>
                    <span>Student</span>
                    <span className="center">Score / {assignment.maxScore}</span>
                    {!isPaper && <span className="center">Flag</span>}
                </div>

                {cls.students.map(student => (
                    <div key={student.id} className={`score-row ${isPaper ? 'score-grid-2' : 'score-grid-3'}${flagged[student.id] ? ' flagged' : ''}`}>
                        <div className="score-student-cell">
                            <div className="student-avatar score-avatar">
                                {student.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </div>
                            <div className="score-student-info">
                                <div className="score-student-name">
                                    {student.name}
                                    {student.isMonitor && <span className="material-symbols-rounded">stars</span>}
                                </div>
                                <div className="score-student-code">{student.code}</div>
                            </div>
                        </div>

                        <div className="score-input-cell">
                            <input
                                type="number" min="0" max={assignment.maxScore} placeholder="—"
                                value={scores[student.id] || ''}
                                onChange={e => setScores(prev => ({ ...prev, [student.id]: e.target.value }))}
                                readOnly={!isPaper}
                                className={`score-input${!isPaper ? ' readonly' : ''}`}
                            />
                        </div>

                        {!isPaper && (
                            <div className="score-flag-cell">
                                <button
                                    onClick={() => toggleFlag(student.id)}
                                    title={flagged[student.id] ? 'Remove flag' : 'Flag for review'}
                                    className={`score-flag-btn${flagged[student.id] ? ' active' : ''}`}
                                >
                                    <span className="material-symbols-rounded">flag</span>
                                </button>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </Modal>
    )
}

// ── Students Panel Modal ──────────────────────────────────────────────────────
function StudentsPanel({ cls, onClose, onViewStudent, onEnterResult }) {
    const [search, setSearch] = useState('')

    const monitor  = cls.students.find(s => s.isMonitor)
    const filtered = cls.students.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.code.toLowerCase().includes(search.toLowerCase())
    )

    return (
        <Modal title={`${cls.id} — Students`} icon="group" onClose={onClose} size="wide">
            {monitor && (
                <div className="monitor-banner">
                    <span className="material-symbols-rounded">stars</span>
                    <div className="monitor-banner-info">
                        <div className="monitor-banner-name">Class Monitor</div>
                        <div className="monitor-banner-sub">{monitor.name} • {monitor.code}</div>
                    </div>
                    <span className="monitor-banner-tag">Appointed by DOS</span>
                </div>
            )}

            <div className="modal-search">
                <span className="material-symbols-rounded">search</span>
                <input
                    type="text"
                    placeholder="Search by name or student code..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
                {search && (
                    <button onClick={() => setSearch('')} className="modal-search-clear">
                        <span className="material-symbols-rounded">close</span>
                    </button>
                )}
            </div>

            <div className="stu-list">
                {filtered.map(student => (
                    <div key={student.id} className={`stu-row${student.isMonitor ? ' monitor' : ''}`}>
                        <div className="student-avatar stu-avatar">
                            {student.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <div className="stu-info">
                            <div className="stu-name">
                                {student.name}
                                {student.isMonitor && <span className="material-symbols-rounded">stars</span>}
                            </div>
                            <div className="stu-meta">
                                {student.code} • {student.gender === 'M' ? 'Male' : 'Female'}
                            </div>
                        </div>
                        <div className="stu-actions">
                            <button className="btn btn-outline btn-sm" onClick={() => onViewStudent(student)}>
                                <span className="material-symbols-rounded icon-sm">visibility</span>
                                View
                            </button>
                            <button className="btn btn-primary btn-sm" onClick={() => onEnterResult(student)}>
                                <span className="material-symbols-rounded icon-sm">edit_note</span>
                                Results
                            </button>
                        </div>
                    </div>
                ))}
                {filtered.length === 0 && <div className="stu-empty">No students match your search.</div>}
            </div>
        </Modal>
    )
}

// ── Shared score helpers ───────────────────────────────────────────────────────
function getGrade(score, max) {
    const pct = (Number(score) / max) * 100
    if (pct >= 80) return { label: 'A', color: 'var(--success)' }
    if (pct >= 70) return { label: 'B', color: '#3b82f6' }
    if (pct >= 60) return { label: 'C', color: '#f59e0b' }
    if (pct >= 50) return { label: 'D', color: '#f97316' }
    return { label: 'F', color: 'var(--destructive)' }
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export function TeacherClasses() {
    const [section,  setSection]  = useState('')
    const [year,     setYear]     = useState('')
    const [classVal, setClassVal] = useState('')

    const [openClass,    setOpenClass]    = useState(null)
    const [viewStudent,  setViewStudent]  = useState(null)
    const [resultsClass, setResultsClass] = useState(null)

    // Shared scores: { [assignmentId]: { [studentId]: scoreString } }
    const [allScores, setAllScores] = useState({
        1:  { 11: '24', 12: '18', 13: '27', 14: '15', 15: '22' },
        2:  { 11: '58', 12: '45', 13: '65', 14: '42', 15: '55' },
        3:  { 11: '17', 12: '14', 13: '19', 14: '11', 15: '16' },
        5:  { 16: '25', 17: '20', 18: '28', 19: '18', 20: '24' },
        6:  { 16: '55', 17: '48', 18: '62', 19: '44', 20: '58' },
        7:  { 16: '18', 17: '15', 18: '20', 19: '12', 20: '17' },
        8:  { 21: '26', 22: '22', 23: '29', 24: '19', 25: '24' },
        9:  { 21: '62', 22: '55', 23: '68', 24: '50', 25: '60' },
        10: { 21: '22', 22: '19', 23: '24', 24: '17', 25: '21' },
        11: { 6: '25',  7: '20',  8: '27',  9: '18',  10: '23' },
    })

    function updateScore(assignmentId, studentId, value) {
        setAllScores(prev => ({
            ...prev,
            [assignmentId]: { ...prev[assignmentId], [studentId]: value },
        }))
    }

    const visible = CLASSES.filter(cls => {
        if (section) {
            const sec = SECTIONS.find(s => s.name === section)
            if (sec && !sec.years.includes(cls.year)) return false
        }
        if (year     && cls.year   !== year)     return false
        if (classVal && cls.letter !== classVal) return false
        return true
    })

    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>

            {/* Class-level enter results (2-step) */}
            {resultsClass && (
                <ResultsModal cls={resultsClass} onClose={() => setResultsClass(null)} />
            )}

            {/* Students panel */}
            {openClass && !viewStudent && (
                <StudentsPanel
                    cls={openClass}
                    onClose={() => setOpenClass(null)}
                    onViewStudent={s => setViewStudent(s)}
                    onEnterResult={() => { setResultsClass(openClass); setOpenClass(null) }}
                />
            )}

            {/* View student modal — profile + results */}
            {viewStudent && (() => {
                const cls = openClass
                const classAssignments = ASSIGNMENTS.filter(
                    a => a.classId === cls?.id && a.status === 'published'
                )
                return (
                    <Modal
                        title="Student Profile"
                        icon="person"
                        size="wide"
                        onClose={() => setViewStudent(null)}
                        footer={
                            <div className="modal-footer-row" style={{ justifyContent: 'flex-end' }}>
                                <button className="btn btn-outline" onClick={() => setViewStudent(null)}>Close</button>
                                <button className="btn btn-primary" onClick={() => setViewStudent(null)}>
                                    <span className="material-symbols-rounded icon-sm">save</span>Save Changes
                                </button>
                            </div>
                        }
                    >
                        {/* Student header */}
                        <div className="stu-profile-bar">
                            <div className="student-avatar student-profile-avatar">
                                {viewStudent.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </div>
                            <div className="stu-profile-info">
                                <div className="stu-profile-name">{viewStudent.name}</div>
                                <div className="stu-profile-sub">
                                    {viewStudent.code} • {viewStudent.gender === 'M' ? 'Male' : 'Female'} • {cls?.id}
                                </div>
                                {viewStudent.isMonitor && (
                                    <div className="stu-profile-role">
                                        <span className="material-symbols-rounded">stars</span>
                                        Class Monitor
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="section-label-sm">Results — {cls?.id}</div>

                        {classAssignments.length === 0 ? (
                            <div className="results-no-asgn">No published assignments for this class yet.</div>
                        ) : (
                            <div className="score-view-body">
                                <div className="score-view-grid score-view-head">
                                    <span>Assignment</span>
                                    <span className="text-center">Type</span>
                                    <span className="text-center">Score</span>
                                    <span className="text-center">Grade</span>
                                </div>

                                {classAssignments.map(a => {
                                    const isPaper = a.mode === 'paper'
                                    const score   = allScores[a.id]?.[viewStudent.id] ?? ''
                                    const grade   = score !== '' ? getGrade(score, a.maxScore) : null
                                    return (
                                        <div key={a.id} className="score-view-grid score-view-row">
                                            <div className="asgn-title-cell">
                                                <div className="asgn-title-name">{a.title}</div>
                                                <span className="asgn-mode-badge" style={{
                                                    background: isPaper ? 'rgba(99,102,241,0.1)' : 'rgba(16,185,129,0.1)',
                                                    color: isPaper ? '#6366f1' : 'var(--success)',
                                                }}>
                                                    {isPaper ? 'Paper' : 'Online · Auto'}
                                                </span>
                                            </div>

                                            <div className="score-type-col">{a.type}</div>

                                            <div className="score-val-cell">
                                                <input
                                                    type="number" min="0" max={a.maxScore} value={score}
                                                    readOnly={!isPaper}
                                                    onChange={e => updateScore(a.id, viewStudent.id, e.target.value)}
                                                    className={`score-input-sm${!isPaper ? ' readonly' : ''}`}
                                                    style={{ border: `1px solid ${isPaper ? 'var(--border)' : 'transparent'}` }}
                                                />
                                                <span className="score-max-sm">/{a.maxScore}</span>
                                            </div>

                                            <div className="grade-cell">
                                                {grade ? (
                                                    <span className="grade-badge" style={{ color: grade.color, background: `${grade.color}18` }}>
                                                        {grade.label}
                                                    </span>
                                                ) : (
                                                    <span className="grade-empty">—</span>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </Modal>
                )
            })()}

            <div className="dashboard-layout">
                <Sidebar navItems={teacherNavItems} secondaryItems={teacherSecondaryItems} />

                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title="My Classes"
                        subtitle="View your classes and manage students"
                        {...teacherUser}
                    />

                    <DashboardContent>
                        <ClassPicker
                            sections={SECTIONS}
                            section={section}   onSectionChange={setSection}
                            year={year}         onYearChange={setYear}
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
                                {visible.length === 0 ? (
                                    <div className="classes-wrap-empty">No classes match the selected filter.</div>
                                ) : (
                                    <div className="classes-grid">
                                        {visible.map((cls, i) => (
                                            <ClassCard key={cls.id} cls={cls} colorIndex={i} onOpenStudents={setOpenClass} onEnterResults={setResultsClass} />
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
