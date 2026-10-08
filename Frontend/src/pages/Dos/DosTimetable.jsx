import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { StatCard } from '../../components/layout/StatCard'
import { Timetable } from '../../components/timetable/Timetable'
import { TimetableEditForm } from '../../components/timetable/TimetableEditForm'
import { PeriodManager } from '../../components/timetable/PeriodManager'
import { ClassPicker } from '../../components/ui/ClassPicker'
import { PERIODS } from '../../data/academicTimetable'
import { DAYS } from '../../data/extraTimetable'
import {
    getDosClasses, getDosTimetable, saveDosSlot, updateDosSlot, deleteDosSlot, getSubjects,
    getDosTeachersBySubjectAndClass, getDosRooms, getTerms, generateDosTimetable, commitDosTimetable,
    getTimetablePeriods, saveTimetablePeriods,
} from '../../api/dos'
import { toList } from '../../api/client'
import { useSchoolConfig } from '../../hooks/useSchoolConfig'
import '../../styles/components.css'
import '../../styles/dos.css'
import { Modal } from '../../components/ui/Modal'
import { classLabel as formatClass, sectionsFromClasses } from '../../utils/classes'
import { useToast } from '../../context/ToastContext'
import { errorMessage } from '../../utils/errors'

/* Monday to Saturday: the days the academic grid draws. */
const ACADEMIC_DAYS = DAYS.slice(0, 6)

/* The sample school day, used only when a school has no bell schedule and no lessons yet. */
const SAMPLE_PERIODS = PERIODS.map(p => ({ ...p, isBreak: p.id === 'break' }))

