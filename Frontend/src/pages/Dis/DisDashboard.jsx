import { useState, useEffect } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Sidebar } from '../../components/layout/Sidebar'
import { useToast } from '../../context/ToastContext'
import { errorMessage } from '../../utils/errors'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useNotifications } from '../../hooks/useNotifications'
import { useSessionUser } from '../../hooks/useSessionUser'
import { WelcomeBanner, bannerRole } from '../../components/layout/WelcomeBanner'
import { useSchoolSettings } from '../../hooks/useSchoolSetting'
import { StatCard } from '../../components/layout/StatCard'
import { disNavItems, disSecondaryItems } from './disNav'
import { getDisDashboard, getDisStaff, getDisTasks, createDisTask, updateDisTask, deleteDisTask } from '../../api/discipline'
import { toList } from '../../api/client'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/discipline.css'
import { DashboardContent } from '../../components/layout/DashboardContent'

const TYPE_META = {
    incident:    { cls: 'negative', label: 'Incident'    },
    warning:     { cls: 'warning',  label: 'Warning'     },
    positive:    { cls: 'positive', label: 'Positive'    },
    achievement: { cls: 'positive', label: 'Achievement' },
}

function IncidentRow({ student, grade, section, title, report_type, date, reported_by, follow_up_required, follow_up_completed }) {
    const meta = TYPE_META[report_type] || { cls: '', label: report_type }
    const cls  = `${grade || ''}${section || ''}`
    const fuLabel = follow_up_required
        ? (follow_up_completed ? 'Done' : 'Pending')
        : '-'
    return (
        <tr>
            <td><strong>{student}</strong></td>
            <td><span className="class-chip">{cls}</span></td>
            <td><span className={`incident-type-tag ${meta.cls}`}>{meta.label}</span> {title}</td>
            <td className="text-muted">{date}</td>
            <td className="text-muted">{reported_by || '-'}</td>
            <td>
                {follow_up_required
                    ? <span className={`badge ${follow_up_completed ? 'badge-success' : 'badge-upcoming'}`}>{fuLabel}</span>
                    : <span className="u-muted">-</span>
                }
            </td>
        </tr>
    )
}

function StaffItem({ full_name, staff_type, assigned_dormitory, assigned_grade }) {
    const isMatron = ['matron', 'head_matron'].includes(staff_type)
    const icon     = isMatron ? 'home' : 'emoji_events'
    const meta     = assigned_dormitory
        ? `${staff_type === 'matron' ? 'Matron' : 'Head Matron'} (${assigned_dormitory})`
        : `Patron${assigned_grade ? ' (' + assigned_grade + ')' : ''}`
    return (
        <div className="disc-activity-item">
            <div className={`disc-activity-icon ${isMatron ? 'purple' : 'green'}`}>
                <span className="material-symbols-rounded">{icon}</span>
            </div>
            <div>
                <div className="disc-activity-title">{full_name}</div>
                <div className="disc-activity-meta">{meta}</div>
            </div>
        </div>
    )
}

