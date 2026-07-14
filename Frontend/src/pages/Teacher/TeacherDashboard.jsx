import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useNotifications } from '../../hooks/useNotifications'
import { WelcomeBanner } from '../../components/layout/WelcomeBanner'
import { StatCard } from '../../components/layout/StatCard'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { teacherNavItems, teacherSecondaryItems } from './teacherNav'
import {
    getTeacherDashboardStats,
    getTeacherTodaySchedule,
    getTeacherTasks,
    createTeacherTask,
    getTeacherClassPerformance,
    getTeacherRecentActivities,
} from '../../api/teacher'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/teacher.css'

function barColor(v) {
    if (v >= 80) return '#10b981'
    if (v >= 70) return '#003d7a'
    return '#f59e0b'
}

function relTime(ts) {
    if (!ts) return ''
    const d = Math.floor((Date.now() - new Date(ts)) / 1000)
    if (d < 60)    return 'Just now'
    if (d < 3600)  return `${Math.floor(d / 60)} min ago`
    if (d < 86400) return `${Math.floor(d / 3600)} hours ago`
    return `${Math.floor(d / 86400)} days ago`
}

function ScheduleCard({ time, room, className, subject, status, statusClass, cardClass, showMark, onMark, onClick }) {
    return (
        <div className={`schedule-card ${cardClass} cursor-ptr`} onClick={onClick}>
            <div className="schedule-info">
                <div className="schedule-time">
                    <div className="schedule-time-main">{time}</div>
                    <div className="schedule-time-sub">{room}</div>
                </div>
                <div className="schedule-divider"></div>
                <div>
                    <div className="schedule-class-name">{className}</div>
                    <div className="schedule-class-subject">{subject}</div>
                </div>
            </div>
            {showMark && (
                <button
                    className="btn-mark-attendance btn btn-primary btn-sm"
                    onClick={e => { e.stopPropagation(); onMark() }}
                >
                    Mark Attendance
                </button>
            )}
            <span className={`badge ${statusClass}`}>{status}</span>
        </div>
    )
}

function TaskCard({ title, deadline, priority }) {
    const cls = priority === 'high' ? 'badge-high' : priority === 'medium' ? 'badge-medium' : 'badge-low'
    return (
        <div className="task-card">
            <div className={`task-priority-dot ${priority}`}></div>
            <div className="task-content">
                <div className="task-title">{title}</div>
                {deadline && <div className="task-deadline">{deadline}</div>}
            </div>
            <span className={`badge ${cls}`}>{priority}</span>
        </div>
    )
}

function CustomTooltip({ active, payload }) {
    if (!active || !payload?.length) return null
    const d = payload[0].payload
    return (
        <div className="chart-tooltip">
            <div className="chart-tooltip-label">{d.class_name}</div>
            <div style={{ color: barColor(d.average_score) }}>{d.average_score}% average</div>
        </div>
    )
}

function ActivityItem({ iconClass, icon, text, time }) {
    return (
        <div className="activity-item">
            <div className={`activity-icon ${iconClass}`}>
                <span className="material-symbols-rounded icon-md">{icon}</span>
            </div>
            <div className="activity-content">
                <div className="activity-text">{text}</div>
                <div className="activity-time">
                    <span className="material-symbols-rounded icon-sm">schedule</span>
                    {time}
                </div>
            </div>
        </div>
    )
}

const ACTIVITY_ICONS = {
    result:     { iconClass: 'result',     icon: 'assignment_turned_in' },
    attendance: { iconClass: 'attendance', icon: 'check_circle'         },
    incident:   { iconClass: 'incident',   icon: 'report_problem'       },
}

function slotMeta(status) {
    if (status === 'completed')   return { label: 'Completed',   cls: 'badge-completed', cardCls: 'completed', showMark: false }
    if (status === 'in_progress') return { label: 'In Progress', cls: 'badge-primary',   cardCls: 'current',   showMark: true  }
    return                               { label: 'Upcoming',    cls: 'badge-secondary', cardCls: 'upcoming',  showMark: false }
}

