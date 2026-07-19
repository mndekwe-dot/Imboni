import { useState, useEffect } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { Link } from 'react-router'
import {
    getDosExamSchedule, deleteDosExamSchedule, updateDosExamSchedule,
    getTerms, generateDosExamSchedule, commitDosExamSchedule,
} from '../../api/dos'
import { ExamCalendar } from './ExamCalendar'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/dos.css'
import { dosNavItems, dosSecondaryItems } from './dosNav'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { useSchoolSettings } from '../../hooks/useSchoolSetting'
import { useSessionUser } from '../../hooks/useSessionUser'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useNotifications } from '../../hooks/useNotifications'
import { formatSchoolDate } from '../../utils/date'
import { Loading } from '../../components/ui/Loading'
import { Modal } from '../../components/ui/Modal'
import { useToast } from '../../context/ToastContext'


const examRows = [
    { num: 1, subject: 'Mathematics',          code: 'MAT 401', classes: 'S4A \u00b7 S4B \u00b7 S4C', date: 'Mon, 16 Mar 2026', time: '8:00 \u2013 11:00', duration: '3 hrs',   rooms: ['Hall A', 'Hall B'],   invigilator: 'Mr. Rurangwa',    statusClass: 'badge-upcoming', status: 'Upcoming' },
    { num: 2, subject: 'English Language',     code: 'ENG 401', classes: 'S4A \u00b7 S4B \u00b7 S4C', date: 'Tue, 17 Mar 2026', time: '8:00 \u2013 10:30', duration: '2.5 hrs', rooms: ['Hall A', 'Hall B'],   invigilator: 'Ms. Uwera',       statusClass: 'badge-upcoming', status: 'Upcoming' },
    { num: 3, subject: 'Physics',              code: 'PHY 401', classes: 'S4A \u00b7 S4B',             date: 'Wed, 18 Mar 2026', time: '8:00 \u2013 11:00', duration: '3 hrs',   rooms: ['Room 8', 'Room 9'],   invigilator: 'Mr. Ntakirutimana', statusClass: 'badge-upcoming', status: 'Upcoming' },
    { num: 4, subject: 'Chemistry',            code: 'CHE 401', classes: 'S4A \u00b7 S4B \u00b7 S4C', date: 'Thu, 19 Mar 2026', time: '8:00 \u2013 11:00', duration: '3 hrs',   rooms: ['Hall A', 'Lab 2'],    invigilator: 'Ms. Umutoni',     statusClass: 'badge-upcoming', status: 'Upcoming' },
    { num: 5, subject: 'Biology',              code: 'BIO 401', classes: 'S4A \u00b7 S4C',             date: 'Fri, 20 Mar 2026', time: '8:00 \u2013 11:00', duration: '3 hrs',   rooms: ['Hall B', 'Lab 3'],    invigilator: 'Ms. Ingabire',    statusClass: 'badge-upcoming', status: 'Upcoming' },
    { num: 6, subject: 'Kinyarwanda',          code: 'KIN 401', classes: 'S4A \u00b7 S4B \u00b7 S4C', date: 'Mon, 23 Mar 2026', time: '8:00 \u2013 10:30', duration: '2.5 hrs', rooms: ['Hall A', 'Hall B'],   invigilator: 'Mr. Bizimana',    statusClass: 'badge-draft',    status: 'Draft'    },
    { num: 7, subject: 'History',              code: 'HIS 301', classes: 'S3A \u00b7 S3B \u00b7 S3C', date: 'Tue, 17 Mar 2026', time: '2:00 \u2013 4:30',  duration: '2.5 hrs', rooms: ['Room 10', 'Room 11'], invigilator: 'Mr. Nsabimana',   statusClass: 'badge-upcoming', status: 'Upcoming' },
]