export function DisDashboard() {
    const { t } = useTranslation()
    const { setting } = useSchoolSettings()
    const { notifications: liveNotifications, markRead } = useNotifications()
    const toast = useToast()
    const sessionUser = useSessionUser()

    const [stats,     setStats]     = useState(null)
    const [incidents, setIncidents] = useState([])
    const [staff,     setStaff]     = useState([])
    const [loading,   setLoading]   = useState(true)

    const [tasks,        setTasks]        = useState([])
    const [taskTitle,    setTaskTitle]    = useState('')
    const [taskPriority, setTaskPriority] = useState('medium')
    const [taskDue,      setTaskDue]      = useState('')
    const [taskSaving,   setTaskSaving]   = useState(false)
    const [taskError,    setTaskError]    = useState(null)
    const [showTaskForm, setShowTaskForm] = useState(false)

    useEffect(() => {
        Promise.all([
            getDisDashboard(),
            getDisStaff(),
        ]).then(([dash, staffList]) => {
            setStats(dash.stats)
            setIncidents(dash.recent_incidents || [])
            setStaff((staffList || []).slice(0, 4))
        }).catch(console.error)
          .finally(() => setLoading(false))
        getDisTasks().then(data => setTasks(toList(data))).catch(e => toast.error(errorMessage(e, t('common.loadFailed'))))
    }, [])

    async function handleCreateTask() {
        if (!taskTitle.trim()) return
        setTaskSaving(true); setTaskError(null)
        try {
            const task = await createDisTask({ title: taskTitle.trim(), priority: taskPriority, due_date: taskDue || null })
            setTasks(prev => [task, ...prev])
            setTaskTitle(''); setTaskDue(''); setShowTaskForm(false)
        } catch (e) {
            setTaskError(e?.message || t('common.genericSaveFailed'))
        } finally {
            setTaskSaving(false)
        }
    }

    async function handleDeleteTask(task) {
        const previous = tasks
        setTasks(prev => prev.filter(t => t.id !== task.id))   // optimistic
        try {
            await deleteDisTask(task.id)
        } catch (e) {
            setTasks(previous)                                 // put it back, say why
            toast.error(errorMessage(e, t('dis.dashboard.deleteTaskFailed')))
        }
    }

    async function handleClearCompleted() {
        const done = tasks.filter(t => t.is_completed)
        if (!done.length) return
        if (!window.confirm(`Delete ${done.length} completed task${done.length > 1 ? 's' : ''}? This cannot be undone.`)) return
        const previous = tasks
        setTasks(prev => prev.filter(t => !t.is_completed))
        const results = await Promise.allSettled(done.map(t => deleteDisTask(t.id)))
        if (results.some(r => r.status === 'rejected')) {
            toast.error(t('dis.dashboard.deleteTasksFailed'))
            getDisTasks().then(data => setTasks(toList(data))).catch(() => setTasks(previous))
        }
    }

    async function toggleTaskDone(task) {
        try {
            const updated = await updateDisTask(task.id, { is_completed: !task.is_completed })
            setTasks(prev => prev.map(t => t.id === task.id ? updated : t))
        } catch { /* silent — task remains unchanged */ }
    }

    const statCards = stats ? [
        { colorClass: '',        icon: 'groups',   value: stats.active_students,      label: 'Total Students'        },
        { colorClass: 'warning', icon: 'warning',  value: stats.incidents_this_month, label: 'Incidents This Month'  },
        { colorClass: 'red',     icon: 'gavel',    value: stats.pending_follow_ups,   label: 'Pending Follow-ups'    },
        { colorClass: 'success', icon: 'verified', value: stats.student_leaders,      label: 'Student Leaders'       },
    ] : []

    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={disNavItems} secondaryItems={disSecondaryItems} />

                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title={t('nav.dashboard')}
                        subtitle={t('dis.dashboard.subtitle')}
                        {...sessionUser}
                        notifications={liveNotifications}
                        onNotificationRead={markRead}
                    />
                    <DashboardContent>

                        <WelcomeBanner
                            name={sessionUser.userName}
                            role={bannerRole(t, t('roles.disciplineDirector'), setting.school_name)}
                        />

                        <div className="portal-stat-grid">
                            {loading
                                ? [1,2,3,4].map(i => <div key={i} className="stat-card loading-skeleton dis-skel" />)
                                : statCards.map((s, i) => <StatCard key={i} {...s} />)
                            }
                        </div>

                        <div className="disc-two-col">

                            {/* Recent incidents */}
                            <div className="card">
                                <div className="card-header">
                                    <h3 className="card-title"><span className="material-symbols-rounded">history</span> Recent Incidents</h3>
                                    <Link to="/discipline/students?tab=reports" className="btn btn-outline btn-sm">{t('common.viewAll')}</Link>
                                </div>
                                <div className="card-content">
                                    {loading ? (
                                        <p className="dis-card-empty">Loading…</p>
                                    ) : incidents.length === 0 ? (
                                        <p className="dis-card-empty">No recent incidents.</p>
                                    ) : (
                                        <div className="table-responsive">
                                            <table>
                                                <thead>
                                                    <tr>
                                                        <th>Student</th>
                                                        <th>Class</th>
                                                        <th>Incident</th>
                                                        <th>Date</th>
                                                        <th>Reported By</th>
                                                        <th>Follow-up</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {incidents.map(inc => <IncidentRow key={inc.id} {...inc} />)}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Right column */}
                            <div className="u-stack-1">

                                {/* My Tasks */}
                                <div className="card">
                                    <div className="card-header">
                                        <h3 className="card-title">
                                            <span className="material-symbols-rounded">task_alt</span> My Tasks
                                        </h3>
                                        <div className="u-row-sm">
                                            <span className="badge badge-secondary">{tasks.filter(t => !t.is_completed).length}</span>
                                            {tasks.some(t => t.is_completed) && (
                                                <button className="btn btn-outline btn-sm" onClick={handleClearCompleted}>
                                                    <span className="material-symbols-rounded icon-sm">playlist_remove</span>
                                                    Clear done
                                                </button>
                                            )}
                                            <button className="btn btn-outline btn-sm" onClick={() => setShowTaskForm(v => !v)}>
                                                <span className="material-symbols-rounded icon-sm">{showTaskForm ? 'expand_less' : 'add'}</span>
                                                {showTaskForm ? 'Cancel' : 'Add'}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="card-content">
                                        {showTaskForm && (
                                            <div className="dis-task-form">
                                                <input
                                                    className="form-input"
                                                    placeholder="Task title…"
                                                    value={taskTitle}
                                                    onChange={e => setTaskTitle(e.target.value)}
                                                    onKeyDown={e => e.key === 'Enter' && handleCreateTask()}
                                                    autoFocus
                                                />
                                                <div className="dis-prio-row">
                                                    {['low', 'medium', 'high'].map(p => (
                                                        <label key={p} className={`dis-prio-opt${taskPriority === p ? ' on' : ''}`}>
                                                            <input type="radio" value={p} checked={taskPriority === p} onChange={() => setTaskPriority(p)} className="dis-radio-disc" />
                                                            {p}
                                                        </label>
                                                    ))}
                                                    <input type="date" className="form-input dis-task-date" value={taskDue} onChange={e => setTaskDue(e.target.value)} />
                                                </div>
                                                {taskError && <p className="dis-task-err">{taskError}</p>}
                                                <button className="btn btn-primary btn-sm dis-btn-disc" onClick={handleCreateTask} disabled={taskSaving || !taskTitle.trim()}>
                                                    <span className="material-symbols-rounded icon-sm">save</span>
                                                    {taskSaving ? 'Saving…' : 'Save Task'}
                                                </button>
                                            </div>
                                        )}
                                        {tasks.length === 0 ? (
                                            <p className="dis-note-sm">No tasks yet.</p>
                                        ) : (
                                            <div className="dis-task-list">
                                                {tasks.map(task => (
                                                    <div key={task.id} className={`dis-task-item${task.is_completed ? ' done' : ''}`}>
                                                        <input
                                                            type="checkbox"
                                                            checked={task.is_completed}
                                                            onChange={() => toggleTaskDone(task)}
                                                            className="dis-task-check"
                                                        />
                                                        <span className={`dis-task-title${task.is_completed ? ' done' : ''}`}>{task.title}</span>
                                                        {task.due_date && (
                                                            <span className="dis-task-due">{task.due_date}</span>
                                                        )}
                                                        <span className={`badge ${task.priority === 'high' ? 'badge-high' : task.priority === 'medium' ? 'badge-medium' : 'badge-low'}`}>
                                                            {task.priority}
                                                        </span>
                                                        <button
                                                            className="btn-icon-clean task-del-btn"
                                                            title={`Delete "${task.title}"`}
                                                            aria-label={`Delete "${task.title}"`}
                                                            onClick={() => handleDeleteTask(task)}
                                                        >
                                                            <span className="material-symbols-rounded icon-sm">delete</span>
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Staff under supervision */}
                                <div className="card">
                                    <div className="card-header">
                                        <h3 className="card-title"><span className="material-symbols-rounded">supervisor_account</span> Staff Under Supervision</h3>
                                        <Link to="/discipline/staff" className="btn btn-outline btn-sm">{t('common.manage')}</Link>
                                    </div>
                                    <div className="card-content">
                                        {loading ? (
                                            <p className="u-muted">Loading…</p>
                                        ) : staff.length === 0 ? (
                                            <p className="u-muted">No staff on record.</p>
                                        ) : (
                                            <div className="disc-activity-list">
                                                {staff.map(s => <StaffItem key={s.id} {...s} />)}
                                            </div>
                                        )}
                                    </div>
                                </div>

                            </div>
                        </div>

                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
