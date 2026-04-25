import { useState } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { StatCard } from '../../components/layout/StatCard'
import { Timetable } from '../../components/timetable/Timetable'
import { TimetableEditForm } from '../../components/timetable/TimetableEditForm'
import { PeriodManager } from '../../components/timetable/PeriodManager'
import { EXTRA_SLOTS, extraSchedules } from '../../data/extraTimetable'
import { disNavItems, disSecondaryItems, disUser } from './disNav'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/discipline.css'
import { DashboardContent } from '../../components/layout/DashboardContent'

const timetableStats = [
    { colorClass: 'info',    icon: 'calendar_view_week', value: '18', label: 'Scheduled Slots',  trend: 'This week'    },
    { colorClass: 'success', icon: 'emoji_events',       value: '18', label: 'Active Clubs',      trend: 'All assigned' },
    { colorClass: 'warning', icon: 'supervisor_account', value: '18', label: 'Patron Teachers',   trend: 'Fully staffed'},
    { colorClass: '',        icon: 'location_on',        value: '12', label: 'Venues Allocated',  trend: 'No conflicts' },
]

export function DisTimetable() {
    const [editingSlot, setEditingSlot] = useState(null)
    const [showForm, setShowForm] = useState(false)
    const [slots, setSlots] = useState(EXTRA_SLOTS)
    const [showSlotManager, setShowSlotManager] = useState(false)
    // Live schedule state — initialized from static data, updated on save/delete
    const [schedules, setSchedules] = useState(extraSchedules)

    function handleEditCell(slotInfo) {
        setEditingSlot(slotInfo)
        setShowForm(true)
    }

    function handleSave(formData) {
        const { day, slotId, subject, teacher, room, cellType } = formData
        if (!day || !slotId) return

        setSchedules(prev => {
            const weekData = { ...(prev['default'] || {}) }
            const slotData = { ...(weekData[slotId] || {}) }
            /* Empty subject clears the cell to an explicit empty type */
            slotData[day] = subject
                ? { type: cellType, subject, teacher, room }
                : { type: 'empty', label: '—' }
            weekData[slotId] = slotData
            return { ...prev, default: weekData }
        })
        setShowForm(false)
        setEditingSlot(null)
    }

    function handleDelete(slotInfo) {
        const { slot, day } = slotInfo
        if (!slot || !day) return

        setSchedules(prev => {
            const weekData = { ...(prev['default'] || {}) }
            const slotData = { ...(weekData[slot.id] || {}) }
            slotData[day] = null
            weekData[slot.id] = slotData
            return { ...prev, default: weekData }
        })
        setShowForm(false)
        setEditingSlot(null)
    }

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
                        {...disUser}
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
                                <Timetable
                                    type="extracurricular"
                                    editable={true}
                                    onEditCell={handleEditCell}
                                    slots={slots}
                                    schedules={schedules}
                                />
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
