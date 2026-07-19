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
import { getDosClasses, getDosTimetable, saveDosSlot, updateDosSlot, deleteDosSlot, getSubjects, getDosTeachersBySubjectAndClass, getDosRooms, getTerms, generateDosTimetable, commitDosTimetable } from '../../api/dos'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/dos.css'
import { dosNavItems, dosSecondaryItems } from './dosNav'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { Modal } from '../../components/ui/Modal'
import { useToast } from '../../context/ToastContext'

const timetableStats = [
    { colorClass: 'info',    icon: 'calendar_view_week', value: '8',      label: 'Periods per Day',   trend: 'Mon - Sat'    },
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
    return toMinutes(period.time.split(/[–—-]/)[0])
}

/* Parse a period's "8:00 – 8:40" label into zero-padded start/end times. */
export function periodTimes(period) {
    const [startRaw, endRaw] = period.time.split(/[–—-]/).map(s => s.trim())
    const toHHMM = t => t.length === 4 ? '0' + t : t
    return { start_time: toHHMM(startRaw), end_time: toHHMM(endRaw) }
}

/* Build the PATCH payload to move a lesson cell to a target period + day,
   keeping its subject/teacher/room. Exported so the move logic is unit-tested
   without simulating the drag gesture. */
export function buildMovePayload(cell, targetPeriod, toDay) {
    const { start_time, end_time } = periodTimes(targetPeriod)
    return {
        day:         toDay.toLowerCase(),
        start_time,
        end_time,
        subject_id:  cell.subjectId,
        teacher_id:  cell.teacherId || null,
        room_number: cell.room || '',
    }
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

// Auto-scheduler modal: pick a term, preview the generated weekly plan, then
// commit it. Nothing is written until the DOS confirms the preview.
function TimetableGenerateModal({ onClose, onCommitted }) {
    const toast = useToast()
    const [terms,   setTerms]   = useState([])
    const [form,    setForm]    = useState({ term_id: '', replace: true })
    const [preview, setPreview] = useState(null)
    const [busy,    setBusy]    = useState(false)

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

    const canRun = form.term_id && !busy

    function update(field, value) {
        setForm(f => ({ ...f, [field]: value }))
        setPreview(null)   // any change invalidates the current preview
    }

    async function handlePreview() {
        setBusy(true)
        try {
            const plan = await generateDosTimetable(form)
            setPreview(plan)
            plan.warnings?.forEach(w => toast.info(w))
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Could not generate a timetable.')
        } finally {
            setBusy(false)
        }
    }

    async function handleCommit() {
        setBusy(true)
        try {
            const result = await commitDosTimetable(form)
            toast.success(`Saved ${result.created} lesson(s).`)
            onCommitted()
        } catch (err) {
            toast.error(err.response?.data?.detail || 'Could not save the timetable.')
        } finally {
            setBusy(false)
        }
    }

    return (
        <Modal
            title="Generate Timetable"
            icon="auto_awesome"
            onClose={onClose}
            size="wide"
            footer={
                <div className="modal-confirm-actions u-full">
                    <button className="btn btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
                    {preview
                        ? <button className="btn btn-primary" onClick={handleCommit}
                                  disabled={busy || preview.summary.scheduled === 0}>
                              Save {preview.summary.scheduled} lesson(s)
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
                <div className="form-group u-col-span-all">
                    <label className="u-flex u-gap-05 u-items-center">
                        <input type="checkbox" checked={form.replace}
                               onChange={e => update('replace', e.target.checked)} />
                        Replace existing timetable
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
                                <tr><th>Subject</th><th>Wt</th><th>Class</th><th>Day</th><th>Time</th><th>Teacher</th><th>Room</th></tr>
                            </thead>
                            <tbody>
                                {preview.assignments.map((a, i) => (
                                    <tr key={i}>
                                        <td>{a.subject_name}</td>
                                        <td className="u-muted">{a.weight ?? '-'}</td>
                                        <td>{a.class_name}</td>
                                        <td className="es-nowrap">{a.day}</td>
                                        <td className="es-nowrap">{a.start_time}-{a.end_time}</td>
                                        <td>{a.teacher_name || '-'}</td>
                                        <td>{a.room || '-'}</td>
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
    const [showGenerate, setShowGenerate] = useState(false)

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
        const [startRaw, endRaw] = period.time.split(/[–—-]/).map(s => s.trim())
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
                setConflict({
                    conflicts: err.response.data?.conflicts || [],
                    onForce: () => handleSave(formData, { force: true }),
                })
                return
            }
            throw err
        }

        setConflict(null)
        setShowForm(false)
        setEditingSlot(null)
        loadTimetable()
    }

    /* Drag-to-move: reposition an existing lesson to a new period + day.
       Reuses the same PATCH + teacher/room conflict flow as manual editing. */
    async function handleMoveSlot({ cell, toDay, toPeriodIndex }, { force = false } = {}) {
        if (!cell?._id) return
        const targetPeriod = periods[toPeriodIndex]
        if (!targetPeriod) return

        const payload = buildMovePayload(cell, targetPeriod, toDay)
        if (force) payload.force = true

        try {
            await updateDosSlot(cell._id, payload)
        } catch (err) {
            if (err?.response?.status === 409) {
                setConflict({
                    conflicts: err.response.data?.conflicts || [],
                    onForce: () => handleMoveSlot({ cell, toDay, toPeriodIndex }, { force: true }),
                })
                return
            }
            throw err
        }

        setConflict(null)
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
                        actions={
                            <button className="btn btn-secondary" onClick={() => setShowGenerate(true)}>
                                <span className="material-symbols-rounded">auto_awesome</span> Generate
                            </button>
                        }
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
                                    {classLabel ? `Class ${classLabel}: Weekly Timetable` : 'Weekly Timetable'}
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
                                    <p className="dos-tt-note">Loading timetable…</p>
                                ) : (
                                    <Timetable
                                        type="academic"
                                        classId={classId}
                                        editable={true}
                                        onEditCell={handleEditCell}
                                        periods={periods}
                                        schedules={schedules}
                                        onMoveSlot={handleMoveSlot}
                                    />
                                )}
                            </div>
                        </div>

                        {showGenerate && (
                            <TimetableGenerateModal
                                onClose={() => setShowGenerate(false)}
                                onCommitted={() => {
                                    setShowGenerate(false)
                                    loadTimetable()
                                }}
                            />
                        )}

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
                                            <span className="material-symbols-rounded dos-tt-warn-icon">warning</span>
                                            <h2 className="modal-title">Scheduling Conflict</h2>
                                        </div>
                                        <button className="btn-icon-clean" onClick={() => setConflict(null)}>
                                            <span className="material-symbols-rounded">close</span>
                                        </button>
                                    </div>
                                    <div className="modal-body">
                                        <p className="dos-tt-conflict-title">
                                            This slot clashes with the existing timetable:
                                        </p>
                                        <ul className="dos-tt-conflict-list">
                                            {conflict.conflicts.map((c, i) => (
                                                <li key={i} className="dos-tt-conflict-item">{c.message}</li>
                                            ))}
                                        </ul>
                                    </div>
                                    <div className="modal-footer">
                                        <button className="btn btn-secondary" onClick={() => setConflict(null)}>Go Back</button>
                                        <button className="btn btn-primary"
                                            onClick={() => conflict.onForce?.()}>
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
