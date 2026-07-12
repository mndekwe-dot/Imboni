import { useState, useEffect } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { useToast } from '../../context/ToastContext'
import { errorMessage } from '../../utils/errors'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useNotifications } from '../../hooks/useNotifications'
import { useSessionUser } from '../../hooks/useSessionUser'
import { WelcomeBanner } from '../../components/layout/WelcomeBanner'
import { StatCard } from '../../components/layout/StatCard'
import { disNavItems, disSecondaryItems } from './disNav'
import { getDisDashboard, getDisStaff, getDisTasks, createDisTask, updateDisTask } from '../../api/discipline'
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
        : '—'
    return (
        <tr>
            <td><strong>{student}</strong></td>
            <td><span className="class-chip">{cls}</span></td>
            <td><span className={`incident-type-tag ${meta.cls}`}>{meta.label}</span> {title}</td>
            <td className="text-muted">{date}</td>
            <td className="text-muted">{reported_by || '—'}</td>
            <td>
                {follow_up_required
                    ? <span className={`badge ${follow_up_completed ? 'badge-success' : 'badge-upcoming'}`}>{fuLabel}</span>
                    : <span style={{ color: 'var(--muted-foreground)' }}>—</span>
                }
            </td>
        </tr>
    )
}

function StaffItem({ full_name, staff_type, assigned_dormitory, assigned_grade }) {
    const isMatron = ['matron', 'head_matron'].includes(staff_type)
    const icon     = isMatron ? 'home' : 'emoji_events'
    const meta     = assigned_dormitory
        ? `${staff_type === 'matron' ? 'Matron' : 'Head Matron'} — ${assigned_dormitory}`
        : `Patron${assigned_grade ? ' — ' + assigned_grade : ''}`
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
        getDisTasks().then(data => setTasks(Array.isArray(data) ? data : [])).catch(e => toast.error(errorMessage(e, 'Could not load tasks.')))
    }, [])

    async function handleCreateTask() {
        if (!taskTitle.trim()) return
        setTaskSaving(true); setTaskError(null)
        try {
            const task = await createDisTask({ title: taskTitle.trim(), priority: taskPriority, due_date: taskDue || null })
            setTasks(prev => [task, ...prev])
            setTaskTitle(''); setTaskDue(''); setShowTaskForm(false)
        } catch (e) {
            setTaskError(e?.message || 'Failed to save task.')
        } finally {
            setTaskSaving(false)
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
                        title="Dashboard"
                        subtitle="Director of Discipline — Overview"
                        {...sessionUser}
                        notifications={liveNotifications}
                        onNotificationRead={markRead}
                    />
                    <DashboardContent>

                        <WelcomeBanner
                            name={sessionUser.userName}
                            role="Director of Discipline · Imboni Academy"
                        />

                        <div className="portal-stat-grid">
                            {loading
                                ? [1,2,3,4].map(i => <div key={i} className="stat-card skeleton" style={{ height: 90 }} />)
                                : statCards.map((s, i) => <StatCard key={i} {...s} />)
                            }
                        </div>

                        <div className="disc-two-col">

                            {/* Recent incidents */}
                            <div className="card">
                                <div className="card-header">
                                    <h3 className="card-title"><span className="material-symbols-rounded">history</span> Recent Incidents</h3>
                                    <a href="/discipline/reports" className="btn btn-outline btn-sm">View All</a>
                                </div>
                                <div className="card-content">
                                    {loading ? (
                                        <p style={{ color: 'var(--muted-foreground)', padding: '1rem' }}>Loading…</p>
                                    ) : incidents.length === 0 ? (
                                        <p style={{ color: 'var(--muted-foreground)', padding: '1rem' }}>No recent incidents.</p>
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
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                                {/* My Tasks */}
                                <div className="card">
                                    <div className="card-header">
                                        <h3 className="card-title">
                                            <span className="material-symbols-rounded">task_alt</span> My Tasks
                                        </h3>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <span className="badge badge-secondary">{tasks.filter(t => !t.is_completed).length}</span>
                                            <button className="btn btn-outline btn-sm" onClick={() => setShowTaskForm(v => !v)}>
                                                <span className="material-symbols-rounded icon-sm">{showTaskForm ? 'expand_less' : 'add'}</span>
                                                {showTaskForm ? 'Cancel' : 'Add'}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="card-content">
                                        {showTaskForm && (
                                            <div style={{ background: 'var(--muted)', borderRadius: '10px', padding: '0.875rem', marginBottom: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                                <input
                                                    className="form-input"
                                                    placeholder="Task title…"
                                                    value={taskTitle}
                                                    onChange={e => setTaskTitle(e.target.value)}
                                                    onKeyDown={e => e.key === 'Enter' && handleCreateTask()}
                                                    autoFocus
                                                />
                                                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                                                    {['low', 'medium', 'high'].map(p => (
                                                        <label key={p} style={{
                                                            display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer',
                                                            fontSize: '0.8rem', padding: '0.3rem 0.6rem', borderRadius: '8px',
                                                            border: `1px solid ${taskPriority === p ? 'var(--discipline, #7c3aed)' : 'var(--border)'}`,
                                                            background: taskPriority === p ? '#ede9fe' : 'transparent',
                                                            textTransform: 'capitalize',
                                                        }}>
                                                            <input type="radio" value={p} checked={taskPriority === p} onChange={() => setTaskPriority(p)} style={{ accentColor: 'var(--discipline, #7c3aed)' }} />
                                                            {p}
                                                        </label>
                                                    ))}
                                                    <input type="date" className="form-input" style={{ flex: 1, minWidth: '130px' }} value={taskDue} onChange={e => setTaskDue(e.target.value)} />
                                                </div>
                                                {taskError && <p style={{ color: '#dc2626', fontSize: '0.78rem', margin: 0 }}>{taskError}</p>}
                                                <button className="btn btn-primary btn-sm" style={{ background: 'var(--discipline, #7c3aed)', borderColor: 'var(--discipline, #7c3aed)' }} onClick={handleCreateTask} disabled={taskSaving || !taskTitle.trim()}>
                                                    <span className="material-symbols-rounded icon-sm">save</span>
                                                    {taskSaving ? 'Saving…' : 'Save Task'}
                                                </button>
                                            </div>
                                        )}
                                        {tasks.length === 0 ? (
                                            <p style={{ color: 'var(--muted-foreground)', fontSize: '0.875rem' }}>No tasks yet.</p>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                                {tasks.slice(0, 5).map(task => (
                                                    <div key={task.id} style={{
                                                        display: 'flex', alignItems: 'center', gap: '0.6rem',
                                                        padding: '0.45rem 0.65rem', borderRadius: '8px',
                                                        background: task.is_completed ? 'var(--muted)' : 'var(--card)',
                                                        border: '1px solid var(--border)',
                                                        opacity: task.is_completed ? 0.6 : 1,
                                                    }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={task.is_completed}
                                                            onChange={() => toggleTaskDone(task)}
                                                            style={{ accentColor: 'var(--discipline, #7c3aed)', cursor: 'pointer', width: '1rem', height: '1rem', flexShrink: 0 }}
                                                        />
                                                        <span style={{
                                                            flex: 1, fontSize: '0.85rem', fontWeight: 500,
                                                            textDecoration: task.is_completed ? 'line-through' : 'none',
                                                            color: task.is_completed ? 'var(--muted-foreground)' : 'inherit',
                                                        }}>{task.title}</span>
                                                        {task.due_date && (
                                                            <span style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', flexShrink: 0 }}>{task.due_date}</span>
                                                        )}
                                                        <span className={`badge ${task.priority === 'high' ? 'badge-high' : task.priority === 'medium' ? 'badge-medium' : 'badge-low'}`}>
                                                            {task.priority}
                                                        </span>
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
                                        <a href="/discipline/staff" className="btn btn-outline btn-sm">Manage</a>
                                    </div>
                                    <div className="card-content">
                                        {loading ? (
                                            <p style={{ color: 'var(--muted-foreground)' }}>Loading…</p>
                                        ) : staff.length === 0 ? (
                                            <p style={{ color: 'var(--muted-foreground)' }}>No staff on record.</p>
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