// "8:00", "08:00" → 480 (minutes since midnight). Lets us match times
// regardless of zero-padding differences between the API and period labels.
function toMinutes(t) {
    const [h, m] = String(t).trim().split(':').map(Number)
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

/* The bell schedule from the API → the grid's rows. The id is the start time,
   so a period keeps its identity when the DOS relabels it. */
export function periodsFromApi(rows = []) {
    return rows.map(r => ({
        id:      r.start_time,
        label:   r.label || '',
        time:    `${r.start_time} - ${r.end_time}`,
        isBreak: Boolean(r.is_break),
    }))
}

/* The grid's rows → the API body, or `{ error }` naming the first bad row. */
export function periodsToApi(periods) {
    const rows = []
    for (const p of periods) {
        const match = /^\s*(\d{1,2}:\d{2})\s*[–—-]\s*(\d{1,2}:\d{2})\s*$/.exec(p.time || '')
        if (!match) return { error: p.label || p.time || '?' }
        const { start_time, end_time } = periodTimes({ time: `${match[1]} - ${match[2]}` })
        if (toMinutes(end_time) <= toMinutes(start_time)) return { error: p.label || p.time }
        rows.push({ label: p.label || '', start_time, end_time, is_break: Boolean(p.isBreak) })
    }
    return { rows }
}

/* Convert backend slots → { [classId]: { [day]: [one cell per period] } },
   matching each slot to a period row by start time. Break rows are filled on
   every day so the grid draws them as one band. */
export function slotsToSchedules(classId, slots, periods) {
    const dayMap = {}
    for (const day of ACADEMIC_DAYS) {
        dayMap[day] = periods.map(p => (p.isBreak ? { type: 'break', subject: p.label || 'Break' } : null))
    }
    for (const slot of slots) {
        // Backend stores day lowercase; the grid keys rows by capitalised names.
        const day = slot.day.charAt(0).toUpperCase() + slot.day.slice(1)
        if (!dayMap[day]) continue
        // Compare by minutes-since-midnight, not string prefix: "08:00" vs "8:00".
        const idx = periods.findIndex(p => !p.isBreak && periodStartMinutes(p) === toMinutes(slot.start_time))
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
    const { t } = useTranslation()
    const toast = useToast()
    const [terms,   setTerms]   = useState([])
    const [form,    setForm]    = useState({ term_id: '', replace: true })
    const [preview, setPreview] = useState(null)
    const [busy,    setBusy]    = useState(false)

    useEffect(() => {
        getTerms()
            .then(data => {
                const list = toList(data)
                setTerms(list)
                const current = list.find(term => term.is_current) || list[0]
                if (current) setForm(f => ({ ...f, term_id: String(current.id) }))
            })
            .catch(() => toast.error(t('dos.timetable.loadTermsFailed')))
    }, [toast, t])

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
            toast.error(errorMessage(err, t('dos.timetable.generateFailed')))
        } finally {
            setBusy(false)
        }
    }

    async function handleCommit() {
        setBusy(true)
        try {
            const result = await commitDosTimetable(form)
            toast.success(t('dos.timetable.savedLessons', { count: result.created }))
            onCommitted()
        } catch (err) {
            toast.error(errorMessage(err, t('dos.timetable.saveFailed')))
        } finally {
            setBusy(false)
        }
    }

    return (
        <Modal
            title={t('dos.timetable.generateTitle')}
            icon="auto_awesome"
            onClose={onClose}
            size="wide"
            footer={
                <div className="modal-confirm-actions u-full">
                    <button className="btn btn-outline" onClick={onClose} disabled={busy}>{t('common.cancel')}</button>
                    {preview
                        ? <button className="btn btn-primary" onClick={handleCommit}
                                  disabled={busy || preview.summary.scheduled === 0}>
                              {t('dos.timetable.saveLessons', { count: preview.summary.scheduled })}
                          </button>
                        : <button className="btn btn-primary" onClick={handlePreview} disabled={!canRun}>
                              {busy ? t('dos.timetable.generating') : t('common.preview')}
                          </button>}
                </div>
            }
        >
            <div className="u-grid u-grid-2 u-gap-1">
                <div className="form-group">
                    <label className="form-label">{t('dos.timetable.academicTerm')}</label>
                    <select className="form-select" value={form.term_id}
                            onChange={e => update('term_id', e.target.value)}>
                        <option value="">{t('common.selectTerm')}</option>
                        {terms.map(term => (
                            <option key={term.id} value={term.id}>{term.name} ({term.year})</option>
                        ))}
                    </select>
                </div>
                <div className="form-group u-col-span-all">
                    <label className="u-flex u-gap-05 u-items-center">
                        <input type="checkbox" checked={form.replace}
                               onChange={e => update('replace', e.target.checked)} />
                        {t('dos.timetable.replaceExisting')}
                    </label>
                </div>
            </div>

            {preview && (
                <div className="mt-1-5">
                    <div className="es-gen-summary">
                        <span className="badge badge-published">{t('dos.timetable.scheduledCount', { count: preview.summary.scheduled })}</span>
                        {preview.summary.unscheduled > 0 &&
                            <span className="badge badge-draft">{t('dos.timetable.unplacedCount', { count: preview.summary.unscheduled })}</span>}
                        <span className="u-muted u-sm">
                            {t('dos.timetable.slotsVenues', { slots: preview.summary.slots_available, venues: preview.summary.venues })}
                        </span>
                    </div>
                    <div className="data-table-wrap mt-1">
                        <table className="data-table">
                            <thead>
                                <tr><th>{t('common.subject')}</th><th>{t('dos.timetable.weightAbbr')}</th><th>{t('common.class')}</th><th>{t('common.day')}</th><th>{t('common.time')}</th><th>{t('common.teacher')}</th><th>{t('common.room')}</th></tr>
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

/**
 * The class timetable editor, shown on the DOS Scheduling page.
 *
 * Rows are the school's bell schedule (saved periods, or the times its lessons
 * already use); lessons are read from and written to the timetable API. The
 * Scheduling page used to show the static sample timetable here, edited in
 * memory and lost on reload, while this editor sat on a page nothing linked to.
 */
export function DosTimetablePanel() {
    const { t } = useTranslation()
    const toast = useToast()
    const { config } = useSchoolConfig()
    const [classes, setClasses]           = useState([])
    const [section, setSection]           = useState('')
    const [year, setYear]                 = useState('')
    const [stream, setStream]             = useState('')
    const [schedules, setSchedules]       = useState({})
    const [loading, setLoading]           = useState(false)
    const [editingSlot, setEditingSlot]   = useState(null)
    const [showForm, setShowForm]         = useState(false)
    const [periods, setPeriods]           = useState(null)
    const [periodSource, setPeriodSource] = useState('school')
    const [draftPeriods, setDraftPeriods] = useState(null)
    const [subjects, setSubjects] = useState([])
    const [teachers, setTeachers] = useState([])
    const [rooms, setRooms]       = useState([])
    const [conflict, setConflict] = useState(null)   // { conflicts: [...], onForce }
    const [showGenerate, setShowGenerate] = useState(false)
    const [currentTerm, setCurrentTerm] = useState(null)
    const [refreshKey, setRefreshKey] = useState(0)

    const fail = useCallback((err, fallback) => toast.error(errorMessage(err, fallback)), [toast])

    useEffect(() => {
        getDosClasses()
            .then(data => {
                const list = toList(data)
                setClasses(list)
                if (list.length > 0) { setYear(list[0].grade); setStream(list[0].section) }
            })
            .catch(err => fail(err, t('dos.timetable.loadFailed')))
        getSubjects().then(data => setSubjects(toList(data))).catch(err => fail(err, t('dos.timetable.loadFailed')))
        getDosRooms().then(data => setRooms(toList(data))).catch(err => fail(err, t('dos.timetable.loadFailed')))
        getTerms()
            .then(data => setCurrentTerm(toList(data).find(term => term.is_current) || null))
            .catch(err => fail(err, t('dos.timetable.loadTermsFailed')))
        getTimetablePeriods()
            .then(data => {
                const rows = periodsFromApi(data?.periods)
                setPeriodSource(data?.source || 'none')
                setPeriods(rows.length ? rows : SAMPLE_PERIODS)
            })
            .catch(err => {
                setPeriodSource('none')
                setPeriods(SAMPLE_PERIODS)
                fail(err, t('dos.timetable.loadFailed'))
            })
    }, [fail, t])

    const selectedClass = classes.find(c => c.grade === year && c.section === stream) || null
    const classId = selectedClass?.id || ''

    const loadTimetable = () => setRefreshKey(k => k + 1)

    useEffect(() => {
        if (!classId || !periods) return
        let cancelled = false
        setLoading(true)
        getDosTimetable(classId)
            .then(data => { if (!cancelled) setSchedules(slotsToSchedules(classId, data?.slots || [], periods)) })
            .catch(err => { if (!cancelled) fail(err, t('dos.timetable.loadFailed')) })
            .finally(() => { if (!cancelled) setLoading(false) })
        return () => { cancelled = true }
    }, [classId, periods, refreshKey, fail, t])

    function handleEditCell(slotInfo) {
        setTeachers([])
        setEditingSlot(slotInfo)
        if (slotInfo?.cell?.subjectId && classId) {
            getDosTeachersBySubjectAndClass(slotInfo.cell.subjectId, classId)
                .then(data => setTeachers(toList(data)))
                .catch(err => fail(err, t('dos.timetable.loadFailed')))
        }
        setShowForm(true)
    }

    async function handleSave(formData, { force = false } = {}) {
        const { day, slotId, room, subjectId, teacherId } = formData
        if (!day || !slotId || !classId) return

        const period = periods.find(p => String(p.id) === String(slotId))
        if (!period) return
        const { start_time, end_time } = periodTimes(period)

        const payload = {
            class_id:   classId,
            subject_id: subjectId,
            teacher_id: teacherId || null,
            day:        day.toLowerCase(),
            start_time,
            end_time,
            room:       room || '',
            ...(force ? { force: true } : {}),
        }

        const existingId = editingSlot?.cell?._id
        try {
            if (existingId) await updateDosSlot(existingId, payload)
            else            await saveDosSlot(payload)
        } catch (err) {
            if (err?.response?.status === 409) {
                // Teacher or room double-booked: let the DOS decide
                setConflict({
                    conflicts: err.response.data?.conflicts || [],
                    onForce: () => handleSave(formData, { force: true }),
                })
                return
            }
            fail(err, t('dos.timetable.saveFailed'))
            return
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
        if (!targetPeriod || targetPeriod.isBreak) return

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
            fail(err, t('dos.timetable.saveFailed'))
            return
        }

        setConflict(null)
        loadTimetable()
    }

    async function handleDelete(slotInfo) {
        const id = slotInfo?.cell?._id
        if (!id) return
        try {
            await deleteDosSlot(id)
        } catch (err) {
            fail(err, t('dos.timetable.saveFailed'))
            return
        }
        setShowForm(false)
        setEditingSlot(null)
        loadTimetable()
    }

    function handleSubjectChange(subjectId) {
        setTeachers([])
        if (!subjectId || !classId) return
        getDosTeachersBySubjectAndClass(subjectId, classId)
            .then(data => setTeachers(toList(data)))
            .catch(err => fail(err, t('dos.timetable.loadFailed')))
    }

    /* Period edits are a draft saved when the editor closes, so a half-typed
       time never reaches the grid or the server. */
    async function closePeriodManager() {
        const draft = draftPeriods
        if (!draft || draft === periods) { setDraftPeriods(null); return }
        const { rows, error } = periodsToApi(draft)
        if (error) {
            toast.error(t('dos.timetable.periodInvalid', { name: error }))
            return
        }
        try {
            const saved = await saveTimetablePeriods(rows)
            setPeriods(periodsFromApi(saved.periods))
            setPeriodSource('school')
            setDraftPeriods(null)
            toast.success(t('dos.timetable.periodsSaved'))
        } catch (err) {
            fail(err, t('dos.timetable.periodsSaveFailed'))
        }
    }

    const classLabel = selectedClass ? formatClass(selectedClass.grade, selectedClass.section) : ''
    const lessonPeriods = (periods || []).filter(p => !p.isBreak)
    const classTeachers = new Set(
        Object.values(schedules[classId] || {})
            .flat()
            .filter(cell => cell && cell.teacher)
            .map(cell => cell.teacher))

    const timetableStats = [
        { colorClass: 'info',    icon: 'calendar_view_week', value: String(lessonPeriods.length),
          label: t('dos.scheduling.periodsPerDay'),    trend: t('dos.scheduling.dayRange')   },
        { colorClass: 'success', icon: 'menu_book',          value: String(subjects.length),
          label: t('common.subjects'),                 trend: t('dos.scheduling.allClasses') },
        { colorClass: 'warning', icon: 'school',             value: String(classTeachers.size),
          label: t('dos.scheduling.teachersAssigned'), trend: t('dos.timetable.inThisClass') },
        { colorClass: '',        icon: 'event_available',    value: currentTerm?.name || t('dos.scheduling.notSet'),
          label: t('dos.scheduling.currentTerm'),      trend: currentTerm ? String(currentTerm.year) : '' },
    ]

    return (
        <div className="page-stack">
            <div className="portal-stat-grid">
                {timetableStats.map((stat, i) => <StatCard key={i} {...stat} />)}
            </div>

            <ClassPicker
                sections={sectionsFromClasses(classes, config)}
                section={section} onSectionChange={setSection}
                year={year}       onYearChange={setYear}
                classVal={stream} onClassChange={setStream}
            />

            {periodSource !== 'school' && periods && (
                <div className="tt-notice">
                    <span className="material-symbols-rounded" aria-hidden="true">info</span>
                    <div>{t(periodSource === 'lessons' ? 'dos.timetable.periodsFromLessons' : 'dos.timetable.periodsNotSet')}</div>
                </div>
            )}

            <div className="card">
                <div className="card-header">
                    <h2 className="card-title">
                        {classLabel ? t('dos.timetable.weeklyFor', { name: classLabel }) : t('dos.timetable.weekly')}
                    </h2>
                    <div className="flex-row-gap">
                        <button className="btn btn-outline btn-sm" onClick={() => setDraftPeriods(periods)} disabled={!periods}>
                            <span className="material-symbols-rounded icon-sm" aria-hidden="true">schedule</span>
                            {t('dos.scheduling.editPeriods')}
                        </button>
                        <button className="btn btn-outline btn-sm" onClick={() => setShowGenerate(true)}>
                            <span className="material-symbols-rounded icon-sm" aria-hidden="true">auto_awesome</span> {t('common.generate')}
                        </button>
                        <button className="btn btn-primary btn-sm" disabled={!classId}
                                onClick={() => { setEditingSlot(null); setShowForm(true) }}>
                            <span className="material-symbols-rounded" aria-hidden="true">add</span> {t('dos.scheduling.addSlot')}
                        </button>
                    </div>
                </div>
                <div className="card-content">
                    {!classId ? (
                        <p className="dos-tt-note">{t('dos.timetable.chooseClass')}</p>
                    ) : loading || !periods ? (
                        <p className="dos-tt-note">{t('dos.timetable.loadingTimetable')}</p>
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
                    onCommitted={() => { setShowGenerate(false); loadTimetable() }}
                />
            )}

            {draftPeriods && (
                <PeriodManager
                    periods={draftPeriods}
                    onChange={setDraftPeriods}
                    onClose={closePeriodManager}
                />
            )}

            {showForm && (
                <TimetableEditForm
                    type="academic"
                    editingSlot={editingSlot}
                    onSave={handleSave}
                    onDelete={handleDelete}
                    onCancel={() => { setShowForm(false); setConflict(null) }}
                    periods={lessonPeriods}
                    subjects={subjects}
                    teachers={teachers}
                    rooms={rooms}
                    onSubjectChange={handleSubjectChange}
                />
            )}

            {conflict && (
                <Modal
                    title={t('dos.timetable.conflictTitle')}
                    icon="warning"
                    onClose={() => setConflict(null)}
                    footer={
                        <>
                            <button className="btn btn-secondary" onClick={() => setConflict(null)}>{t('common.goBack')}</button>
                            <button className="btn btn-primary" onClick={() => conflict.onForce?.()}>{t('dos.timetable.saveAnyway')}</button>
                        </>
                    }
                >
                    <p className="dos-tt-conflict-title">{t('dos.timetable.conflictBody')}</p>
                    <ul className="dos-tt-conflict-list">
                        {conflict.conflicts.map((c, i) => (
                            <li key={i} className="dos-tt-conflict-item">{c.message}</li>
                        ))}
                    </ul>
                </Modal>
            )}
        </div>
    )
}
