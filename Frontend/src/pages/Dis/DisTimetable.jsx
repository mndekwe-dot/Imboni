import { useState, useEffect, useRef } from 'react'
import { getISOWeek, getISOWeekYear } from 'date-fns'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useNotifications } from '../../hooks/useNotifications'
import { useSessionUser } from '../../hooks/useSessionUser'
import { StatCard } from '../../components/layout/StatCard'
import { Timetable } from '../../components/timetable/Timetable'
import { TimetableEditForm } from '../../components/timetable/TimetableEditForm'
import { PeriodManager } from '../../components/timetable/PeriodManager'
import { EXTRA_SLOTS } from '../../data/extraTimetable'
import { getThisMonday } from '../../components/timetable/dateUtils'
import {
    getDisExtracurricular, createDisExtracurricular,
    patchDisExtracurricular, deleteDisExtracurricular,
} from '../../api/discipline'
import { disNavItems, disSecondaryItems } from './disNav'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/discipline.css'
import { DashboardContent } from '../../components/layout/DashboardContent'

// ── Helpers ───────────────────────────────────────────────────────────────────

// Converts a Monday Date object → ISO week string like "2026-W23"
function toWeekKey(monday) {
    return `${getISOWeekYear(monday)}-W${String(getISOWeek(monday)).padStart(2, '0')}`
}

function entriesToSchedules(entries, weekKey) {
    const result = { [weekKey]: {} }
    entries.forEach(e => {
        const week = e.week || weekKey
        if (!result[week]) result[week] = {}
        if (!result[week][e.slot_id]) result[week][e.slot_id] = {}
        result[week][e.slot_id][e.day] = e.activity_type === 'empty'
            ? { type: 'empty', label: e.label || '—' }
            : { type: e.activity_type, subject: e.subject, teacher: e.teacher, room: e.room }
    })
    return result
}

function buildIdMap(entries, weekKey) {
    const map = {}
    entries.forEach(e => { map[`${e.week || weekKey}__${e.slot_id}__${e.day}`] = e.id })
    return map
}

const GENERIC_STAFF = new Set(['Duty Staff', 'All Matrons', 'House Staff', 'All Dormitory Staff'])

function computeStats(entries) {
    const nonEmpty = entries.filter(e => e.activity_type !== 'empty')
    const clubs    = new Set(
        nonEmpty.filter(e => !['boarding', 'dining'].includes(e.activity_type) && e.subject)
                .map(e => e.subject)
    )
    const patrons  = new Set(
        nonEmpty.filter(e => e.teacher && !GENERIC_STAFF.has(e.teacher))
                .map(e => e.teacher)
    )
    const venues = new Set(nonEmpty.filter(e => e.room).map(e => e.room))
    return { scheduled: nonEmpty.length, clubs: clubs.size, patrons: patrons.size, venues: venues.size }
}

