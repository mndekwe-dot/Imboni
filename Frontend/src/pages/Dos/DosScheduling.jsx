import { useState, useEffect } from 'react'
import { useSchoolConfig } from '../../hooks/useSchoolConfig'
import { classesFromConfig } from '../../utils/classes'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { StatCard } from '../../components/layout/StatCard'
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
import { dosNavItems, dosSecondaryItems, dosUser } from './dosNav'
import { DashboardContent } from '../../components/layout/DashboardContent'

// ── Constants ─────────────────────────────────────────────────────────────────

const timetableStats = [
    { colorClass: 'info',    icon: 'calendar_view_week', value: '8',      label: 'Periods per Day',   trend: 'Mon – Sat'    },
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
    if (!str) return '—'
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

function ExamDetailModal({ exam, onClose, onEdit, onDelete }) {
    const { label, cls } = examStatus(exam.exam_date)
    const duration = calcDuration(exam.start_time, exam.end_time)
    const typLabel = EXAM_TYPES.find(t => t.value === exam.exam_type)?.label || exam.exam_type

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
                                    <span className="material-symbols-rounded" style={{fontSize:'.85rem',verticalAlign:'middle'}}>folder_open</span>
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
                                {fmtTime(exam.start_time)} – {fmtTime(exam.end_time)}
                                {duration && <span style={{color:'var(--muted-foreground)',marginLeft:'.4rem'}}>({duration})</span>}
                            </div>
                        </div>
                    </div>
                    <div className="es-detail-item">
                        <span className="material-symbols-rounded es-detail-icon">class</span>
                        <div><div className="es-detail-label">Class</div><div className="es-detail-value">{exam.class_name||'All classes'}</div></div>
                    </div>
                    <div className="es-detail-item">
                        <span className="material-symbols-rounded es-detail-icon">meeting_room</span>
                        <div><div className="es-detail-label">Venue</div><div className="es-detail-value">{exam.venue||'—'}</div></div>
                    </div>
                    <div className="es-detail-item">
                        <span className="material-symbols-rounded es-detail-icon">person</span>
                        <div><div className="es-detail-label">Invigilator</div><div className="es-detail-value">{exam.invigilator||'—'}</div></div>
                    </div>
                    <div className="es-detail-item">
                        <span className="material-symbols-rounded es-detail-icon">school</span>
                        <div><div className="es-detail-label">Term</div><div className="es-detail-value">{exam.term||'—'}</div></div>
                    </div>
                    {exam.notes && (
                        <div className="es-detail-item es-detail-span2">
                            <span className="material-symbols-rounded es-detail-icon">notes</span>
                            <div><div className="es-detail-label">Notes</div><div className="es-detail-value">{exam.notes}</div></div>
                        </div>
                    )}
                </div>

                <div className="es-detail-actions">
                    <button className="btn btn-outline" style={{color:'#ef4444',borderColor:'#ef4444'}}
                        onClick={() => { if (window.confirm('Delete this exam?')) { onDelete(exam.id); onClose() } }}>
                        <span className="material-symbols-rounded icon-sm">delete</span> Delete
                    </button>
                    <button className="btn btn-outline" onClick={onClose}>Close</button>
                    <button className="btn btn-primary" onClick={onEdit}>
                        <span className="material-symbols-rounded icon-sm">edit</span> Edit
                    </button>
                </div>
            </div>
        </Modal>
    )
}

// ── Exam add / edit form ──────────────────────────────────────────────────────

