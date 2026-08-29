import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useNotifications } from '../../hooks/useNotifications'
import { WelcomeBanner } from '../../components/layout/WelcomeBanner'
import { StatCard } from '../../components/layout/StatCard'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { teacherNavItems, teacherSecondaryItems } from './teacherNav'
import { classLabel } from '../../utils/classes'
import { toList } from '../../api/client'
import { formatDate } from '../../utils/date'
import { useSchoolSettings } from '../../hooks/useSchoolSetting'
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

function relTime(ts, translate) {
    if (!ts) return ''
    const d = Math.floor((Date.now() - new Date(ts)) / 1000)
    if (d < 60)    return translate('common.justNow')
    if (d < 3600)  return translate('common.minutesAgo', { count: Math.floor(d / 60) })
    if (d < 86400) return translate('common.hoursAgo',   { count: Math.floor(d / 3600) })
    return translate('common.daysAgo', { count: Math.floor(d / 86400) })
}

function ScheduleCard({ time, room, className, subject, status, statusClass, cardClass, showMark, onMark, onClick }) {
    const { t } = useTranslation()
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
                    {t('teacher.dashboard.markAttendance')}
                </button>
            )}
            <span className={`badge ${statusClass}`}>{status}</span>
        </div>
    )
}

const PRIORITY_KEYS = {
    low:    'common.priorityLow',
    medium: 'common.priorityMedium',
    high:   'common.priorityHigh',
}

function TaskCard({ title, deadline, priority }) {
    const { t } = useTranslation()
    const cls = priority === 'high' ? 'badge-high' : priority === 'medium' ? 'badge-medium' : 'badge-low'
    return (
        <div className="task-card">
            <div className={`task-priority-dot ${priority}`}></div>
            <div className="task-content">
                <div className="task-title">{title}</div>
                {deadline && <div className="task-deadline">{deadline}</div>}
            </div>
            <span className={`badge ${cls}`}>{t(PRIORITY_KEYS[priority] || PRIORITY_KEYS.medium)}</span>
        </div>
    )
}

function CustomTooltip({ active, payload }) {
    const { t } = useTranslation()
    if (!active || !payload?.length) return null
    const d = payload[0].payload
    return (
        <div className="chart-tooltip">
            <div className="chart-tooltip-label">{d.class_name}</div>
            <div style={{ color: barColor(d.average_score) }}>{t('teacher.dashboard.percentAverage', { value: d.average_score })}</div>
        </div>
    )
}