function applyEntries(entries, weekKey, setEntries, setSchedules, setIdMap, setStats) {
    setEntries(entries)
    setSchedules(entriesToSchedules(entries, weekKey))
    setIdMap(buildIdMap(entries, weekKey))
    setStats(computeStats(entries))
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DisTimetable() {
    const { notifications: liveNotifications, markRead } = useNotifications()
    const sessionUser = useSessionUser()
    const [editingSlot,     setEditingSlot]     = useState(null)
    const [showForm,        setShowForm]        = useState(false)
    const [slots,           setSlots]           = useState(EXTRA_SLOTS)
    const [showSlotManager, setShowSlotManager] = useState(false)
    const [entries,         setEntries]         = useState([])
    const [schedules,       setSchedules]       = useState(null)
    const [idMap,           setIdMap]           = useState({})
    const [stats,           setStats]           = useState(null)
    const [loading,  setLoading]  = useState(true)   // initial load only
    const [fetching, setFetching] = useState(false)  // subsequent week changes
    const firstLoad = useRef(true)

    // Track the calendar week in DisTimetable so we can keep Timetable mounted
    // while re-fetching — otherwise WeekPicker resets to today on every navigate.
    const [currentMonday, setCurrentMonday] = useState(() => getThisMonday())
    const activeWeek = toWeekKey(currentMonday)

    useEffect(() => {
        if (firstLoad.current) { setLoading(true) }
        else { setFetching(true); setSchedules(null) }
        getDisExtracurricular(activeWeek)
            .then(data => applyEntries(data, activeWeek, setEntries, setSchedules, setIdMap, setStats))
            .catch(console.error)
            .finally(() => {
                setLoading(false)
                setFetching(false)
                firstLoad.current = false
            })
    }, [activeWeek])

    async function handleSave(formData) {
        const { day, slotId, subject, teacher, room, cellType } = formData
        if (!day || !slotId) return

        const key     = `${activeWeek}__${slotId}__${day}`
        const existId = idMap[key]
        const payload = {
            week:          activeWeek,
            slot_id:       slotId,
            day,
            activity_type: subject ? cellType : 'empty',
            subject:       subject || '',
            teacher:       teacher || '',
            room:          room    || '',
            label:         subject ? '' : '—',
        }

        try {
            let saved
            if (existId) {
                saved = await patchDisExtracurricular(existId, payload)
            } else {
                saved = await createDisExtracurricular(payload)
            }
            const next = [...entries]
            const idx  = next.findIndex(e => e.slot_id === slotId && e.day === day && e.week === activeWeek)
            if (idx >= 0) next[idx] = saved
            else next.push(saved)
            applyEntries(next, activeWeek, setEntries, setSchedules, setIdMap, setStats)
        } catch (e) {
            console.error(e)
        }

        setShowForm(false)
        setEditingSlot(null)
    }

    async function handleDelete(slotInfo) {
        const { slot, day } = slotInfo
        if (!slot || !day) return

        const key     = `${activeWeek}__${slot.id}__${day}`
        const existId = idMap[key]

        try {
            if (existId) await deleteDisExtracurricular(existId)
            const next = entries.filter(
                e => !(e.slot_id === slot.id && e.day === day && e.week === activeWeek)
            )
            applyEntries(next, activeWeek, setEntries, setSchedules, setIdMap, setStats)
        } catch (e) {
            console.error(e)
        }

        setShowForm(false)
        setEditingSlot(null)
    }

    const timetableStats = [
        { colorClass: 'info',    icon: 'calendar_view_week', value: stats ? stats.scheduled : '—', label: 'Scheduled Slots', trend: activeWeek      },
        { colorClass: 'success', icon: 'emoji_events',       value: stats ? stats.clubs     : '—', label: 'Active Clubs',     trend: 'All assigned' },
        { colorClass: 'warning', icon: 'supervisor_account', value: stats ? stats.patrons   : '—', label: 'Patron Teachers',  trend: 'Fully staffed'},
        { colorClass: '',        icon: 'location_on',        value: stats ? stats.venues    : '—', label: 'Venues Allocated', trend: 'No conflicts' },
    ]

    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={disNavItems} secondaryItems={disSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title="Extracurricular Timetable"
                        subtitle="Plan, create, and update the weekly non-academic activity schedule"
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
                                <h2 className="card-title">Weekly Extracurricular Schedule</h2>
                                <div className="flex-row-gap">
                                    <button
                                        className="btn btn-outline btn-sm"
                                        onClick={() => setShowSlotManager(true)}
                                    >
                                        <span className="material-symbols-rounded icon-sm">schedule</span>
                                        Edit Time Slots
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
                                    <p className="u-pad u-muted">Loading schedule…</p>
                                ) : (
                                    <div className="u-relative">
                                        {fetching && (
                                            <div className="dis-fetch-overlay">
                                                <span className="dis-fetch-overlay-label">
                                                    Loading {activeWeek}…
                                                </span>
                                            </div>
                                        )}
                                        <Timetable
                                            type="extracurricular"
                                            editable={!fetching}
                                            onEditCell={cell => { setEditingSlot(cell); setShowForm(true) }}
                                            slots={slots}
                                            schedules={schedules}
                                            weekKey={activeWeek}
                                            currentMonday={currentMonday}
                                            onWeekChange={setCurrentMonday}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        {showSlotManager && (
                            <PeriodManager
                                periods={slots}
                                onChange={setSlots}
                                onClose={() => setShowSlotManager(false)}
                            />
                        )}

                        {showForm && (
                            <TimetableEditForm
                                type="extracurricular"
                                editingSlot={editingSlot}
                                onSave={handleSave}
                                onDelete={handleDelete}
                                onCancel={() => setShowForm(false)}
                                slots={slots}
                            />
                        )}

                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