function ExamRow({ num, subject, code, classes, date, time, duration, rooms, invigilator, statusClass, status, id, onDelete }) {
    return (
        <tr>
            <td>{num}</td>
            <td>
                <div className="es-subject-name">{subject}</div>
                <div className="es-subject-code">{code}</div>
            </td>
            <td>{classes}</td>
            <td className="es-nowrap">{date}</td>
            <td>
                <span className="es-time-chip">
                    <span className="material-symbols-rounded">schedule</span>{time}
                </span>
            </td>
            <td>{duration}</td>
            <td>{rooms.map((r, i) => <span key={i} className="es-room-chip">{r}</span>)}</td>
            <td>{invigilator}</td>
            <td><span className={`badge ${statusClass}`}>{status}</span></td>
            <td>
                <div className="es-row-actions">
                    <button className="es-icon-btn"><span className="material-symbols-rounded">edit</span></button>
                    <button className="es-icon-btn"><span className="material-symbols-rounded">visibility</span></button>
                    <button className="es-icon-btn danger" onClick={() => id && onDelete(id)}><span className="material-symbols-rounded">delete</span></button>
                </div>
            </td>
        </tr>
    )
}

const EXAM_TYPES = [
    { value: 'midterm', label: 'Mid-Term Exam' },
    { value: 'final',   label: 'Final Exam' },
    { value: 'mock',    label: 'Mock Exam' },
    { value: 'quiz',    label: 'Quiz' },
    { value: 'other',   label: 'Other' },
]

