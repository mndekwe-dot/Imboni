import { useState } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { ClassPicker } from '../../components/ui/ClassPicker'
import { Modal } from '../../components/ui/Modal'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/teacher.css'
import { teacherNavItems, teacherSecondaryItems, teacherUser } from './teacherNav'

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

// ── Class Card ────────────────────────────────────────────────────────────────
function ClassCard({ cls, onOpenStudents, onEnterResults }) {
    const monitor = cls.students.find(s => s.isMonitor)
    return (
        <div className="class-detail-card">
            <div className="class-header">
                <div className="class-title-section">
                    <h3>{cls.id}</h3>
                    <span className="class-subject">{cls.subject}</span>
                </div>
            </div>

            {monitor && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--warning)', fontWeight: 600, marginBottom: '0.5rem' }}>
                    <span className="material-symbols-rounded" style={{ fontSize: '0.95rem' }}>stars</span>
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
                    <span className="material-symbols-rounded" style={{ fontSize: '0.95rem' }}>schedule</span>
                    <span>{cls.schedule}</span>
                </div>
                <div className="class-schedule-item">
                    <span className="material-symbols-rounded" style={{ fontSize: '0.95rem' }}>room</span>
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
            <p style={{ fontSize: '0.85rem', color: 'var(--muted-foreground)', marginBottom: '1rem' }}>
                Select a published assignment to enter or review scores for <strong>{cls.id}</strong>.
            </p>

            {published.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--muted-foreground)' }}>
                    <span className="material-symbols-rounded" style={{ fontSize: '2.5rem', display: 'block', marginBottom: 8 }}>assignment_late</span>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>No published assignments</div>
                    <div style={{ fontSize: '0.82rem' }}>Publish an assignment for {cls.id} first.</div>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    {published.map(a => {
                        const badge = modeBadge(a.mode)
                        return (
                            <button
                                key={a.id}
                                onClick={() => selectAssignment(a)}
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '0.875rem 1rem',
                                    border: '1px solid var(--border)', borderRadius: 10,
                                    background: 'var(--card)', cursor: 'pointer',
                                    textAlign: 'left', gap: '1rem',
                                    transition: 'border-color 0.15s, box-shadow 0.15s',
                                }}
                                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                            >
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: '0.92rem', marginBottom: 3 }}>{a.title}</div>
                                    <div style={{ fontSize: '0.76rem', color: 'var(--muted-foreground)' }}>
                                        {a.type} • Max score: {a.maxScore}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                                    <span style={{
                                        fontSize: '0.72rem', fontWeight: 600, padding: '3px 8px',
                                        borderRadius: 20, background: badge.bg, color: badge.color,
                                    }}>{badge.label}</span>
                                    <span className="material-symbols-rounded" style={{ fontSize: '1.1rem', color: 'var(--muted-foreground)' }}>
                                        chevron_right
                                    </span>
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
                <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '0.75rem' }}>
                    <button
                        className="btn btn-outline btn-sm"
                        onClick={() => { setStep(1); setAssignment(null) }}
                        style={{ marginRight: 'auto' }}
                    >
                        <span className="material-symbols-rounded icon-sm">arrow_back</span>
                        Back
                    </button>
                    {!isPaper && flagCount > 0 && (
                        <span style={{ fontSize: '0.78rem', color: 'var(--warning)', fontWeight: 600 }}>
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
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.65rem 0.875rem', background: 'var(--muted)',
                borderRadius: 8, marginBottom: '1.25rem', gap: '0.75rem',
            }}>
                <div style={{ fontSize: '0.82rem', color: 'var(--muted-foreground)' }}>
                    <strong>{cls.id}</strong> • {assignment.type} • Max: <strong>{assignment.maxScore}</strong>
                </div>
                <span style={{
                    fontSize: '0.72rem', fontWeight: 600, padding: '3px 8px',
                    borderRadius: 20, background: badge.bg, color: badge.color, flexShrink: 0,
                }}>{badge.label}</span>
            </div>

            {/* Online mode notice */}
            {!isPaper && (
                <div style={{
                    display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
                    padding: '0.65rem 0.875rem', marginBottom: '1rem',
                    background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)',
                    borderRadius: 8, fontSize: '0.8rem', color: 'var(--muted-foreground)',
                }}>
                    <span className="material-symbols-rounded" style={{ fontSize: '1rem', color: 'var(--success)', flexShrink: 0 }}>info</span>
                    Scores were auto-marked by the system. Review and flag any suspicious results before submitting to DOS.
                </div>
            )}

            {/* Score table */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {/* Header row */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: isPaper ? '1fr 100px' : '1fr 100px 80px',
                    gap: '0.5rem', padding: '0 0.5rem',
                    fontSize: '0.75rem', fontWeight: 700,
                    color: 'var(--muted-foreground)', textTransform: 'uppercase',
                }}>
                    <span>Student</span>
                    <span style={{ textAlign: 'center' }}>Score / {assignment.maxScore}</span>
                    {!isPaper && <span style={{ textAlign: 'center' }}>Flag</span>}
                </div>

                {cls.students.map(student => (
                    <div
                        key={student.id}
                        style={{
                            display: 'grid',
                            gridTemplateColumns: isPaper ? '1fr 100px' : '1fr 100px 80px',
                            gap: '0.5rem', alignItems: 'center',
                            padding: '0.6rem 0.5rem',
                            border: `1px solid ${flagged[student.id] ? 'rgba(245,158,11,0.4)' : 'var(--border)'}`,
                            borderRadius: 8,
                            background: flagged[student.id] ? 'rgba(245,158,11,0.04)' : 'transparent',
                        }}
                    >
                        {/* Student info */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                            <div className="student-avatar" style={{ width: 30, height: 30, fontSize: '0.72rem', flexShrink: 0 }}>
                                {student.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </div>
                            <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: 600, fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {student.name}
                                    {student.isMonitor && (
                                        <span className="material-symbols-rounded" style={{ fontSize: '0.8rem', color: 'var(--warning)', marginLeft: 3, verticalAlign: 'middle' }}>stars</span>
                                    )}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)' }}>{student.code}</div>
                            </div>
                        </div>

                        {/* Score input */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', justifyContent: 'center' }}>
                            <input
                                type="number"
                                min="0"
                                max={assignment.maxScore}
                                placeholder="—"
                                value={scores[student.id] || ''}
                                onChange={e => setScores(prev => ({ ...prev, [student.id]: e.target.value }))}
                                readOnly={!isPaper}
                                style={{
                                    width: 58, padding: '0.35rem 0.4rem',
                                    border: '1px solid var(--border)', borderRadius: 7,
                                    fontSize: '0.88rem', textAlign: 'center',
                                    background: isPaper ? 'var(--background)' : 'var(--muted)',
                                    color: 'var(--foreground)', cursor: isPaper ? 'text' : 'default',
                                }}
                            />
                        </div>

                        {/* Flag button (online only) */}
                        {!isPaper && (
                            <div style={{ display: 'flex', justifyContent: 'center' }}>
                                <button
                                    onClick={() => toggleFlag(student.id)}
                                    title={flagged[student.id] ? 'Remove flag' : 'Flag for review'}
                                    style={{
                                        background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                                        color: flagged[student.id] ? 'var(--warning)' : 'var(--muted-foreground)',
                                    }}
                                >
                                    <span className="material-symbols-rounded" style={{ fontSize: '1.1rem' }}>
                                        {flagged[student.id] ? 'flag' : 'flag'}
                                    </span>
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
            {/* Class monitor banner */}
            {monitor && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.75rem 1rem', background: 'rgba(245,158,11,0.08)',
                    border: '1px solid rgba(245,158,11,0.25)', borderRadius: 10,
                    marginBottom: '1rem',
                }}>
                    <span className="material-symbols-rounded" style={{ color: 'var(--warning)', fontSize: '1.25rem' }}>stars</span>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Class Monitor</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)' }}>{monitor.name} • {monitor.code}</div>
                    </div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)' }}>Appointed by DOS</span>
                </div>
            )}

            {/* Search */}
            <div style={{ position: 'relative', marginBottom: '1rem' }}>
                <span className="material-symbols-rounded" style={{
                    position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                    color: 'var(--muted-foreground)', fontSize: '1.1rem', pointerEvents: 'none',
                }}>search</span>
                <input
                    className="form-control"
                    style={{ paddingLeft: '2.2rem' }}
                    placeholder="Search student name or code..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>

            {/* Student list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {filtered.map(student => (
                    <div key={student.id} style={{
                        display: 'flex', alignItems: 'center', gap: '0.75rem',
                        padding: '0.625rem 0.75rem',
                        border: `1px solid ${student.isMonitor ? 'rgba(245,158,11,0.3)' : 'var(--border)'}`,
                        borderRadius: 10,
                        background: student.isMonitor ? 'rgba(245,158,11,0.04)' : 'transparent',
                    }}>
                        <div className="student-avatar" style={{ width: 36, height: 36, fontSize: '0.82rem', flexShrink: 0 }}>
                            {student.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>
                                {student.name}
                                {student.isMonitor && (
                                    <span className="material-symbols-rounded" style={{ fontSize: '0.85rem', color: 'var(--warning)', marginLeft: 4, verticalAlign: 'middle' }}>stars</span>
                                )}
                            </div>
                            <div style={{ fontSize: '0.74rem', color: 'var(--muted-foreground)' }}>
                                {student.code} • {student.gender === 'M' ? 'Male' : 'Female'}
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
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
                {filtered.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted-foreground)' }}>
                        No students match your search.
                    </div>
                )}
            </div>
        </Modal>
    )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export function TeacherClasses() {
    const [section,  setSection]  = useState('')
    const [year,     setYear]     = useState('')
    const [classVal, setClassVal] = useState('')

    const [openClass,    setOpenClass]    = useState(null)
    const [viewStudent,  setViewStudent]  = useState(null)
    const [resultsClass, setResultsClass] = useState(null)

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
                />
            )}

            {/* View student modal */}
            {viewStudent && (
                <Modal title="Student Profile" icon="person" onClose={() => setViewStudent(null)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
                        <div className="student-avatar" style={{ width: 52, height: 52, fontSize: '1.1rem', flexShrink: 0 }}>
                            {viewStudent.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{viewStudent.name}</div>
                            <div style={{ fontSize: '0.82rem', color: 'var(--muted-foreground)' }}>{viewStudent.code}</div>
                            {viewStudent.isMonitor && (
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
                            <div style={{ fontWeight: 600 }}>{openClass?.id}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginBottom: 2 }}>Gender</div>
                            <div style={{ fontWeight: 600 }}>{viewStudent.gender === 'M' ? 'Male' : 'Female'}</div>
                        </div>
                    </div>
                </Modal>
            )}

            <div className="dashboard-layout">
                <Sidebar navItems={teacherNavItems} secondaryItems={teacherSecondaryItems} />

                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title="My Classes"
                        subtitle="View your classes and manage students"
                        {...teacherUser}
                    />

                    <div className="dashboard-content">
                        <ClassPicker
                            sections={SECTIONS}
                            section={section}   onSectionChange={setSection}
                            year={year}         onYearChange={setYear}
                            classVal={classVal} onClassChange={setClassVal}
                        />

                        {visible.length > 0 ? (
                            <div className="classes-grid">
                                {visible.map(cls => (
                                    <ClassCard key={cls.id} cls={cls} onOpenStudents={setOpenClass} onEnterResults={setResultsClass} />
                                ))}
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted-foreground)' }}>
                                No classes found.
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </>
    )
}