function ActivityItem({ iconClass, icon, text, time }) {
    return (
        <div className="activity-item">
            <div className={`activity-icon ${iconClass}`}>
                <span className="material-symbols-rounded icon-md" aria-hidden="true">{icon}</span>
            </div>
            <div className="activity-content">
                <div className="activity-text">{text}</div>
                <div className="activity-time">
                    <span className="material-symbols-rounded icon-sm" aria-hidden="true">schedule</span>
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
    if (status === 'completed')   return { labelKey: 'teacher.dashboard.slotCompleted',  cls: 'badge-completed', cardCls: 'completed', showMark: false }
    if (status === 'in_progress') return { labelKey: 'teacher.dashboard.slotInProgress', cls: 'badge-primary',   cardCls: 'current',   showMark: true  }
    return                               { labelKey: 'teacher.dashboard.slotUpcoming',   cls: 'badge-secondary', cardCls: 'upcoming',  showMark: false }
}

// ── Create Task Modal ─────────────────────────────────────────────────────────
function CreateTaskModal({ onClose, onCreated }) {
    const { t } = useTranslation()
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
        if (!title.trim()) { setError(t('teacher.dashboard.titleRequiredError')); return }
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
            setError(e?.message || t('teacher.dashboard.saveTaskFailed'))
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box modal-box-sm" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="modal-header-left">
                        <span className="material-symbols-rounded text-primary" aria-hidden="true">task_alt</span>
                        <h2 className="modal-title">{t('teacher.dashboard.newTask')}</h2>
                    </div>
                    <button className="btn-icon-clean" onClick={onClose} aria-label={t('common.close')}>
                        <span className="material-symbols-rounded" aria-hidden="true">close</span>
                    </button>
                </div>

                <div className="modal-body">
                    <div className="form-group">
                        <label className="form-label">{t('common.titleRequired')}</label>
                        <input
                            className="form-input"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder={t('teacher.dashboard.taskPlaceholder')}
                            autoFocus
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">{t('common.priority')}</label>
                        <div className="td-priority-row">
                            {['low', 'medium', 'high'].map(p => (
                                <label key={p} className={`td-priority-opt${priority === p ? ' selected' : ''}`}>
                                    <input type="radio" value={p} checked={priority === p} onChange={() => setPriority(p)} />
                                    {t(PRIORITY_KEYS[p])}
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">{t('common.dueDate')}</label>
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
                    <button className="btn btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving || !title.trim()}>
                        <span className="material-symbols-rounded" aria-hidden="true">save</span>
                        {saving ? t('common.saving') : t('teacher.dashboard.saveTask')}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export function TeacherDashboard() {
    const { t } = useTranslation()
    const { notifications: liveNotifications, markRead } = useNotifications()
    const navigate = useNavigate()
    const { setting } = useSchoolSettings()
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
        ]).then(([s, sched, taskList, perf, act]) => {
            setStats(s)
            setSchedule(Array.isArray(sched) ? sched : [])
            setTasks(toList(taskList))
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
            setLoadError(e?.message || t('teacher.dashboard.loadMoreFailed'))
        } finally {
            setLoadingMore(false)
        }
    }

    const statCards = stats ? [
        { icon: 'check_circle',    value: `${stats.overall_attendance}%`, label: t('teacher.dashboard.attendanceRate'), trend: t('teacher.dashboard.thisTerm'),           trendClass: 'positive', colorClass: 'success' },
        { icon: 'school',          value: `${stats.class_average}%`,      label: t('teacher.dashboard.classAverage'),   trend: t('teacher.dashboard.thisTerm'),           trendClass: 'positive', colorClass: '' },
        { icon: 'assignment_late', value: stats.pending_grading,          label: t('teacher.dashboard.pendingGrading'), trend: t('teacher.dashboard.draftResults'),       trendClass: 'negative', colorClass: 'warning' },
        { icon: 'groups',          value: stats.total_students,           label: t('teacher.dashboard.totalStudents'),  trend: t('teacher.dashboard.acrossYourClasses'),  trendClass: '',         colorClass: '' },
        { icon: 'menu_book',       value: stats.classes_today,            label: t('teacher.dashboard.classesToday'),
          trend: t('teacher.dashboard.classesProgress', { done: stats.classes_completed, left: stats.classes_remaining }), trendClass: '', colorClass: '' },
    ] : []

    const pendingTasks = tasks.filter(task => !task.is_completed).slice(0, 4)

    return (
        <>
            {showTaskModal && (
                <CreateTaskModal
                    onClose={() => setShowTaskModal(false)}
                    onCreated={task => setTasks(prev => [task, ...prev])}
                />
            )}

            <a href="#main-content" className="skip-link">{t('common.skipToContent')}</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={teacherNavItems} secondaryItems={teacherSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title={t('nav.dashboard')}
                        subtitle={t('teacher.dashboard.subtitle')}
                        userName={fullName}
                        userRole={t('roles.teacher')}
                        userInitials={initials}
                        avatarClass="teacher-av"
                        notifications={liveNotifications}
                        onNotificationRead={markRead}
                    />
                    <DashboardContent>

                        <WelcomeBanner name={firstName || t('roles.teacher')} role={setting.school_name} />

                        <div className="dash-card">
                            <div className="section-label-sm">{t('common.quickActions')}</div>
                            <div className="quick-actions">
                                <button className="btn btn-primary" onClick={() => navigate('/teacher/attendance')}>
                                    <span className="material-symbols-rounded" aria-hidden="true">how_to_reg</span>
                                    {t('teacher.dashboard.markAttendance')}
                                </button>
                                <button className="btn btn-outline" onClick={() => navigate('/teacher/results')}>
                                    <span className="material-symbols-rounded" aria-hidden="true">edit_note</span>
                                    {t('teacher.dashboard.enterResults')}
                                </button>
                                <button className="btn btn-outline" onClick={() => navigate('/teacher/assignments')}>
                                    <span className="material-symbols-rounded" aria-hidden="true">assignment</span>
                                    {t('teacher.dashboard.assignments')}
                                </button>
                                <button className="btn btn-outline" onClick={() => navigate('/teacher/classes')}>
                                    <span className="material-symbols-rounded" aria-hidden="true">groups</span>
                                    {t('teacher.dashboard.myClasses')}
                                </button>
                            </div>
                        </div>

                        {loading ? (
                            <div className="dash-card">
                                <p className="u-muted">{t('common.loading')}</p>
                            </div>
                        ) : (
                            <>
                                {statCards.length > 0 && (
                                    <div className="dash-card">
                                        <div className="section-label-sm">{t('common.overview')}</div>
                                        <div className="portal-stat-grid">
                                            {statCards.map((stat, i) => <StatCard key={i} {...stat} />)}
                                        </div>
                                    </div>
                                )}

                                <div className="content-grid-2-1">
                                    <div className="card">
                                        <div className="card-header">
                                            <h3 className="card-title">{t('teacher.dashboard.todaySchedule')}</h3>
                                        </div>
                                        <div className="card-content">
                                            {schedule.length === 0 ? (
                                                <p className="u-muted">{t('teacher.dashboard.noClassesToday')}</p>
                                            ) : schedule.map((slot, i) => {
                                                const meta  = slotMeta(slot.status)
                                                const start = slot.start_time?.slice(0, 5) || ''
                                                const end   = slot.end_time?.slice(0, 5)   || ''
                                                const cls   = classLabel(slot.grade, slot.section, slot.class_name)
                                                return (
                                                    <ScheduleCard
                                                        key={i}
                                                        time={`${start} - ${end}`}
                                                        room={slot.room_number ? t('common.roomNumber', { number: slot.room_number }) : ''}
                                                        className={cls}
                                                        subject={slot.subject_name}
                                                        status={t(meta.labelKey)}
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
                                            <h3 className="card-title">{t('teacher.dashboard.pendingTasks')}</h3>
                                            <div className="u-row-sm">
                                                <span className="badge badge-secondary">{pendingTasks.length}</span>
                                                <button
                                                    className="btn btn-outline btn-sm"
                                                    onClick={() => setShowTaskModal(true)}
                                                    title={t('teacher.dashboard.addTask')}
                                                >
                                                    <span className="material-symbols-rounded icon-sm" aria-hidden="true">add</span>
                                                    {t('common.add')}
                                                </button>
                                            </div>
                                        </div>
                                        <div className="card-content">
                                            {pendingTasks.length === 0 ? (
                                                <p className="u-muted">{t('teacher.dashboard.noPendingTasks')}</p>
                                            ) : pendingTasks.map((task, i) => (
                                                <TaskCard
                                                    key={i}
                                                    title={task.title}
                                                    deadline={task.due_date ? t('teacher.dashboard.due', { date: formatDate(task.due_date) }) : ''}
                                                    priority={task.priority || 'medium'}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="content-grid-1-1">
                                    <div className="card">
                                        <div className="card-header">
                                            <h3 className="card-title">{t('teacher.dashboard.classPerformance')}</h3>
                                            <span className="text-xs-muted">{t('teacher.dashboard.averagePerClass')}</span>
                                        </div>
                                        <div className="card-content">
                                            {performance.length === 0 ? (
                                                <p className="u-muted">{t('teacher.dashboard.noPerformance')}</p>
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
                                                            ['#10b981', t('teacher.dashboard.legendExcellent')],
                                                            ['#003d7a', t('teacher.dashboard.legendGood')],
                                                            ['#f59e0b', t('teacher.dashboard.legendAttention')],
                                                        ].map(([color, label]) => (
                                                            <div key={color} className="chart-legend-item">
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
                                            <h3 className="card-title">{t('teacher.dashboard.recentActivities')}</h3>
                                        </div>
                                        <div className="card-content">
                                            {loadError && (
                                                <p className="td-load-error">
                                                    <span className="material-symbols-rounded td-load-error-icon" aria-hidden="true">error</span>
                                                    {loadError}
                                                </p>
                                            )}
                                            {activities.length === 0 && !loadError ? (
                                                <p className="u-muted">{t('teacher.dashboard.noRecentActivity')}</p>
                                            ) : activities.map((a, i) => {
                                                const { iconClass, icon } = ACTIVITY_ICONS[a.activity_type] || { iconClass: '', icon: 'notifications' }
                                                return (
                                                    <ActivityItem
                                                        key={i}
                                                        iconClass={iconClass}
                                                        icon={icon}
                                                        text={a.description}
                                                        time={relTime(a.timestamp, t)}
                                                    />
                                                )
                                            })}
                                            {hasMore && (
                                                <button
                                                    className="btn btn-outline btn-sm td-load-more"
                                                    onClick={loadMore}
                                                    disabled={loadingMore}
                                                >
                                                    <span className="material-symbols-rounded icon-sm" aria-hidden="true">
                                                        {loadingMore ? 'progress_activity' : 'expand_more'}
                                                    </span>
                                                    {loadingMore ? t('common.loading') : t('common.loadMore')}
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
