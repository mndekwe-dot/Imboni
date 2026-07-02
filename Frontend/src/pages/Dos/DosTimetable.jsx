import { useState, useEffect } from 'react'
import { Select } from '../../components/ui/Select'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useNotifications } from '../../hooks/useNotifications'
import { useSessionUser } from '../../hooks/useSessionUser'
import { StatCard } from '../../components/layout/StatCard'
import { Timetable } from '../../components/timetable/Timetable'
import { TimetableEditForm } from '../../components/timetable/TimetableEditForm'
import { PeriodManager } from '../../components/timetable/PeriodManager'
import { PERIODS } from '../../data/academicTimetable'
import { getDosClasses, getDosTimetable, saveDosSlot, updateDosSlot, deleteDosSlot, getSubjects, getDosTeachersBySubjectAndClass, getDosRooms } from '../../api/dos'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/dos.css'
import { dosNavItems, dosSecondaryItems } from './dosNav'
import { DashboardContent } from '../../components/layout/DashboardContent'

const timetableStats = [
    { colorClass: 'info',    icon: 'calendar_view_week', value: '8',      label: 'Periods per Day',   trend: 'Mon – Sat'    },
    { colorClass: 'success', icon: 'menu_book',          value: '9',      label: 'Subjects',          trend: 'All classes'  },
    { colorClass: 'warning', icon: 'school',             value: '7',      label: 'Teachers Assigned', trend: 'Fully staffed'},
    { colorClass: '',        icon: 'event_available',    value: 'Term 1', label: 'Current Term',      trend: '2026'         },
]

// "8:00", "08:00" → 480 (minutes since midnight). Lets us match times
// regardless of zero-padding differences between the API and PERIODS data.
function toMinutes(t) {
    const [h, m] = t.trim().split(':').map(Number)
    return h * 60 + m
}

function periodStartMinutes(period) {
    return toMinutes(period.time.split(/[–-]/)[0])
}

/* Convert backend slots array → { [classId]: { [day]: [9 items] } }
   matching each slot to a period row by start_time */
function slotsToSchedules(classId, slots, periods) {
    const dayMap = {}
    for (const slot of slots) {
        // Backend stores day lowercase (see handleSave's day.toLowerCase()), but the
        // Timetable component looks rows up by the capitalized names in DAYS — without
        // this normalization, fetched slots never render in the grid.
        const day = slot.day.charAt(0).toUpperCase() + slot.day.slice(1)
        if (!dayMap[day]) {
            dayMap[day] = Array(periods.length).fill(null)
        }
        // Compare by minutes-since-midnight, not string prefix — the API sends
        // zero-padded times ("08:00") while PERIODS uses unpadded ("8:00"), so
        // startsWith() would never match and slots would silently vanish.
        const idx = periods.findIndex(p => periodStartMinutes(p) === toMinutes(slot.start_time))
        if (idx !== -1) {
            dayMap[day][idx] = {
                _id:     slot.id,
                subject: slot.subject_name,
                teacher: slot.teacher_name,
                room:    slot.room,
                subjectId: slot.subject_id,
                teacherId: slot.teacher_id,
            }
        }
    }
    return { [classId]: dayMap }
}