function ExamForm({ editing, defaultSession, sessions, subjects, classes, rooms, teachers, termId, onSave, onCancel }) {
    const [form, setForm] = useState({
        session:        editing?.title           || defaultSession || '',
        subject_id:     editing?.subject_id      || '',
        class_id:       editing?.class_id        || '',
        exam_date:      editing?.exam_date        || '',
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
                <div className="form-group" style={{marginBottom:'.75rem'}}>
                    <label className="form-label"><span className="material-symbols-rounded icon-sm">folder_open</span> Session / Group Name</label>
                    <input className="form-input" list="es-session-list" value={form.session} onChange={set('session')} placeholder="e.g. Term 2 Final Exams" />
                    <datalist id="es-session-list">{sessions.map(s => <option key={s} value={s}/>)}</datalist>
                </div>
                <div className="tt-form-row">
                    <div className="form-group">
                        <label className="form-label">Subject *</label>
                        <select className="form-input" value={form.subject_id} onChange={set('subject_id')}>
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
                        <label className="form-label">Date *</label>
                        <input className="form-input" type="date" value={form.exam_date} onChange={set('exam_date')}/>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Start *</label>
                        <input className="form-input" type="time" value={form.start_time} onChange={set('start_time')}/>
                    </div>
                    <div className="form-group">
                        <label className="form-label">End *</label>
                        <input className="form-input" type="time" value={form.end_time} onChange={set('end_time')}/>
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
                    <textarea className="form-input" rows={2} value={form.notes} onChange={set('notes')} placeholder="Optional notes..." style={{resize:'vertical'}}/>
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
    const { config } = useSchoolConfig()
    const allClasses = classesFromConfig(config)
    const [activeTab, setActiveTab] = useState('timetable')

    // ── Timetable state ──
    const [classId,           setClassId]           = useState('S3A')
    const [editingSlot,       setEditingSlot]       = useState(null)
    const [showForm,          setShowForm]          = useState(false)
    const [periods,           setPeriods]           = useState(PERIODS)
    const [showPeriodManager, setShowPeriodManager] = useState(false)
    const [schedules,         setSchedules]         = useState(academicSchedules)

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
    const [viewingExam,     setViewingExam]     = useState(null)
    const [subjects,        setSubjects]        = useState([])
    const [classes,         setClasses]         = useState([])
    const [rooms,           setRooms]           = useState([])
    const [teachers,        setTeachers]        = useState([])
    const [currentTermId,   setCurrentTermId]   = useState(null)

    // Calendar navigation
    const todayDate = new Date()
    const [calYear,  setCalYear]  = useState(todayDate.getFullYear())
    const [calMonth, setCalMonth] = useState(todayDate.getMonth())

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
            setShowExamForm(false); setEditingExam(null); setDefaultSession('')
            getDosExamSchedule().then(setExams).catch(console.error)
        } catch(e) { console.error(e) }
    }

    async function handleExamDelete(id) {
        try {
            await deleteDosExamSchedule(id)
            setExams(prev => prev.filter(e => e.id !== id))
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

    const sessions = [...new Set(exams.map(e => e.title).filter(Boolean))].sort()

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
            const ys = sectionYearSets[sectionFilter]
            if (ys && ys.size > 0 && !ys.has(yearPfx(e.class_name))) return false
        }
        if (classFilter !== 'all' && e.class_name !== classFilter) return false
        return true
    })

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
            da[pi] = subject ? {subject,teacher,room,teacherId:editingSlot?.cell?.teacherId||''} : null
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
            da[pi] = null
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
                    <DashboardHeader title="Scheduling" subtitle="Weekly class timetables and examination schedule" {...dosUser}/>

                    <DashboardContent>
                        <div className="filter-tabs-bar mb-5">
                            <button className={`filter-tab${activeTab==='timetable'?' active':''}`} onClick={() => setActiveTab('timetable')}>
                                <span className="material-symbols-rounded">calendar_view_week</span> Timetable
                            </button>
                            <button className={`filter-tab${activeTab==='exams'?' active':''}`} onClick={() => setActiveTab('exams')}>
                                <span className="material-symbols-rounded">school</span> Exam Schedule
                            </button>
                        </div>

                        {/* ── TIMETABLE TAB ── */}
                        {activeTab==='timetable' && (
                            <>
                                <div className="portal-stat-grid mb-5">
                                    {timetableStats.map((s,i) => <StatCard key={i} {...s}/>)}
                                </div>
                                <div className="card">
                                    <div className="card-header">
                                        <h2 className="card-title">Class {classId} — Weekly Timetable</h2>
                                        <div className="flex-row-gap">
                                            <div className="flex-row-gap-sm">
                                                <label className="form-label mb-0">Class:</label>
                                                <select className="form-input" style={{width:'auto'}} value={classId} onChange={e=>setClassId(e.target.value)}>
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
                                            <button className="btn btn-outline btn-sm"><span className="material-symbols-rounded">download</span> Export CSV</button>
                                            <button className="btn btn-outline btn-sm"><span className="material-symbols-rounded">print</span> Print / PDF</button>
                                            <button className="btn btn-primary btn-sm" onClick={() => {setDefaultSession(selectedSession!=='all'?selectedSession:'');setEditingExam(null);setShowExamForm(true)}}>
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
                                                    <button key={s} className={`es-session-chip${selectedSession===s?' active':''}`} onClick={() => setSelectedSession(s)}>
                                                        {s} <span className="es-chip-count">{exams.filter(e=>e.title===s).length}</span>
                                                    </button>
                                                ))}
                                                {sessions.length===0 && !examsLoading && <span className="es-no-sessions">No sessions yet</span>}
                                            </div>
                                        </div>

                                        {/* Level */}
                                        <div className="es-filter-section">
                                            <div className="es-filter-section-label"><span className="material-symbols-rounded">layers</span> Level</div>
                                            <div className="att-mode-bar" style={{marginBottom:0}}>
                                                <button className={`att-mode-btn${sectionFilter==='all'?' active':''}`} onClick={() => {setSectionFilter('all');setClassFilter('all')}}>All Levels</button>
                                                {(config||[]).map(sec => (
                                                    <button key={sec.id||sec.name} className={`att-mode-btn${sectionFilter===sec.name?' active':''}`} onClick={() => {setSectionFilter(sec.name);setClassFilter('all')}}>
                                                        <span className="material-symbols-rounded">school</span>
                                                        {sec.name}
                                                        {(sec.years||[]).length>0 && <span className="es-section-range">{sec.years[0].name}–{sec.years[sec.years.length-1].name}</span>}
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
                                                            <div key={day.date} className={[
                                                                'es-cal-month-cell',
                                                                !day.isThisMonth ? 'other-month' : '',
                                                                day.isToday ? 'is-today' : '',
                                                                day.isSunday ? 'is-sunday' : '',
                                                            ].filter(Boolean).join(' ')}>
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
                                    />
                                )}

                                {showExamForm && (
                                    <ExamForm
                                        editing={editingExam}
                                        defaultSession={defaultSession}
                                        sessions={sessions}
                                        subjects={subjects}
                                        classes={classes}
                                        rooms={rooms}
                                        teachers={teachers}
                                        termId={currentTermId}
                                        onSave={handleExamSave}
                                        onCancel={() => {setShowExamForm(false);setEditingExam(null);setDefaultSession('')}}
                                    />
                                )}
                            </>
                        )}
                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