// Auto-scheduler modal: collect a window, preview the DSatur-generated plan,
// then commit it. Nothing is written until the DOS confirms the preview.
function ExamGenerateModal({ onClose, onCommitted }) {
    const toast = useToast()
    const [terms,     setTerms]     = useState([])
    const [form,      setForm]      = useState({
        term_id:       '',
        exam_type:     'midterm',
        start_date:    '',
        num_days:      5,
        skip_weekends: true,
    })
    const [preview,   setPreview]   = useState(null)
    const [busy,      setBusy]      = useState(false)

    useEffect(() => {
        getTerms()
            .then(data => {
                const list = Array.isArray(data) ? data : (data?.results || [])
                setTerms(list)
                const current = list.find(t => t.is_current) || list[0]
                if (current) setForm(f => ({ ...f, term_id: String(current.id) }))
            })
            .catch(() => toast.error('Could not load academic terms.'))
    }, [toast])

    const canRun = form.term_id && form.start_date && !busy

    function update(field, value) {
        setForm(f => ({ ...f, [field]: value }))
        setPreview(null)   // any change invalidates the current preview
    }

    async function handlePreview() {
        setBusy(true)
        try {
            const plan = await generateDosExamSchedule(form)
            setPreview(plan)
            plan.warnings?.forEach(w => toast.info(w))
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Could not generate a schedule.')
        } finally {
            setBusy(false)
        }
    }

    async function handleCommit() {
        setBusy(true)
        try {
            const result = await commitDosExamSchedule(form)
            toast.success(`Saved ${result.created} exam(s).`)
            onCommitted()
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Could not save the schedule.')
        } finally {
            setBusy(false)
        }
    }

    return (
        <Modal
            title="Generate Exam Schedule"
            icon="auto_awesome"
            onClose={onClose}
            size="wide"
            footer={
                <div className="modal-confirm-actions u-full">
                    <button className="btn btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
                    {preview
                        ? <button className="btn btn-primary" onClick={handleCommit}
                                  disabled={busy || preview.summary.scheduled === 0}>
                              Save {preview.summary.scheduled} exam(s)
                          </button>
                        : <button className="btn btn-primary" onClick={handlePreview} disabled={!canRun}>
                              {busy ? 'Generating…' : 'Preview'}
                          </button>}
                </div>
            }
        >
            <div className="u-grid u-grid-2 u-gap-1">
                <div className="form-group">
                    <label className="form-label">Academic Term *</label>
                    <select className="form-select" value={form.term_id}
                            onChange={e => update('term_id', e.target.value)}>
                        <option value="">Select term…</option>
                        {terms.map(t => (
                            <option key={t.id} value={t.id}>{t.name} ({t.year})</option>
                        ))}
                    </select>
                </div>
                <div className="form-group">
                    <label className="form-label">Exam Type</label>
                    <select className="form-select" value={form.exam_type}
                            onChange={e => update('exam_type', e.target.value)}>
                        {EXAM_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                </div>
                <div className="form-group">
                    <label className="form-label">Start Date *</label>
                    <input type="date" className="form-input" value={form.start_date}
                           onChange={e => update('start_date', e.target.value)} />
                </div>
                <div className="form-group">
                    <label className="form-label">Exam Days</label>
                    <input type="number" min="1" max="60" className="form-input" value={form.num_days}
                           onChange={e => update('num_days', Number(e.target.value))} />
                </div>
                <div className="form-group u-col-span-all">
                    <label className="u-flex u-gap-05 u-items-center">
                        <input type="checkbox" checked={form.skip_weekends}
                               onChange={e => update('skip_weekends', e.target.checked)} />
                        Skip weekends
                    </label>
                </div>
            </div>

            {preview && (
                <div className="mt-1-5">
                    <div className="es-gen-summary">
                        <span className="badge badge-published">{preview.summary.scheduled} scheduled</span>
                        {preview.summary.unscheduled > 0 &&
                            <span className="badge badge-draft">{preview.summary.unscheduled} unplaced</span>}
                        <span className="u-muted u-sm">
                            {preview.summary.slots_available} slots · {preview.summary.venues} venue(s)
                        </span>
                    </div>
                    <div className="es-table-wrap mt-1">
                        <table className="es-table">
                            <thead>
                                <tr><th>Subject</th><th>Wt</th><th>Class</th><th>Date</th><th>Time</th><th>Venue</th><th>Invigilator</th></tr>
                            </thead>
                            <tbody>
                                {preview.assignments.map((a, i) => (
                                    <tr key={i}>
                                        <td>{a.subject_name}</td>
                                        <td className="u-muted">{a.weight ?? '—'}</td>
                                        <td>{a.class_name}</td>
                                        <td className="es-nowrap">{a.exam_date}</td>
                                        <td className="es-nowrap">{a.start_time}–{a.end_time}</td>
                                        <td>{a.venue || '—'}</td>
                                        <td>{a.invigilator_name || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </Modal>
    )
}

export function DosExamSchedule() {
    const { setting } = useSchoolSettings()
    const sessionUser = useSessionUser()
    const { notifications: liveNotifications, markRead } = useNotifications()
    const [exams,   setExams]   = useState(examRows)
    const [loading, setLoading] = useState(true)
    const [error,   setError]   = useState(null)
    const [showGenerate, setShowGenerate] = useState(false)
    const [rawExams, setRawExams] = useState([])   // API shape, for the calendar
    const [view, setView] = useState('table')      // 'table' | 'calendar'
    const toast = useToast()

    function loadExams() {
        return getDosExamSchedule()
            .then(data => {
                setRawExams(Array.isArray(data) ? data : [])
                if (data.length > 0) {
                    setExams(data.map((e, i) => ({
                        num:         i + 1,
                        subject:     e.subject,
                        code:        e.exam_type,
                        classes:     e.class_name || '—',
                        date:        e.exam_date,
                        time:        `${e.start_time} – ${e.end_time}`,
                        duration:    '—',
                        rooms:       e.venue ? [e.venue] : ['—'],
                        invigilator: e.invigilator || '—',
                        statusClass: 'badge-upcoming',
                        status:      'Upcoming',
                        id:          e.id,
                    })))
                }
            })
    }

    useEffect(() => {
        loadExams()
            .catch(err => setError(err.message))
            .finally(() => setLoading(false))
    }, [])

    async function handleDelete(id) {
        try {
            await deleteDosExamSchedule(id)
            setExams(prev => prev.filter(e => e.id !== id))
            setRawExams(prev => prev.filter(e => e.id !== id))
        } catch (err) { console.error(err) }
    }

    // Drag-and-drop reschedule: move optimistically, roll back if the PATCH fails.
    async function handleReschedule(id, patch) {
        const before = rawExams
        setRawExams(prev => prev.map(e => (e.id === id ? { ...e, ...patch } : e)))
        try {
            await updateDosExamSchedule(id, patch)
            await loadExams()
            toast.success('Exam rescheduled.')
        } catch (err) {
            setRawExams(before)
            toast.error(err.response?.data?.detail || 'Could not reschedule that exam.')
        }
    }

    if (loading) return <Loading fullPage />
    if (error)   return <p className="u-pad u-danger">Error: {error}</p>

    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={dosNavItems} secondaryItems={dosSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title="Exam Schedule"
                        subtitle="Create and manage examination timetables"
                        {...sessionUser}
                        notifications={liveNotifications}
                        onNotificationRead={markRead}
                        actions={
                            <>
                                <button className="btn btn-secondary" onClick={() => setShowGenerate(true)}>
                                    <span className="material-symbols-rounded">auto_awesome</span> Generate
                                </button>
                                <button className="btn btn-primary">+ Add Exam</button>
                            </>
                        }
                    />

                    <DashboardContent>
                        {/* Page Tabs */}
                        <nav className="es-tabs">
                            <button className="es-tab active">
                                <span className="material-symbols-rounded">calendar_month</span> Current Schedule
                            </button>
                            <button className="es-tab">
                                <span className="material-symbols-rounded">edit_calendar</span> Plan / Edit
                            </button>
                            <button className="es-tab">
                                <span className="material-symbols-rounded">meeting_room</span> Room Planner
                            </button>
                            <button className="es-tab">
                                <span className="material-symbols-rounded">send</span> Publish
                            </button>
                        </nav>

                        <div className="card mt-1-5">
                            <div className="card-header">
                                <h2 className="card-title">Term 1 &middot; 2026 Exam Schedule</h2>
                                <div className="es-card-actions">
                                    <span className="badge badge-published">Published</span>
                                    <button
                                        className={`btn btn-sm ${view === 'table' ? 'btn-primary' : 'btn-secondary'}`}
                                        onClick={() => setView('table')}
                                    >
                                        <span className="material-symbols-rounded">table_rows</span> Table
                                    </button>
                                    <button
                                        className={`btn btn-sm ${view === 'calendar' ? 'btn-primary' : 'btn-secondary'}`}
                                        onClick={() => setView('calendar')}
                                    >
                                        <span className="material-symbols-rounded">calendar_month</span> Calendar
                                    </button>
                                    <button className="btn btn-secondary btn-sm">
                                        <span className="material-symbols-rounded">download</span> Export CSV
                                    </button>
                                    <button className="btn btn-secondary btn-sm">
                                        <span className="material-symbols-rounded">print</span> Print / PDF
                                    </button>
                                </div>
                            </div>
                            <div className="card-content">
                                {/* Level filter */}
                                <div className="att-mode-bar">
                                    <button className="att-mode-btn active">All Levels</button>
                                    <button className="att-mode-btn">
                                        <span className="material-symbols-rounded">school</span> Ordinary (S1\u2013S3)
                                    </button>
                                    <button className="att-mode-btn">
                                        <span className="material-symbols-rounded">workspace_premium</span> Advanced (S4\u2013S6)
                                    </button>
                                </div>

                                {view === 'calendar' ? (
                                    <ExamCalendar exams={rawExams} onReschedule={handleReschedule} />
                                ) : (
                                    <div className="es-table-wrap">
                                        <table className="es-table">
                                            <thead>
                                                <tr>
                                                    <th>#</th>
                                                    <th>Subject</th>
                                                    <th>Class(es)</th>
                                                    <th>Date</th>
                                                    <th>Time</th>
                                                    <th>Duration</th>
                                                    <th>Room(s)</th>
                                                    <th>Invigilator</th>
                                                    <th>Status</th>
                                                    <th>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {exams.map((row, index) => (
                                                    <ExamRow key={index} {...row} onDelete={handleDelete} />
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    </DashboardContent>
                </main>
            </div>

            {showGenerate && (
                <ExamGenerateModal
                    onClose={() => setShowGenerate(false)}
                    onCommitted={() => {
                        setShowGenerate(false)
                        setLoading(true)
                        loadExams().catch(err => setError(err.message)).finally(() => setLoading(false))
                    }}
                />
            )}
        </>
    )
}
