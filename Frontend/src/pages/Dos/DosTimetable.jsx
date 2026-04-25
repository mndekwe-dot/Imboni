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
import { DashboardContent } from '../../components/layout/DashboardContent'


const ALL_CLASSES = ['S1A', 'S1B', 'S2A', 'S2B', 'S3A', 'S3B', 'S4A', 'S4B', 'S5A', 'S5B', 'S6A', 'S6B']

const timetableStats = [
    { colorClass: 'info',    icon: 'calendar_view_week', value: '8',      label: 'Periods per Day',   trend: 'Mon – Sat'    },
    { colorClass: 'success', icon: 'menu_book',          value: '9',      label: 'Subjects',          trend: 'All classes'  },
    { colorClass: 'warning', icon: 'school',             value: '7',      label: 'Teachers Assigned', trend: 'Fully staffed'},
    { colorClass: '',        icon: 'event_available',    value: 'Term 1', label: 'Current Term',      trend: '2026'         },
]

export function DosTimetable() {
    const [classId, setClassId] = useState('S3A')
    const [editingSlot, setEditingSlot] = useState(null)
    const [showForm, setShowForm] = useState(false)
    const [periods, setPeriods] = useState(PERIODS)
    const [showPeriodManager, setShowPeriodManager] = useState(false)
    // Live schedule state — initialized from static data, updated on save/delete
    const [schedules, setSchedules] = useState(academicSchedules)

    function handleEditCell(slotInfo) {
        setEditingSlot(slotInfo)
        setShowForm(true)
    }

    function handleSave(formData) {
        const { day, slotId, subject, teacher, room } = formData
        if (!day || !slotId) return

        /* Find which array index this period sits at */
        const periodIndex = periods.findIndex(p => String(p.id) === String(slotId))
        if (periodIndex === -1) return

        setSchedules(prev => {
            const classData = { ...(prev[classId] || {}) }
            /* Copy the day array so we don't mutate the original */
            const dayArray  = [...(classData[day] || Array(periods.length).fill(null))]
            dayArray[periodIndex] = subject
                ? {
                    subject,
                    teacher,
                    room,
                    /* Preserve teacherId if editing an existing cell */
                    teacherId: editingSlot?.cell?.teacherId || '',
                  }
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
                        title="Academic Timetable"
                        subtitle="Create and manage weekly class timetables for all forms"
                        name="Dr. Jean-Claude Ndagijimana"
                        role="Director of Studies"
                        initials="JN"
                        avatarClass="dos-av"
                    />
                    <DashboardContent>

                        <div className="portal-stat-grid" style={{ marginBottom: '1.25rem' }}>
                            {timetableStats.map((stat, i) => (
                                <StatCard key={i} {...stat} />
                            ))}
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
                                            {ALL_CLASSES.map(c => (
                                                <option key={c} value={c}>{c}</option>
                                            ))}
                                        </select>
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

                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
