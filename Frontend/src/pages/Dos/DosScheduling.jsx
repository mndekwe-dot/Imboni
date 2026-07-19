import { useState, useEffect, useRef } from 'react'
import { useSchoolConfig } from '../../hooks/useSchoolConfig'
import { useSchoolSettings } from '../../hooks/useSchoolSetting'
import { classesFromConfig } from '../../utils/classes'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useNotifications } from '../../hooks/useNotifications'
import { useSessionUser } from '../../hooks/useSessionUser'
import { StatCard } from '../../components/layout/StatCard'
import { DutyRosterTab } from './DutyRosterTab'
import { DiningPlannerTab } from './DiningPlannerTab'
import { Timetable } from '../../components/timetable/Timetable'
import { TimetableEditForm } from '../../components/timetable/TimetableEditForm'
import { PeriodManager } from '../../components/timetable/PeriodManager'
import { Modal } from '../../components/timetable/Modal'
import { PERIODS, academicSchedules } from '../../data/academicTimetable'
import {
    getDosExamSchedule, createDosExamSchedule, updateDosExamSchedule, deleteDosExamSchedule,
    getSubjects, getDosClasses, getDosRooms, getDosTeachers, getCurrentTerm,
} from '../../api/dos'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/dos.css'
import { dosNavItems, dosSecondaryItems } from './dosNav'
import { DashboardContent } from '../../components/layout/DashboardContent'

// ── Constants ─────────────────────────────────────────────────────────────────

const timetableStats = [
    { colorClass: 'info',    icon: 'calendar_view_week', value: '8',      label: 'Periods per Day',   trend: 'Mon - Sat'    },
    { colorClass: 'success', icon: 'menu_book',          value: '9',      label: 'Subjects',          trend: 'All classes'  },
    { colorClass: 'warning', icon: 'school',             value: '7',      label: 'Teachers Assigned', trend: 'Fully staffed'},
    { colorClass: '',        icon: 'event_available',    value: 'Term 2', label: 'Current Term',      trend: '2026'         },
]

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DOW_SHORT   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

const EXAM_TYPES = [
    { value: 'midterm', label: 'Mid-Term Exam' },
    { value: 'final',   label: 'Final Exam'    },
    { value: 'quiz',    label: 'Quiz'          },
    { value: 'mock',    label: 'Mock Exam'     },
    { value: 'other',   label: 'Other'         },
]

