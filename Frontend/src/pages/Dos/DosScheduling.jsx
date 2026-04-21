import { useState } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { StatCard } from '../../components/layout/StatCard'
import { Timetable } from '../../components/timetable/Timetable'
import { TimetableEditForm } from '../../components/timetable/TimetableEditForm'
import { PeriodManager } from '../../components/timetable/PeriodManager'
import { PERIODS, academicSchedules } from '../../data/academicTimetable'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/dos.css'
import { dosNavItems, dosSecondaryItems, dosUser } from './dosNav'


// ── Timetable tab data ──
const ALL_CLASSES = ['S1A', 'S1B', 'S2A', 'S2B', 'S3A', 'S3B', 'S4A', 'S4B', 'S5A', 'S5B', 'S6A', 'S6B']

const timetableStats = [
    { colorClass: 'info',    icon: 'calendar_view_week', value: '8',      label: 'Periods per Day',   trend: 'Mon – Sat'    },
    { colorClass: 'success', icon: 'menu_book',          value: '9',      label: 'Subjects',          trend: 'All classes'  },
    { colorClass: 'warning', icon: 'school',             value: '7',      label: 'Teachers Assigned', trend: 'Fully staffed'},
    { colorClass: '',        icon: 'event_available',    value: 'Term 2', label: 'Current Term',      trend: '2026'         },
]

// ── Exam Schedule tab data ──
const examRows = [
    { num: 1, subject: 'Mathematics',          code: 'MAT 401', classes: 'S4A · S4B · S4C', date: 'Mon, 16 Mar 2026', time: '8:00 – 11:00', duration: '3 hrs',   rooms: ['Hall A', 'Hall B'],   invigilator: 'Mr. Aimable Ndahiro',      statusClass: 'badge-upcoming', status: 'Upcoming' },
    { num: 2, subject: 'English Language',     code: 'ENG 401', classes: 'S4A · S4B · S4C', date: 'Tue, 17 Mar 2026', time: '8:00 – 10:30', duration: '2.5 hrs', rooms: ['Hall A', 'Hall B'],   invigilator: 'Ms. Claudine Umutoni',     statusClass: 'badge-upcoming', status: 'Upcoming' },
    { num: 3, subject: 'Physics',              code: 'PHY 401', classes: 'S4A · S4B',       date: 'Wed, 18 Mar 2026', time: '8:00 – 11:00', duration: '3 hrs',   rooms: ['Room 8', 'Room 9'],   invigilator: 'Mr. Pacifique Rurangwa',   statusClass: 'badge-upcoming', status: 'Upcoming' },
    { num: 4, subject: 'Chemistry',            code: 'CHE 401', classes: 'S4A · S4B · S4C', date: 'Thu, 19 Mar 2026', time: '8:00 – 11:00', duration: '3 hrs',   rooms: ['Hall A', 'Lab 2'],    invigilator: 'Mr. Théophile Bizimana',   statusClass: 'badge-upcoming', status: 'Upcoming' },
    { num: 5, subject: 'Biology',              code: 'BIO 401', classes: 'S4A · S4C',       date: 'Fri, 20 Mar 2026', time: '8:00 – 11:00', duration: '3 hrs',   rooms: ['Hall B', 'Lab 3'],    invigilator: 'Mr. Janvier Ntakirutimana', statusClass: 'badge-upcoming', status: 'Upcoming' },
    { num: 6, subject: 'Kinyarwanda',          code: 'KIN 401', classes: 'S4A · S4B · S4C', date: 'Mon, 23 Mar 2026', time: '8:00 – 10:30', duration: '2.5 hrs', rooms: ['Hall A', 'Hall B'],   invigilator: 'Ms. Sandrine Uwera',       statusClass: 'badge-draft',    status: 'Draft'    },
    { num: 7, subject: 'History & Government', code: 'HIS 301', classes: 'S3A · S3B · S3C', date: 'Tue, 17 Mar 2026', time: '2:00 – 4:30',  duration: '2.5 hrs', rooms: ['Room 10', 'Room 11'], invigilator: 'Mr. Gaspard Nkurunziza',   statusClass: 'badge-upcoming', status: 'Upcoming' },
]

function ExamRow({ num, subject, code, classes, date, time, duration, rooms, invigilator, statusClass, status }) {
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
                    <button className="es-icon-btn danger"><span className="material-symbols-rounded">delete</span></button>
                </div>
            </td>
        </tr>
    )
}