export function DosTimetable() {
    const { notifications: liveNotifications, markRead } = useNotifications()
    const sessionUser = useSessionUser()
    const [classes, setClasses]           = useState([])
    const [classId, setClassId]           = useState('')
    const [schedules, setSchedules]       = useState({})
    const [loading, setLoading]           = useState(false)
    const [editingSlot, setEditingSlot]   = useState(null)
    const [showForm, setShowForm]         = useState(false)
    const [periods, setPeriods]           = useState(PERIODS)
    const [showPeriodManager, setShowPeriodManager] = useState(false)
    const [subjects, setSubjects] = useState([])
    const [teachers, setTeachers] = useState([])
    const [rooms, setRooms]       = useState([])
    const [conflict, setConflict] = useState(null)   // { formData, conflicts: [...] }

    // Load class list, subjects and rooms on mount
    useEffect(() => {
        getDosClasses().then(list => {
            setClasses(list)
            if (list.length > 0) setClassId(list[0].id)
        })
        getSubjects().then(data => setSubjects(data)).catch(err => console.error('subjects failed:', err))
        getDosRooms().then(data => setRooms(data)).catch(err => console.error('rooms failed:', err))
    }, [])

    const [refreshKey, setRefreshKey] = useState(0)

    function loadTimetable() {
        setRefreshKey(k => k + 1)
    }

    // Load timetable whenever selected class, periods, or refreshKey changes
    useEffect(() => {
        if (!classId) return
        let cancelled = false

        async function fetchTimetable() {
            setLoading(true)
            try {
                const data = await getDosTimetable(classId)
                if (!cancelled) setSchedules(slotsToSchedules(classId, data.slots, periods))
            } finally {
                if (!cancelled) setLoading(false)
            }
        }

        fetchTimetable()
        return () => { cancelled = true }
    }, [classId, periods, refreshKey])

    function handleEditCell(slotInfo) {
        setTeachers([])
        setEditingSlot(slotInfo)
        if (slotInfo?.cell?.subjectId && classId) {
            getDosTeachersBySubjectAndClass(slotInfo.cell.subjectId, classId)
                .then(data => setTeachers(data))
        }
        setShowForm(true)
    }

    async function handleSave(formData, { force = false } = {}) {
        const { day, slotId, room, subjectId, teacherId } = formData
        if (!day || !slotId) return

        const period = periods.find(p => String(p.id) === String(slotId))
        if (!period) return

        // Parse "8:00 – 8:40" → "08:00" and "08:40"
        const [startRaw, endRaw] = period.time.split('–').map(s => s.trim())
        const toHHMM = t => t.length === 4 ? '0' + t : t

        const payload = {
            class_id:   classId,
            subject_id: subjectId,
            teacher_id: teacherId || null,
            day:        day.toLowerCase(),
            start_time: toHHMM(startRaw),
            end_time:   toHHMM(endRaw),
            room:       room || '',
            ...(force ? { force: true } : {}),
        }

        const existingId = editingSlot?.cell?._id
        try {
            if (existingId) {
                await updateDosSlot(existingId, payload)
            } else {
                await saveDosSlot(payload)
            }
        } catch (err) {
            if (err?.response?.status === 409) {
                // Teacher or room double-booked — let the DOS decide
                setConflict({ formData, conflicts: err.response.data?.conflicts || [] })
                return
            }
            throw err
        }

        setConflict(null)
        setShowForm(false)
        setEditingSlot(null)
        loadTimetable()
    }

    async function handleDelete(slotInfo) {
        const id = slotInfo?.cell?._id
        if (!id) return
        await deleteDosSlot(id)
        setShowForm(false)
        setEditingSlot(null)
        loadTimetable()
    }
    function handleSubjectChange(subjectId){
        setTeachers([])
        if (!subjectId || !classId) return
        getDosTeachersBySubjectAndClass(subjectId,classId)
            .then(data => setTeachers(data))
            .catch(err => console.error('teachers-by-subject failed:', err))
    }

    const selectedClass = classes.find(c => c.id === classId)
    const classLabel = selectedClass
        ? `S${selectedClass.grade}${selectedClass.section}`
        : ''

    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={dosNavItems} secondaryItems={dosSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title="Academic Timetable"
                        subtitle="Create and manage weekly class timetables for all forms"
                        {...sessionUser}
                        notifications={liveNotifications}
                        onNotificationRead={markRead}
                    />
                    <DashboardContent>

                        <div className="portal-stat-grid mb-5">
                            {timetableStats.map((stat, i) => (
                                <StatCard key={i} {...stat} />
                            ))}
                        </div>

                        <div className="card">
                            <div className="card-header">
                                <h2 className="card-title">
                                    {classLabel ? `Class ${classLabel} — Weekly Timetable` : 'Weekly Timetable'}
                                </h2>
                                <div className="flex-row-gap">
                                    <div className="flex-row-gap">
                                        <label className="form-label mb-0">Class:</label>
                                        <Select
                                            value={classId}
                                            onChange={setClassId}
                                            placeholder="Select class"
                                            options={classes.map(c => ({
                                                value: c.id,
                                                label: `S${c.grade}${c.section}`,
                                            }))}
                                        />
                                    </div>
                                    <button
                                        className="btn btn-outline btn-sm"
                                        onClick={() => setShowPeriodManager(true)}
                                    >
                                        <span className="material-symbols-rounded icon-sm">schedule</span>
                                        Edit Periods
                                    </button>
                                    <button
                                        className="btn btn-primary btn-sm"
                                        onClick={() => { setEditingSlot(null); setShowForm(true) }}
                                    >
                                        <span className="material-symbols-rounded">add</span> Add Slot
                                    </button>
                                </div>
                            </div>
                            <div className="card-content">
                                {loading ? (
                                    <p style={{ color: 'var(--muted-foreground)', padding: '1rem' }}>Loading timetable…</p>
                                ) : (
                                    <Timetable
                                        type="academic"
                                        classId={classId}
                                        editable={true}
                                        onEditCell={handleEditCell}
                                        periods={periods}
                                        schedules={schedules}
                                    />
                                )}
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
                                onCancel={() => { setShowForm(false); setConflict(null) }}
                                periods={periods}
                                subjects={subjects}
                                teachers={teachers}
                                rooms={rooms}
                                onSubjectChange={handleSubjectChange}
                            />
                        )}

                        {conflict && (
                            <div className="modal-overlay" onClick={() => setConflict(null)}>
                                <div className="modal-box modal-box-sm" onClick={e => e.stopPropagation()}>
                                    <div className="modal-header">
                                        <div className="modal-header-left">
                                            <span className="material-symbols-rounded" style={{ color: 'var(--warning, #d97706)' }}>warning</span>
                                            <h2 className="modal-title">Scheduling Conflict</h2>
                                        </div>
                                        <button className="btn-icon-clean" onClick={() => setConflict(null)}>
                                            <span className="material-symbols-rounded">close</span>
                                        </button>
                                    </div>
                                    <div className="modal-body">
                                        <p style={{ fontSize: '0.875rem', marginBottom: '0.75rem' }}>
                                            This slot clashes with the existing timetable:
                                        </p>
                                        <ul style={{ margin: 0, paddingLeft: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                            {conflict.conflicts.map((c, i) => (
                                                <li key={i} style={{ fontSize: '0.84rem' }}>{c.message}</li>
                                            ))}
                                        </ul>
                                    </div>
                                    <div className="modal-footer">
                                        <button className="btn btn-secondary" onClick={() => setConflict(null)}>Go Back</button>
                                        <button className="btn btn-primary"
                                            onClick={() => handleSave(conflict.formData, { force: true })}>
                                            Save Anyway
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