const TYPE_COLORS = {
    midterm: '#3b82f6',
    final:   '#7c3aed',
    quiz:    '#d97706',
    mock:    '#0891b2',
    other:   '#6b7280',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Timezone-safe YYYY-MM-DD string from a Date object
function localDateStr(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

// Returns array of day objects for the month grid (always 6 rows × 7 cols = 42)
function getCalendarDays(year, month) {
    const today    = localDateStr(new Date())
    const firstDay = new Date(year, month, 1)
    const startDow = firstDay.getDay()   // 0 = Sun
    const days     = []
    for (let i = 0; i < 42; i++) {
        const d = new Date(year, month, 1 - startDow + i)
        days.push({
            date:        localDateStr(d),
            day:         d.getDate(),
            isThisMonth: d.getMonth() === month,
            isToday:     localDateStr(d) === today,
            isSunday:    d.getDay() === 0,
        })
    }
    return days
}

function fmtDate(str) {
    if (!str) return '-'
    return new Date(str + 'T00:00:00').toLocaleDateString('en-GB', {
        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    })
}

function fmtTime(str) {
    if (!str) return ''
    const [h, m] = str.split(':')
    return `${parseInt(h)}:${m}`
}

function calcDuration(start, end) {
    if (!start || !end) return ''
    const [sh, sm] = start.split(':').map(Number)
    const [eh, em] = end.split(':').map(Number)
    const mins = (eh*60+em) - (sh*60+sm)
    if (mins <= 0) return ''
    const h = Math.floor(mins/60), m = mins%60
    return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`
}

function examStatus(dateStr) {
    if (!dateStr) return { label: 'Upcoming', cls: 'badge-upcoming' }
    const d = new Date(dateStr + 'T00:00:00')
    const today = new Date(); today.setHours(0,0,0,0)
    return d < today
        ? { label: 'Completed', cls: 'badge-success' }
        : { label: 'Upcoming',  cls: 'badge-upcoming' }
}

function getISOWeekString(dateStr) {
    if (!dateStr) return ''
    const d    = new Date(dateStr + 'T12:00:00')
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
    const day  = date.getUTCDay() || 7
    date.setUTCDate(date.getUTCDate() + 4 - day)
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1))
    const weekNo    = Math.ceil(((date-yearStart)/86400000+1)/7)
    return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2,'0')}`
}

function yearPfx(className) {
    return (className||'').match(/^([A-Za-z]+\d+)/)?.[1] || ''
}

// ── Exam detail modal ─────────────────────────────────────────────────────────

function ExamDetailModal({ exam, onClose, onEdit, onDelete, onReschedule }) {
    const { label, cls } = examStatus(exam.exam_date)
    const duration = calcDuration(exam.start_time, exam.end_time)
    const typLabel = EXAM_TYPES.find(t => t.value === exam.exam_type)?.label || exam.exam_type
    const [rescheduling, setRescheduling] = useState(false)
    const [moveDate,     setMoveDate]     = useState(exam.exam_date || '')

    return (
        <Modal title="Exam Details" icon="info" onClose={onClose}>
            <div className="es-detail-modal">
                <div className="es-detail-header">
                    <div>
                        <div className="es-detail-subject">{exam.subject}</div>
                        <div className="es-detail-meta-row">
                            <span className="es-detail-type">{typLabel}</span>
                            {exam.title && <>
                                <span className="es-detail-sep">·</span>
                                <span className="es-detail-session">
                                    <span className="material-symbols-rounded">folder_open</span>
                                    {exam.title}
                                </span>
                            </>}
                        </div>
                    </div>
                    <span className={`badge ${cls}`}>{label}</span>
                </div>

                <div className="es-detail-grid">
                    <div className="es-detail-item">
                        <span className="material-symbols-rounded es-detail-icon">event</span>
                        <div><div className="es-detail-label">Date</div><div className="es-detail-value">{fmtDate(exam.exam_date)}</div></div>
                    </div>
                    <div className="es-detail-item">
                        <span className="material-symbols-rounded es-detail-icon">schedule</span>
                        <div>
                            <div className="es-detail-label">Time</div>
                            <div className="es-detail-value">
                                {fmtTime(exam.start_time)} - {fmtTime(exam.end_time)}
                                {duration && <span className="es-detail-duration">({duration})</span>}
                            </div>
                        </div>
                    </div>
                    <div className="es-detail-item">
                        <span className="material-symbols-rounded es-detail-icon">class</span>
                        <div><div className="es-detail-label">Class</div><div className="es-detail-value">{exam.class_name||'All classes'}</div></div>
                    </div>
                    <div className="es-detail-item">
                        <span className="material-symbols-rounded es-detail-icon">meeting_room</span>
                        <div><div className="es-detail-label">Venue</div><div className="es-detail-value">{exam.venue||'-'}</div></div>
                    </div>
                    <div className="es-detail-item">
                        <span className="material-symbols-rounded es-detail-icon">person</span>
                        <div><div className="es-detail-label">Invigilator</div><div className="es-detail-value">{exam.invigilator||'-'}</div></div>
                    </div>
                    <div className="es-detail-item">
                        <span className="material-symbols-rounded es-detail-icon">school</span>
                        <div><div className="es-detail-label">Term</div><div className="es-detail-value">{exam.term||'-'}</div></div>
                    </div>
                    {exam.notes && (
                        <div className="es-detail-item es-detail-span2">
                            <span className="material-symbols-rounded es-detail-icon">notes</span>
                            <div><div className="es-detail-label">Notes</div><div className="es-detail-value">{exam.notes}</div></div>
                        </div>
                    )}
                </div>

                <div className="es-detail-actions">
                    {rescheduling ? (
                        <div className="es-reschedule-row">
                            <span className="es-reschedule-label">Move to:</span>
                            <input type="date" className="form-input es-reschedule-date"
                                value={moveDate} onChange={e => setMoveDate(e.target.value)}/>
                            <button className="btn btn-primary btn-sm u-nowrap"
                                onClick={() => { if(moveDate){ onReschedule(exam.id, moveDate); onClose() } }}>
                                Confirm
                            </button>
                            <button className="btn btn-outline btn-sm" onClick={() => setRescheduling(false)}>Cancel</button>
                        </div>
                    ) : (
                        <>
                            <button className="btn btn-outline btn-destructive-outline"
                                onClick={() => { if(window.confirm('Delete this exam?')){ onDelete(exam.id); onClose() } }}>
                                <span className="material-symbols-rounded icon-sm">delete</span> Delete
                            </button>
                            <button className="btn btn-outline" onClick={() => setRescheduling(true)}>
                                <span className="material-symbols-rounded icon-sm">event_repeat</span> Reschedule
                            </button>
                            <button className="btn btn-outline" onClick={onClose}>Close</button>
                            <button className="btn btn-primary" onClick={onEdit}>
                                <span className="material-symbols-rounded icon-sm">edit</span> Edit
                            </button>
                        </>
                    )}
                </div>
            </div>
        </Modal>
    )
}

// ── Exam add / edit form ──────────────────────────────────────────────────────

function ExamForm({ editing, defaultSession, defaultDate, sessions, subjects, classes, rooms, teachers, termId, onSave, onCancel }) {
    const [form, setForm] = useState({
        session:        editing?.title           || defaultSession || '',
        subject_id:     editing?.subject_id      || '',
        class_id:       editing?.class_id        || '',
        exam_date:      editing?.exam_date        || defaultDate || '',
        start_time:     (editing?.start_time||'').slice(0,5),
        end_time:       (editing?.end_time  ||'').slice(0,5),
        venue:          editing?.venue            || '',
        exam_type:      editing?.exam_type        || 'midterm',
        invigilator_id: editing?.invigilator_id   || '',
        notes:          editing?.notes            || '',
    })
    const set = f => e => setForm(p => ({...p,[f]:e.target.value}))

    function handleSubmit() {
        if (!form.subject_id || !form.exam_date || !form.start_time || !form.end_time) return
        onSave({...form, term_id: termId, title: form.session})
    }

    return (
        <Modal title={editing ? 'Edit Exam' : 'Add Exam'} icon="edit_calendar" onClose={onCancel} wide>
            <div className="tt-form">
                <div className="form-group u-mb-sm">
                    <label className="form-label"><span className="material-symbols-rounded icon-sm">folder_open</span> Session / Group Name</label>
                    <input className="form-input" list="es-session-list" value={form.session} onChange={set('session')} placeholder="e.g. Term 2 Final Exams" />
                    <datalist id="es-session-list">{sessions.map(s => <option key={s} value={s}/>)}</datalist>
                </div>
                <div className="tt-form-row">
                    <div className="form-group">
                        <label className="form-label" htmlFor="exam-subject">Subject *</label>
                        <select id="exam-subject" className="form-input" value={form.subject_id} onChange={set('subject_id')}>
                            <option value="">Select subject</option>
                            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Class</label>
                        <select className="form-input" value={form.class_id} onChange={set('class_id')}>
                            <option value="">All / Not set</option>
                            {classes.map(c => <option key={c.id} value={c.id}>S{c.grade}{c.section}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Exam Type</label>
                        <select className="form-input" value={form.exam_type} onChange={set('exam_type')}>
                            {EXAM_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                    </div>
                </div>
                <div className="tt-form-row">
                    <div className="form-group">
                        <label className="form-label" htmlFor="exam-date">Date *</label>
                        <input id="exam-date" className="form-input" type="date" value={form.exam_date} onChange={set('exam_date')}/>
                    </div>
                    <div className="form-group">
                        <label className="form-label" htmlFor="exam-start">Start *</label>
                        <input id="exam-start" className="form-input" type="time" value={form.start_time} onChange={set('start_time')}/>
                    </div>
                    <div className="form-group">
                        <label className="form-label" htmlFor="exam-end">End *</label>
                        <input id="exam-end" className="form-input" type="time" value={form.end_time} onChange={set('end_time')}/>
                    </div>
                </div>
                <div className="tt-form-row">
                    <div className="form-group">
                        <label className="form-label">Venue / Room</label>
                        <select className="form-input" value={form.venue} onChange={set('venue')}>
                            <option value="">Select room</option>
                            {rooms.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Invigilator</label>
                        <select className="form-input" value={form.invigilator_id} onChange={set('invigilator_id')}>
                            <option value="">Select teacher</option>
                            {teachers.map(t => <option key={t.teacher_id} value={t.teacher_id}>{t.full_name}</option>)}
                        </select>
                    </div>
                </div>
                <div className="form-group">
                    <label className="form-label">Notes</label>
                    <textarea className="form-input es-textarea-v" rows={2} value={form.notes} onChange={set('notes')} placeholder="Optional notes..."/>
                </div>
                <div className="tt-form-actions">
                    <button className="btn btn-outline" onClick={onCancel}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleSubmit}>
                        <span className="material-symbols-rounded icon-sm">save</span> {editing ? 'Update' : 'Save'}
                    </button>
                </div>
            </div>
        </Modal>
    )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function DosScheduling() {
    const { notifications: liveNotifications, markRead } = useNotifications()
    const sessionUser = useSessionUser()
    const { config } = useSchoolConfig()
    const { setting } = useSchoolSettings()
    const allClasses = classesFromConfig(config)
    const [activeTab, setActiveTab] = useState('timetable')

    // ── Timetable state ──
    const [classId,           setClassId]           = useState('S3A')
    const [editingSlot,       setEditingSlot]       = useState(null)
    const [showForm,          setShowForm]          = useState(false)
    const [periods,           setPeriods]           = useState(PERIODS)
    const [showPeriodManager, setShowPeriodManager] = useState(false)

    const [schedules, setSchedules] = useState(academicSchedules)

    // ── Exam state ──
    const [exams,           setExams]           = useState([])
    const [examsLoading,    setExamsLoading]    = useState(false)
    const [examsLoaded,     setExamsLoaded]     = useState(false)
    const [selectedSession, setSelectedSession] = useState('all')
    const [sectionFilter,   setSectionFilter]   = useState('all')
    const [classFilter,     setClassFilter]     = useState('all')
    const [showExamForm,    setShowExamForm]    = useState(false)
    const [editingExam,     setEditingExam]     = useState(null)
    const [defaultSession,  setDefaultSession]  = useState('')
    const [defaultDate,     setDefaultDate]     = useState('')
    const [viewingExam,     setViewingExam]     = useState(null)
    const [subjects,        setSubjects]        = useState([])
    const [classes,         setClasses]         = useState([])
    const [rooms,           setRooms]           = useState([])
    const [teachers,        setTeachers]        = useState([])
    const [currentTermId,   setCurrentTermId]   = useState(null)
    const [customSessions,  setCustomSessions]  = useState(() => {
        try { return JSON.parse(localStorage.getItem('imboni_sessions') || '[]') } catch { return [] }
    })
    const [addingSession,   setAddingSession]   = useState(false)
    const [newSessionName,  setNewSessionName]  = useState('')

    // Calendar navigation
    const todayDate = new Date()
    const [calYear,  setCalYear]  = useState(todayDate.getFullYear())
    const [calMonth, setCalMonth] = useState(todayDate.getMonth())

    const printFrameRef = useRef(null)

    useEffect(() => {
        if (activeTab !== 'exams' || examsLoaded) return
        setExamsLoaded(true); setExamsLoading(true)
        getDosExamSchedule().then(setExams).catch(console.error).finally(() => setExamsLoading(false))
        getSubjects().then(setSubjects).catch(console.error)
        getDosClasses().then(setClasses).catch(console.error)
        getDosRooms().then(setRooms).catch(console.error)
        getDosTeachers().then(data => setTeachers(Array.isArray(data) ? data : (data.results||[]))).catch(console.error)
        getCurrentTerm().then(t => { if (t?.id) setCurrentTermId(t.id) }).catch(console.error)
    }, [activeTab, examsLoaded])

    async function handleExamSave(formData) {
        try {
            if (editingExam) await updateDosExamSchedule(editingExam.id, formData)
            else             await createDosExamSchedule(formData)
            setShowExamForm(false); setEditingExam(null); setDefaultSession(''); setDefaultDate('')
            getDosExamSchedule().then(setExams).catch(console.error)
        } catch(e) { console.error(e) }
    }

    async function handleExamDelete(id) {
        try {
            await deleteDosExamSchedule(id)
            setExams(prev => prev.filter(e => e.id !== id))
        } catch(e) { console.error(e) }
    }

    async function handleExamReschedule(id, newDate) {
        try {
            await updateDosExamSchedule(id, { exam_date: newDate })
            getDosExamSchedule().then(setExams).catch(console.error)
        } catch(e) { console.error(e) }
    }

    function prevMonth() {
        if (calMonth === 0) { setCalMonth(11); setCalYear(y => y-1) }
        else setCalMonth(m => m-1)
    }
    function nextMonth() {
        if (calMonth === 11) { setCalMonth(0); setCalYear(y => y+1) }
        else setCalMonth(m => m+1)
    }

    // ── Derived ──

    const examSessionNames = [...new Set(exams.map(e => e.title).filter(Boolean))]
    const sessions = [...new Set([...customSessions, ...examSessionNames])].sort()

    // sec.years = [{name:"S1", streams:["A","B","C"]}, ...]
    const sectionYearSets = (config||[]).reduce((acc, sec) => {
        acc[sec.name] = new Set((sec.years||[]).map(y => y.name))
        return acc
    }, {})

    const classesInSection = (() => {
        if (sectionFilter === 'all') return []
        const sec = (config||[]).find(s => s.name === sectionFilter)
        if (!sec) return []
        return (sec.years||[]).flatMap(year =>
            (year.streams||[]).map(stream => `${year.name}${stream}`)
        )
    })()

    const filteredExams = exams.filter(e => {
        if (selectedSession !== 'all' && e.title !== selectedSession) return false
        if (sectionFilter !== 'all') {
            // exams with no class are school-wide — they pass all section filters
            if (e.class_name) {
                const ys = sectionYearSets[sectionFilter]
                if (ys && ys.size > 0 && !ys.has(yearPfx(e.class_name))) return false
            }
        }
        if (classFilter !== 'all' && e.class_name !== classFilter) return false
        return true
    })

    // ── Session helpers ──
    function handleAddSession() {
        const name = newSessionName.trim()
        if (!name) return
        const updated = [...new Set([...customSessions, name])]
        setCustomSessions(updated)
        localStorage.setItem('imboni_sessions', JSON.stringify(updated))
        setNewSessionName(''); setAddingSession(false)
        setSelectedSession(name)
    }

    async function handleDeleteSession(name) {
        if (!window.confirm(`Delete session "${name}"? This will delete all ${exams.filter(e=>e.title===name).length} exam(s) in it.`)) return
        const toDelete = exams.filter(e => e.title === name)
        await Promise.all(toDelete.map(e => deleteDosExamSchedule(e.id).catch(console.error)))
        const updated = customSessions.filter(s => s !== name)
        setCustomSessions(updated)
        localStorage.setItem('imboni_sessions', JSON.stringify(updated))
        if (selectedSession === name) setSelectedSession('all')
        getDosExamSchedule().then(setExams).catch(console.error)
    }

    // ── Print ──
    function handlePrint() {
        // Columns = unique classes that have exams (sorted), plus GENERAL for unclassed
        const classSet = new Set(filteredExams.map(e => e.class_name).filter(Boolean))
        const hasGeneral = filteredExams.some(e => !e.class_name)
        const columns = [...classSet].sort()
        if (hasGeneral) columns.unshift('GENERAL')
        if (columns.length === 0) { alert('No exams to print.'); return }

        // Rows = unique dates sorted
        const dates = [...new Set(filteredExams.map(e => e.exam_date))].sort()

        // Lookup: "date__class" → exams[]
        const lookup = {}
        filteredExams.forEach(e => {
            const key = `${e.exam_date}__${e.class_name || 'GENERAL'}`
            if (!lookup[key]) lookup[key] = []
            lookup[key].push(e)
        })

        const sessionTitle = selectedSession !== 'all' ? selectedSession.toUpperCase() : 'ALL SESSIONS'
        const filterNote   = [
            sectionFilter !== 'all' ? sectionFilter : '',
            classFilter   !== 'all' ? classFilter   : '',
        ].filter(Boolean).join(' · ')

        const colWidth = Math.max(60, Math.floor(600 / columns.length))

        const headerCells = columns.map(c =>
            `<th style="width:${colWidth}pt">${c}</th>`
        ).join('')

        const bodyRows = dates.map(date => {
            const cells = columns.map(col => {
                const exs = (lookup[`${date}__${col}`] || [])
                    .sort((a,b) => a.start_time.localeCompare(b.start_time))
                if (!exs.length) return '<td></td>'
                const content = exs.map(e => `
                    <div class="cs">${e.subject}</div>
                    <div class="ct">${fmtTime(e.start_time)}-${fmtTime(e.end_time)}</div>
                    ${e.venue      ? `<div class="cv">${e.venue}</div>`      : ''}
                    ${e.invigilator? `<div class="ci">${e.invigilator}</div>`:''}
                `).join('<div class="sep"></div>')
                return `<td>${content}</td>`
            }).join('')
            return `<tr>
                <td class="date-cell">${fmtDate(date).replace(', ', ',<br>')}</td>
                ${cells}
            </tr>`
        }).join('')

        const html = `<!DOCTYPE html><html><head>
<meta charset="utf-8">
<title>Examination Timetable</title>
<style>
@page { size: A4 landscape; margin: 10mm 12mm; }
*     { box-sizing:border-box; margin:0; padding:0; }
body  { font-family:Arial,Helvetica,sans-serif; font-size:9pt; color:#000; }

/* header */
.hdr  { text-align:center; margin-bottom:10pt; padding-bottom:8pt; border-bottom:1.5pt solid #000; }
.h-school { font-size:12pt; font-weight:900; text-transform:uppercase; letter-spacing:.12em; }
.h-title  { font-size:10pt; font-weight:700; text-transform:uppercase; margin:3pt 0; letter-spacing:.06em; }
.h-session{ font-size:10pt; font-weight:700; text-decoration:underline; }
.h-note   { font-size:8pt; color:#555; margin-top:2pt; }

/* table */
table { width:100%; border-collapse:collapse; table-layout:fixed; }
thead th {
    background:#1a1a1a; color:#fff; padding:5pt 4pt;
    text-align:center; font-size:8pt; font-weight:700;
    border:1pt solid #000; letter-spacing:.04em; text-transform:uppercase;
}
th.date-th { width:55pt; background:#444; }
td {
    padding:4pt 4pt; border:1pt solid #bbb;
    vertical-align:top; font-size:8pt;
}
td.date-cell {
    background:#e8e8e8; font-weight:700; font-size:7.5pt;
    text-align:center; vertical-align:middle; line-height:1.3;
}
tr:nth-child(even) td:not(.date-cell) { background:#f7f7f7; }
tr:nth-child(odd)  td:not(.date-cell) { background:#fff; }

/* cell content */
.cs  { font-weight:700; font-size:8.5pt; color:#000; }
.ct  { font-size:7.5pt; color:#444; margin-top:1.5pt; font-weight:600; }
.cv  { font-size:7pt; color:#777; font-style:italic; margin-top:1pt; }
.ci  { font-size:7pt; color:#333; margin-top:1pt; }
.sep { border-top:.5pt solid #ccc; margin:3pt 0; }

/* footer */
.ftr {
    margin-top:8pt; display:flex; justify-content:space-between;
    font-size:7pt; color:#888;
    border-top:.5pt solid #ccc; padding-top:4pt;
}
</style>
</head><body>

<div class="hdr">
    <div class="h-school">${setting?.school_name || 'IMBONI SCHOOL'}</div>
    <div class="h-title">EXAMINATION TIMETABLE</div>
    <div class="h-session">${sessionTitle}</div>
    ${filterNote ? `<div class="h-note">${filterNote}</div>` : ''}
</div>

<table>
    <thead>
        <tr>
            <th class="date-th">DATES</th>
            ${headerCells}
        </tr>
    </thead>
    <tbody>
        ${bodyRows}
    </tbody>
</table>

<div class="ftr">
    <span>Total: ${filteredExams.length} exam(s) across ${dates.length} day(s)</span>
    <span>Generated: ${new Date().toLocaleDateString('en-GB',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</span>
</div>

<script>window.onload = function(){ window.focus(); window.print(); }<\/script>
</body></html>`

        const iframe = printFrameRef.current
        const doc = iframe.contentDocument || iframe.contentWindow.document
        doc.open(); doc.write(html); doc.close()
        // Fallback timer in case onload already fired
        setTimeout(() => { try { iframe.contentWindow.focus(); iframe.contentWindow.print() } catch(_){} }, 600)
    }

    // Map date → sorted exams list
    const examsByDate = filteredExams.reduce((acc, e) => {
        if (!acc[e.exam_date]) acc[e.exam_date] = []
        acc[e.exam_date].push(e)
        return acc
    }, {})
    Object.values(examsByDate).forEach(arr => arr.sort((a,b) => a.start_time.localeCompare(b.start_time)))

    const calDays = getCalendarDays(calYear, calMonth)

    // ── Timetable handlers ──
    function handleEditCell(slotInfo) { setEditingSlot(slotInfo); setShowForm(true) }
    function handleSave(formData) {
        const { day, slotId, subject, teacher, room } = formData
        if (!day||!slotId) return
        const pi = periods.findIndex(p => String(p.id)===String(slotId))
        if (pi===-1) return
        setSchedules(prev => {
            const cd = {...(prev[classId]||{})}
            const da = [...(cd[day]||Array(periods.length).fill(null))]
            da[pi]   = subject ? {subject,teacher,room,teacherId:editingSlot?.cell?.teacherId||''} : null
            return {...prev,[classId]:{...cd,[day]:da}}
        })
        setShowForm(false); setEditingSlot(null)
    }
    function handleDelete(slotInfo) {
        const {period,day} = slotInfo
        const pi = periods.findIndex(p => p.id===period.id)
        if (pi===-1) return
        setSchedules(prev => {
            const cd = {...(prev[classId]||{})}
            const da = [...(cd[day]||[])]
            da[pi]   = null
            return {...prev,[classId]:{...cd,[day]:da}}
        })
        setShowForm(false); setEditingSlot(null)
    }

    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={dosNavItems} secondaryItems={dosSecondaryItems}/>
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader title="Scheduling" subtitle="Weekly class timetables and examination schedule" {...sessionUser} notifications={liveNotifications} onNotificationRead={markRead} />

                    <DashboardContent>
                        <div className="filter-tabs-bar mb-5">
                            <button className={`filter-tab${activeTab==='timetable'?' active':''}`} onClick={() => setActiveTab('timetable')}>
                                <span className="material-symbols-rounded">calendar_view_week</span> Timetable
                            </button>
                            <button className={`filter-tab${activeTab==='exams'?' active':''}`} onClick={() => setActiveTab('exams')}>
                                <span className="material-symbols-rounded">school</span> Exam Schedule
                            </button>
                            <button className={`filter-tab${activeTab==='duty'?' active':''}`} onClick={() => setActiveTab('duty')}>
                                <span className="material-symbols-rounded">assignment_ind</span> Duty Roster
                            </button>
                            <button className={`filter-tab${activeTab==='dining'?' active':''}`} onClick={() => setActiveTab('dining')}>
                                <span className="material-symbols-rounded">restaurant</span> Dining
                            </button>
                        </div>

                        {/* ── DUTY ROSTER TAB ── */}
                        {activeTab==='duty' && <DutyRosterTab />}

                        {/* ── DINING PLANNER TAB ── */}
                        {activeTab==='dining' && <DiningPlannerTab />}

                        {/* ── TIMETABLE TAB ── */}
                        {activeTab==='timetable' && (
                            <>
                                <div className="portal-stat-grid mb-5">
                                    {timetableStats.map((s,i) => <StatCard key={i} {...s}/>)}
                                </div>

                                <div className="card">
                                    <div className="card-header">
                                        <h2 className="card-title">Class {classId}</h2>
                                        <div className="flex-row-gap">
                                            <div className="flex-row-gap-sm">
                                                <label className="form-label mb-0" htmlFor="timetable-class-select">Class:</label>
                                                <select id="timetable-class-select" className="form-input dos-select-auto" value={classId} onChange={e=>setClassId(e.target.value)}>
                                                    {allClasses.map(c => <option key={c} value={c}>{c}</option>)}
                                                </select>
                                            </div>
                                            <button className="btn btn-outline btn-sm" onClick={() => setShowPeriodManager(true)}>
                                                <span className="material-symbols-rounded icon-sm">schedule</span> Edit Periods
                                            </button>
                                            <button className="btn btn-primary btn-sm" onClick={() => {setEditingSlot(null);setShowForm(true)}}>
                                                <span className="material-symbols-rounded">add</span> Add Slot
                                            </button>
                                        </div>
                                    </div>
                                    <div className="card-content">
                                        <Timetable type="academic" classId={classId} editable onEditCell={handleEditCell} periods={periods} schedules={schedules}/>
                                    </div>
                                </div>
                                {showPeriodManager && <PeriodManager periods={periods} onChange={setPeriods} onClose={() => setShowPeriodManager(false)}/>}
                                {showForm && <TimetableEditForm type="academic" editingSlot={editingSlot} onSave={handleSave} onDelete={handleDelete} onCancel={() => setShowForm(false)} periods={periods}/>}
                            </>
                        )}

                        {/* ── EXAM SCHEDULE TAB ── */}
                        {activeTab==='exams' && (
                            <>
                                <div className="card">
                                    <div className="card-header">
                                        <h2 className="card-title">Exam Schedule</h2>
                                        <div className="es-card-actions">
                                            <button className="btn btn-outline btn-sm" onClick={handlePrint}><span className="material-symbols-rounded">print</span> Print / PDF</button>
                                            <button className="btn btn-primary btn-sm" onClick={() => {setDefaultSession(selectedSession!=='all'?selectedSession:'');setDefaultDate('');setEditingExam(null);setShowExamForm(true)}}>
                                                <span className="material-symbols-rounded">add</span> Add Exam
                                            </button>
                                        </div>
                                    </div>

                                    <div className="card-content">

                                        {/* Session */}
                                        <div className="es-filter-section">
                                            <div className="es-filter-section-label"><span className="material-symbols-rounded">folder_open</span> Session</div>
                                            <div className="es-session-chips">
                                                <button className={`es-session-chip${selectedSession==='all'?' active':''}`} onClick={() => setSelectedSession('all')}>
                                                    All <span className="es-chip-count">{exams.length}</span>
                                                </button>
                                                {sessions.map(s => (
                                                    <span key={s} className={`es-session-chip-wrap${selectedSession===s?' active':''}`}>
                                                        <button className="es-session-chip-label" onClick={() => setSelectedSession(s)}>
                                                            {s} <span className="es-chip-count">{exams.filter(e=>e.title===s).length}</span>
                                                        </button>
                                                        <button className="es-session-chip-del" title="Delete session"
                                                            onClick={e => {e.stopPropagation();handleDeleteSession(s)}}>
                                                            <span className="material-symbols-rounded">close</span>
                                                        </button>
                                                    </span>
                                                ))}
                                                {addingSession ? (
                                                    <span className="es-session-add-input">
                                                        <input autoFocus className="form-input es-session-input"
                                                            placeholder="Session name…" value={newSessionName}
                                                            onChange={e => setNewSessionName(e.target.value)}
                                                            onKeyDown={e => { if (e.key==='Enter') handleAddSession(); if (e.key==='Escape') {setAddingSession(false);setNewSessionName('')} }}
                                                        />
                                                        <button className="btn btn-primary btn-sm es-session-btn" onClick={handleAddSession}>Add</button>
                                                        <button className="btn btn-outline btn-sm es-session-btn-x" onClick={() => {setAddingSession(false);setNewSessionName('')}}>✕</button>
                                                    </span>
                                                ) : (
                                                    <button className="es-session-chip es-session-chip-new" onClick={() => setAddingSession(true)}>
                                                        <span className="material-symbols-rounded es-new-session-icon">add</span> New Session
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Level */}
                                        <div className="es-filter-section">
                                            <div className="es-filter-section-label"><span className="material-symbols-rounded">layers</span> Level</div>
                                            <div className="att-mode-bar u-mb-0">
                                                <button className={`att-mode-btn${sectionFilter==='all'?' active':''}`} onClick={() => {setSectionFilter('all');setClassFilter('all')}}>All Levels</button>
                                                {(config||[]).map(sec => (
                                                    <button key={sec.id||sec.name} className={`att-mode-btn${sectionFilter===sec.name?' active':''}`} onClick={() => {setSectionFilter(sec.name);setClassFilter('all')}}>
                                                        <span className="material-symbols-rounded">school</span>
                                                        {sec.name}
                                                        {(sec.years||[]).length>0 && <span className="es-section-range">{sec.years[0].name}-{sec.years[sec.years.length-1].name}</span>}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Class (only when section selected) */}
                                        {sectionFilter!=='all' && classesInSection.length>0 && (
                                            <div className="es-filter-section">
                                                <div className="es-filter-section-label"><span className="material-symbols-rounded">group</span> Class</div>
                                                <div className="es-class-chips">
                                                    <button className={`es-class-chip-btn${classFilter==='all'?' active':''}`} onClick={() => setClassFilter('all')}>All</button>
                                                    {classesInSection.map(cls => (
                                                        <button key={cls} className={`es-class-chip-btn${classFilter===cls?' active':''}`} onClick={() => setClassFilter(cls)}>{cls}</button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Legend */}
                                        <div className="es-cal-legend">
                                            {EXAM_TYPES.map(t => (
                                                <span key={t.value} className="es-cal-legend-item">
                                                    <span className="es-cal-legend-dot" style={{background:TYPE_COLORS[t.value]}}/>
                                                    {t.label}
                                                </span>
                                            ))}
                                        </div>

                                        {/* ── Month calendar ── */}
                                        {examsLoading ? (
                                            <p className="es-empty-msg">Loading exams…</p>
                                        ) : (
                                            <div className="es-cal-month-wrap">

                                                {/* Navigation */}
                                                <div className="es-cal-month-nav">
                                                    <button className="btn btn-outline btn-sm" onClick={() => {setCalYear(todayDate.getFullYear());setCalMonth(todayDate.getMonth())}}>Today</button>
                                                    <button className="es-cal-nav-btn" onClick={prevMonth}>
                                                        <span className="material-symbols-rounded">chevron_left</span>
                                                    </button>
                                                    <button className="es-cal-nav-btn" onClick={nextMonth}>
                                                        <span className="material-symbols-rounded">chevron_right</span>
                                                    </button>
                                                    <span className="es-cal-month-title">{MONTH_NAMES[calMonth]} {calYear}</span>
                                                    <span className="es-cal-month-count">
                                                        {filteredExams.filter(e => {
                                                            const d = new Date(e.exam_date+'T00:00:00')
                                                            return d.getFullYear()===calYear && d.getMonth()===calMonth
                                                        }).length} exams this month
                                                    </span>
                                                </div>

                                                {/* Day-of-week headers */}
                                                <div className="es-cal-month-grid">
                                                    {DOW_SHORT.map(d => (
                                                        <div key={d} className="es-cal-month-dow">{d}</div>
                                                    ))}

                                                    {/* Day cells */}
                                                    {calDays.map(day => {
                                                        const dayExams = examsByDate[day.date] || []
                                                        return (
                                                            <div key={day.date}
                                                                className={[
                                                                    'es-cal-month-cell',
                                                                    !day.isThisMonth ? 'other-month' : '',
                                                                    day.isToday ? 'is-today' : '',
                                                                    day.isSunday ? 'is-sunday' : '',
                                                                ].filter(Boolean).join(' ')}
                                                                onClick={() => {
                                                                    setDefaultDate(day.date)
                                                                    setDefaultSession(selectedSession!=='all'?selectedSession:'')
                                                                    setEditingExam(null)
                                                                    setShowExamForm(true)
                                                                }}>
                                                                <span className={`es-cal-month-num${day.isToday?' today':''}`}>{day.day}</span>
                                                                <div className="es-cal-month-events">
                                                                    {dayExams.slice(0,2).map(exam => {
                                                                        const done  = examStatus(exam.exam_date).label==='Completed'
                                                                        const color = done ? '#9ca3af' : (TYPE_COLORS[exam.exam_type]||TYPE_COLORS.other)
                                                                        return (
                                                                            <div key={exam.id} className="es-cal-month-event"
                                                                                style={{borderLeftColor:color}}
                                                                                onClick={e => {e.stopPropagation();setViewingExam(exam)}}>
                                                                                <div className="es-cal-month-ev-subject">{exam.subject}</div>
                                                                                <div className="es-cal-month-ev-meta">
                                                                                    {exam.class_name && <span>{exam.class_name}</span>}
                                                                                    <span>{fmtTime(exam.start_time)}</span>
                                                                                </div>
                                                                            </div>
                                                                        )
                                                                    })}
                                                                    {dayExams.length>3 && (
                                                                        <div className="es-cal-month-more">+{dayExams.length-3} more</div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {viewingExam && (
                                    <ExamDetailModal
                                        exam={viewingExam}
                                        onClose={() => setViewingExam(null)}
                                        onEdit={() => {setEditingExam(viewingExam);setViewingExam(null);setShowExamForm(true)}}
                                        onDelete={id => {handleExamDelete(id);setViewingExam(null)}}
                                        onReschedule={handleExamReschedule}
                                    />
                                )}

                                {showExamForm && (
                                    <ExamForm
                                        editing={editingExam}
                                        defaultSession={defaultSession}
                                        defaultDate={defaultDate}
                                        sessions={sessions}
                                        subjects={subjects}
                                        classes={classes}
                                        rooms={rooms}
                                        teachers={teachers}
                                        termId={currentTermId}
                                        onSave={handleExamSave}
                                        onCancel={() => {setShowExamForm(false);setEditingExam(null);setDefaultSession('');setDefaultDate('')}}
                                    />
                                )}
                            </>
                        )}
                    </DashboardContent>
                </main>
            </div>

            {/* Hidden iframe used as print target — avoids popup blockers */}
            <iframe ref={printFrameRef} title="exam-print"
                className="es-print-frame"
                aria-hidden="true"/>
        </>
    )
}