// ── Create Task Modal ─────────────────────────────────────────────────────────
function CreateTaskModal({ onClose, onCreated }) {
    const [title,    setTitle]    = useState('')
    const [priority, setPriority] = useState('medium')
    const [dueDate,  setDueDate]  = useState('')
    const [saving,   setSaving]   = useState(false)
    const [error,    setError]    = useState(null)

    useEffect(() => {
        document.body.style.overflow = 'hidden'
        return () => { document.body.style.overflow = '' }
    }, [])

    async function handleSave() {
        if (!title.trim()) { setError('Title is required.'); return }
        setSaving(true); setError(null)
        try {
            const task = await createTeacherTask({
                title: title.trim(),
                priority,
                due_date: dueDate || null,
            })
            onCreated(task)
            onClose()
        } catch (e) {
            setError(e?.message || 'Failed to save task.')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box modal-box-sm" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="modal-header-left">
                        <span className="material-symbols-rounded text-primary">task_alt</span>
                        <h2 className="modal-title">New Task</h2>
                    </div>
                    <button className="btn-icon-clean" onClick={onClose}>
                        <span className="material-symbols-rounded">close</span>
                    </button>
                </div>

                <div className="modal-body">
                    <div className="form-group">
                        <label className="form-label">Title *</label>
                        <input
                            className="form-input"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="What needs to be done?"
                            autoFocus
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Priority</label>
                        <div className="td-priority-row">
                            {['low', 'medium', 'high'].map(p => (
                                <label key={p} className={`td-priority-opt${priority === p ? ' selected' : ''}`}>
                                    <input type="radio" value={p} checked={priority === p} onChange={() => setPriority(p)} />
                                    {p}
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Due Date</label>
                        <input
                            type="date"
                            className="form-input"
                            value={dueDate}
                            onChange={e => setDueDate(e.target.value)}
                        />
                    </div>

                    {error && <p className="td-form-error">{error}</p>}
                </div>

                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving || !title.trim()}>
                        <span className="material-symbols-rounded">save</span>
                        {saving ? 'Saving…' : 'Save Task'}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export function TeacherDashboard() {
    const { notifications: liveNotifications, markRead } = useNotifications()
    const navigate = useNavigate()
    const [stats,       setStats]       = useState(null)
    const [schedule,    setSchedule]    = useState([])
    const [tasks,       setTasks]       = useState([])
    const [performance, setPerformance] = useState([])
    const [activities,  setActivities]  = useState([])
    const [hasMore,     setHasMore]     = useState(false)
    const [loadingMore, setLoadingMore] = useState(false)
    const [loading,     setLoading]     = useState(true)
    const [loadError,   setLoadError]   = useState(null)
    const [showTaskModal, setShowTaskModal] = useState(false)

    const storedUser = JSON.parse(localStorage.getItem('imboni_user') || '{}')
    const firstName  = storedUser.first_name || ''
    const lastName   = storedUser.last_name  || ''
    const fullName   = storedUser.full_name  || `${firstName} ${lastName}`.trim() || 'Teacher'
    const initials   = `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase() || 'T'

    useEffect(() => {
        Promise.all([
            getTeacherDashboardStats().catch(() => null),
            getTeacherTodaySchedule().catch(() => []),
            getTeacherTasks().catch(() => []),
            getTeacherClassPerformance().catch(() => []),
            getTeacherRecentActivities({ limit: 10, offset: 0 }).catch(err => ({ _error: err?.message })),
        ]).then(([s, sched, t, perf, act]) => {
            setStats(s)
            setSchedule(Array.isArray(sched) ? sched : [])
            setTasks(Array.isArray(t) ? t : [])
            setPerformance(Array.isArray(perf) ? perf : [])
            if (act && !act._error) {
                setActivities(act.results || [])
                setHasMore(act.has_more || false)
            } else if (act?._error) {
                setLoadError(act._error)
            }
        }).finally(() => setLoading(false))
    }, [])

    async function loadMore() {
        setLoadingMore(true)
        try {
            const res = await getTeacherRecentActivities({ limit: 10, offset: activities.length })
            setActivities(prev => [...prev, ...(res.results || [])])
            setHasMore(res.has_more || false)
        } catch (e) {
            setLoadError(e?.message || 'Failed to load more activities.')
        } finally {
            setLoadingMore(false)
        }
    }

    const statCards = stats ? [
        { icon: 'check_circle',    value: `${stats.overall_attendance}%`, label: 'Attendance Rate', trend: 'This term',            trendClass: 'positive', colorClass: 'success' },
        { icon: 'school',          value: `${stats.class_average}%`,      label: 'Class Average',   trend: 'This term',            trendClass: 'positive', colorClass: '' },
        { icon: 'assignment_late', value: stats.pending_grading,           label: 'Pending Grading', trend: 'Draft results',        trendClass: 'negative', colorClass: 'warning' },
        { icon: 'groups',          value: stats.total_students,            label: 'Total Students',  trend: 'Across your classes',  trendClass: '',          colorClass: '' },
        { icon: 'menu_book',       value: stats.classes_today,             label: 'Classes Today',   trend: `${stats.classes_completed} completed, ${stats.classes_remaining} left`, trendClass: '', colorClass: '' },
    ] : []

    const pendingTasks = tasks.filter(t => !t.is_completed).slice(0, 4)

    return (
        <>
            {showTaskModal && (
                <CreateTaskModal
                    onClose={() => setShowTaskModal(false)}
                    onCreated={task => setTasks(prev => [task, ...prev])}
                />
            )}

            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={teacherNavItems} secondaryItems={teacherSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title="Dashboard"
                        subtitle="Teacher Overview"
                        userName={fullName}
                        userRole="Teacher"
                        userInitials={initials}
                        avatarClass="teacher-av"
                        notifications={liveNotifications}
                        onNotificationRead={markRead}
                    />
                    <DashboardContent>

                        <WelcomeBanner name={firstName || 'Teacher'} role="Imboni Academy" />

                        <div className="dash-card">
                            <div className="section-label-sm">Quick Actions</div>
                            <div className="quick-actions">
                                <button className="btn btn-primary" onClick={() => navigate('/teacher/attendance')}>
                                    <span className="material-symbols-rounded">how_to_reg</span>
                                    Mark Attendance
                                </button>
                                <button className="btn btn-outline" onClick={() => navigate('/teacher/results')}>
                                    <span className="material-symbols-rounded">edit_note</span>
                                    Enter Results
                                </button>
                                <button className="btn btn-outline" onClick={() => navigate('/teacher/assignments')}>
                                    <span className="material-symbols-rounded">assignment</span>
                                    Assignments
                                </button>
                                <button className="btn btn-outline" onClick={() => navigate('/teacher/classes')}>
                                    <span className="material-symbols-rounded">groups</span>
                                    My Classes
                                </button>
                            </div>
                        </div>

                        {loading ? (
                            <div className="dash-card">
                                <p className="u-muted">Loading…</p>
                            </div>
                        ) : (
                            <>
                                {statCards.length > 0 && (
                                    <div className="dash-card">
                                        <div className="section-label-sm">Overview</div>
                                        <div className="portal-stat-grid">
                                            {statCards.map((stat, i) => <StatCard key={i} {...stat} />)}
                                        </div>
                                    </div>
                                )}

                                <div className="content-grid-2-1">
                                    <div className="card">
                                        <div className="card-header">
                                            <h3 className="card-title">Today's Schedule</h3>
                                        </div>
                                        <div className="card-content">
                                            {schedule.length === 0 ? (
                                                <p className="u-muted">No classes scheduled for today.</p>
                                            ) : schedule.map((slot, i) => {
                                                const meta  = slotMeta(slot.status)
                                                const start = slot.start_time?.slice(0, 5) || ''
                                                const end   = slot.end_time?.slice(0, 5)   || ''
                                                const cls   = slot.class_name || `S${slot.grade}${slot.section}`
                                                return (
                                                    <ScheduleCard
                                                        key={i}
                                                        time={`${start} - ${end}`}
                                                        room={slot.room_number ? `Room ${slot.room_number}` : ''}
                                                        className={cls}
                                                        subject={slot.subject_name}
                                                        status={meta.label}
                                                        statusClass={meta.cls}
                                                        cardClass={meta.cardCls}
                                                        showMark={meta.showMark}
                                                        onMark={() => navigate('/teacher/attendance')}
                                                        onClick={() => navigate(meta.showMark ? '/teacher/attendance' : '/teacher/classes')}
                                                    />
                                                )
                                            })}
                                        </div>
                                    </div>

                                    <div className="card">
                                        <div className="card-header">
                                            <h3 className="card-title">Pending Tasks</h3>
                                            <div className="u-row-sm">
                                                <span className="badge badge-secondary">{pendingTasks.length}</span>
                                                <button
                                                    className="btn btn-outline btn-sm"
                                                    onClick={() => setShowTaskModal(true)}
                                                    title="Add task"
                                                >
                                                    <span className="material-symbols-rounded icon-sm">add</span>
                                                    Add
                                                </button>
                                            </div>
                                        </div>
                                        <div className="card-content">
                                            {pendingTasks.length === 0 ? (
                                                <p className="u-muted">No pending tasks.</p>
                                            ) : pendingTasks.map((task, i) => (
                                                <TaskCard
                                                    key={i}
                                                    title={task.title}
                                                    deadline={task.due_date ? `Due: ${task.due_date}` : ''}
                                                    priority={task.priority || 'medium'}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="content-grid-1-1">
                                    <div className="card">
                                        <div className="card-header">
                                            <h3 className="card-title">Class Performance</h3>
                                            <span className="text-xs-muted">Average score per class</span>
                                        </div>
                                        <div className="card-content">
                                            {performance.length === 0 ? (
                                                <p className="u-muted">No performance data yet.</p>
                                            ) : (
                                                <>
                                                    <ResponsiveContainer width="100%" height={220}>
                                                        <BarChart data={performance} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                                                            <XAxis dataKey="class_name" tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                                                            <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                                                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                                                            <Bar dataKey="average_score" radius={[6, 6, 0, 0]} maxBarSize={44}>
                                                                {performance.map((entry, i) => (
                                                                    <Cell key={i} fill={barColor(entry.average_score)} />
                                                                ))}
                                                            </Bar>
                                                        </BarChart>
                                                    </ResponsiveContainer>
                                                    <div className="chart-legend-row">
                                                        {[
                                                            ['#10b981', '≥ 80% Excellent'],
                                                            ['#003d7a', '70–79% Good'],
                                                            ['#f59e0b', '< 70% Needs attention'],
                                                        ].map(([color, label]) => (
                                                            <div key={label} className="chart-legend-item">
                                                                <span className="chart-legend-dot-sq" style={{ background: color }} />
                                                                {label}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    <div className="card">
                                        <div className="card-header">
                                            <h3 className="card-title">Recent Activities</h3>
                                        </div>
                                        <div className="card-content">
                                            {loadError && (
                                                <p className="td-load-error">
                                                    <span className="material-symbols-rounded td-load-error-icon">error</span>
                                                    {loadError}
                                                </p>
                                            )}
                                            {activities.length === 0 && !loadError ? (
                                                <p className="u-muted">No recent activities.</p>
                                            ) : activities.map((a, i) => {
                                                const { iconClass, icon } = ACTIVITY_ICONS[a.activity_type] || { iconClass: '', icon: 'notifications' }
                                                return (
                                                    <ActivityItem
                                                        key={i}
                                                        iconClass={iconClass}
                                                        icon={icon}
                                                        text={a.description}
                                                        time={relTime(a.timestamp)}
                                                    />
                                                )
                                            })}
                                            {hasMore && (
                                                <button
                                                    className="btn btn-outline btn-sm td-load-more"
                                                    onClick={loadMore}
                                                    disabled={loadingMore}
                                                >
                                                    <span className="material-symbols-rounded icon-sm">
                                                        {loadingMore ? 'progress_activity' : 'expand_more'}
                                                    </span>
                                                    {loadingMore ? 'Loading…' : 'Load More'}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