// ── Main page ──
export function DosScheduling() {
    const [activeTab, setActiveTab] = useState('timetable')

    // Timetable tab state
    const [classId, setClassId]               = useState('S3A')
    const [editingSlot, setEditingSlot]       = useState(null)
    const [showForm, setShowForm]             = useState(false)
    const [periods, setPeriods]               = useState(PERIODS)
    const [showPeriodManager, setShowPeriodManager] = useState(false)
    const [schedules, setSchedules]           = useState(academicSchedules)

    function handleEditCell(slotInfo) {
        setEditingSlot(slotInfo)
        setShowForm(true)
    }

    function handleSave(formData) {
        const { day, slotId, subject, teacher, room } = formData
        if (!day || !slotId) return
        const periodIndex = periods.findIndex(p => String(p.id) === String(slotId))
        if (periodIndex === -1) return
        setSchedules(prev => {
            const classData = { ...(prev[classId] || {}) }
            const dayArray  = [...(classData[day] || Array(periods.length).fill(null))]
            dayArray[periodIndex] = subject
                ? { subject, teacher, room, teacherId: editingSlot?.cell?.teacherId || '' }
                : null
            return { ...prev, [classId]: { ...classData, [day]: dayArray } }
        })
        setShowForm(false)
        setEditingSlot(null)
    }

    function handleDelete(slotInfo) {
        const { period, day } = slotInfo
        const periodIndex = periods.findIndex(p => p.id === period.id)
        if (periodIndex === -1) return
        setSchedules(prev => {
            const classData = { ...(prev[classId] || {}) }
            const dayArray  = [...(classData[day] || [])]
            dayArray[periodIndex] = null
            return { ...prev, [classId]: { ...classData, [day]: dayArray } }
        })
        setShowForm(false)
        setEditingSlot(null)
    }

    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={dosNavItems} secondaryItems={dosSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title="Scheduling"
                        subtitle="Weekly class timetables and examination schedule — Term 2, 2026"
                        {...dosUser}
                    />

                    <div className="dashboard-content">

                        {/* Tab switcher */}
                        <div className="filter-tabs-bar" style={{ marginBottom: '1.25rem' }}>
                            <button
                                className={`filter-tab${activeTab === 'timetable' ? ' active' : ''}`}
                                onClick={() => setActiveTab('timetable')}
                            >
                                <span className="material-symbols-rounded">calendar_view_week</span> Timetable
                            </button>
                            <button
                                className={`filter-tab${activeTab === 'exams' ? ' active' : ''}`}
                                onClick={() => setActiveTab('exams')}
                            >
                                <span className="material-symbols-rounded">school</span> Exam Schedule
                            </button>
                        </div>

                        {/* ── TIMETABLE TAB ── */}
                        {activeTab === 'timetable' && (
                            <>
                                <div className="portal-stat-grid" style={{ marginBottom: '1.25rem' }}>
                                    {timetableStats.map((stat, i) => <StatCard key={i} {...stat} />)}
                                </div>

                                <div className="card">
                                    <div className="card-header">
                                        <h2 className="card-title">Class {classId} — Weekly Timetable</h2>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <label className="form-label" style={{ margin: 0 }}>Class:</label>
                                                <select
                                                    className="form-input"
                                                    style={{ width: 'auto' }}
                                                    value={classId}
                                                    onChange={e => setClassId(e.target.value)}
                                                >
                                                    {ALL_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                                                </select>
                                            </div>
                                            <button className="btn btn-outline btn-sm" onClick={() => setShowPeriodManager(true)}>
                                                <span className="material-symbols-rounded icon-sm">schedule</span> Edit Periods
                                            </button>
                                            <button className="btn btn-primary btn-sm" onClick={() => { setEditingSlot(null); setShowForm(true) }}>
                                                <span className="material-symbols-rounded">add</span> Add Slot
                                            </button>
                                        </div>
                                    </div>
                                    <div className="card-content">
                                        <Timetable
                                            type="academic"
                                            classId={classId}
                                            editable={true}
                                            onEditCell={handleEditCell}
                                            periods={periods}
                                            schedules={schedules}
                                        />
                                    </div>
                                </div>

                                {showPeriodManager && (
                                    <PeriodManager
                                        periods={periods}
                                        onChange={setPeriods}
                                        onClose={() => setShowPeriodManager(false)}
                                    />
                                )}

                                {showForm && (
                                    <TimetableEditForm
                                        type="academic"
                                        editingSlot={editingSlot}
                                        onSave={handleSave}
                                        onDelete={handleDelete}
                                        onCancel={() => setShowForm(false)}
                                        periods={periods}
                                    />
                                )}
                            </>
                        )}

                        {/* ── EXAM SCHEDULE TAB ── */}
                        {activeTab === 'exams' && (
                            <>
                                <nav className="es-tabs" style={{ marginBottom: '1rem' }}>
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

                                <div className="card">
                                    <div className="card-header">
                                        <h2 className="card-title">Term 2 &middot; 2026 Exam Schedule</h2>
                                        <div className="es-card-actions">
                                            <span className="badge badge-published">Published</span>
                                            <button className="btn btn-secondary btn-sm">
                                                <span className="material-symbols-rounded">download</span> Export CSV
                                            </button>
                                            <button className="btn btn-secondary btn-sm">
                                                <span className="material-symbols-rounded">print</span> Print / PDF
                                            </button>
                                            <button className="btn btn-primary btn-sm">
                                                <span className="material-symbols-rounded">add</span> Add Exam
                                            </button>
                                        </div>
                                    </div>
                                    <div className="card-content">
                                        <div className="att-mode-bar">
                                            <button className="att-mode-btn active">All Levels</button>
                                            <button className="att-mode-btn">
                                                <span className="material-symbols-rounded">school</span> Ordinary (S1–S3)
                                            </button>
                                            <button className="att-mode-btn">
                                                <span className="material-symbols-rounded">workspace_premium</span> Advanced (S4–S6)
                                            </button>
                                        </div>
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
                                                    {examRows.map((row, i) => <ExamRow key={i} {...row} />)}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                    </div>
                </main>
            </div>
        </>
    )
}
