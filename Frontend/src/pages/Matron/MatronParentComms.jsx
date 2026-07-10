import { useEffect, useState } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { Link } from 'react-router'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/matron.css'
import { matronNavItems, matronSecondaryItems, matronUser } from './matronNav'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { getParentComms, sendParentComm, getMatronStudents } from '../../api/matron'
import { useSessionUser } from '../../hooks/useSessionUser'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useNotifications } from '../../hooks/useNotifications'


const OUTCOME_DISPLAY = {
    completed:      { statusClass: 'completed', status: 'Completed'     },
    no_answer:      { statusClass: 'pending',   status: 'No Answer'     },
    message_left:   { statusClass: 'sent',      status: 'Message Left'  },
    awaiting_reply: { statusClass: 'pending',   status: 'Pending Reply' },
    sms_sent:       { statusClass: 'sent',      status: 'Sent'          },
    email_sent:     { statusClass: 'sent',      status: 'Sent'          },
}


function CommsStat({ iconClass, icon, value, label }) {
    return (
        <div className="comms-stat-card">
            <div className={`comms-stat-icon ${iconClass}`}><span className="material-symbols-rounded">{icon}</span></div>
            <div>
                <div className="comms-stat-value">{value}</div>
                <div className="comms-stat-label">{label}</div>
            </div>
        </div>
    )
}

function CommEntry({ typeClass, typeIcon, student, parent, subject, notes, meta, statusClass, status }) {
    return (
        <div className="comm-entry">
            <div className={`comm-type-icon ${typeClass}`}><span className="material-symbols-rounded">{typeIcon}</span></div>
            <div className="comm-body">
                <div className="comm-header">
                    <span className="comm-student">{student}</span>
                    <span className="comm-parent">&rarr; {parent}</span>
                </div>
                <div className="comm-subject">{subject}</div>
                <div className="comm-notes">{notes}</div>
                <div className="comm-meta">{meta}</div>
            </div>
            <div className="comm-right">
                <span className={`comm-status-badge ${statusClass}`}>{status}</span>
            </div>
        </div>
    )
}

export function MatronParentComms() {
    const sessionUser = useSessionUser()
    const { notifications: liveNotifications, markRead } = useNotifications()
    const [data, setData] = useState(null)
    const [students, setStudents] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    const [typeFilter, setTypeFilter] = useState('')
    const [outcomeFilter, setOutcomeFilter] = useState('')
    const [studentFilter, setStudentFilter] = useState('')
    const [periodFilter, setPeriodFilter] = useState('')

    const [studentId, setStudentId] = useState('')
    const [parentContact, setParentContact] = useState('')
    const [commType, setCommType] = useState('call')
    const [contactedAt, setContactedAt] = useState('')
    const [subject, setSubject] = useState('')
    const [notes, setNotes] = useState('')
    const [outcome, setOutcome] = useState('completed')
    const [followUp, setFollowUp] = useState('no')
    const [urgency, setUrgency] = useState('routine')
    const [saving, setSaving] = useState(false)
    const [saveError, setSaveError] = useState(null)

    function load() {
        setLoading(true)
        const params = {}
        if (typeFilter) params.type = typeFilter
        if (outcomeFilter) params.outcome = outcomeFilter
        if (studentFilter) params.student_id = studentFilter
        if (periodFilter) params.period = periodFilter
        getParentComms(params)
            .then(setData)
            .catch(err => setError(err.message))
            .finally(() => setLoading(false))
    }

    useEffect(() => {
        load()
        getMatronStudents().then(s => setStudents(Array.isArray(s) ? s : [])).catch(() => {})
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [typeFilter, outcomeFilter, studentFilter, periodFilter])

    function resetForm() {
        setStudentId(''); setParentContact(''); setCommType('call'); setContactedAt('')
        setSubject(''); setNotes(''); setOutcome('completed'); setFollowUp('no'); setUrgency('routine')
    }

    const FOLLOW_UP_DAYS = { no: null, '1day': 1, '3days': 3, nextweek: 7 }

    async function handleSubmit() {
        if (!studentId || !parentContact.trim() || !subject.trim()) return
        setSaving(true); setSaveError(null)
        try {
            const days = FOLLOW_UP_DAYS[followUp]
            let followUpDate = null
            if (days) {
                const d = new Date()
                d.setDate(d.getDate() + days)
                followUpDate = d.toISOString().slice(0, 10)
            }
            await sendParentComm({
                student_id: studentId,
                parent_contact: parentContact.trim(),
                comm_type: commType,
                contacted_at: contactedAt || new Date().toISOString(),
                subject: subject.trim(),
                notes: notes.trim(),
                outcome,
                urgency,
                follow_up_required: days != null,
                follow_up_date: followUpDate,
            })
            resetForm()
            load()
        } catch (e) {
            setSaveError(e?.response?.data?.error || e?.message || 'Failed to save log.')
        } finally {
            setSaving(false)
        }
    }

    if (loading) return <p style={{ padding: '2rem' }}>Loading...</p>
    if (error) return <p style={{ padding: '2rem', color: 'var(--danger)' }}>Error: {error}</p>

    const commsStats = [
        { iconClass: 'calls',   icon: 'call',    value: data.stats.calls_this_month, label: 'Calls This Month' },
        { iconClass: 'sms',     icon: 'sms',     value: data.stats.sms_sent,         label: 'SMS Sent'         },
        { iconClass: 'email',   icon: 'mail',    value: data.stats.emails_sent,      label: 'Emails Sent'      },
        { iconClass: 'pending', icon: 'pending', value: data.stats.awaiting_reply,   label: 'Awaiting Reply'   },
    ]

    const TYPE_ICON = { call: 'call', sms: 'sms', email: 'mail', visit: 'person', letter: 'mail' }

    const commLog = data.log.map(entry => ({
        typeClass: entry.comm_type,
        typeIcon: TYPE_ICON[entry.comm_type] || 'call',
        student: entry.student_name,
        parent: entry.parent_contact,
        subject: entry.subject,
        notes: entry.notes,
        meta: `${new Date(entry.contacted_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}${entry.follow_up_required ? ' · Follow-up due ' + entry.follow_up_date : ''}`,
        ...(OUTCOME_DISPLAY[entry.outcome] || OUTCOME_DISPLAY.completed),
    }))

    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>

            <div className="dashboard-layout">
                <Sidebar navItems={matronNavItems} secondaryItems={matronSecondaryItems} />

                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title="Parent Communications"
                        subtitle={`Log and track all parent contact — ${matronUser.userRole.split('—').pop().trim()}`}
                        {...sessionUser}
                        notifications={liveNotifications}
                        onNotificationRead={markRead}
                    />

                    <DashboardContent>

                        <div className="comms-stats">
                            {commsStats.map((stat, index) => (
                                <CommsStat key={index} {...stat} />
                            ))}
                        </div>

                        <div className="card mb-1-5">
                            <div className="card-header">
                                <h3 className="card-title"><span className="material-symbols-rounded">add_comment</span> Log New Communication</h3>
                            </div>
                            <div className="card-content">
                                <div className="comms-form-grid">
                                    <div>
                                        <label>Student</label>
                                        <select value={studentId} onChange={e => setStudentId(e.target.value)}>
                                            <option value="">— Select student —</option>
                                            {students.map(s => (
                                                <option key={s.student_pk} value={s.student_pk}>
                                                    {s.full_name} (S{s.grade}{s.section})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label>Parent / Guardian Contacted</label>
                                        <input type="text" placeholder="e.g. Mr. John Doe (father)" value={parentContact} onChange={e => setParentContact(e.target.value)} />
                                    </div>
                                    <div>
                                        <label>Communication Type</label>
                                        <select value={commType} onChange={e => setCommType(e.target.value)}>
                                            <option value="call">Phone Call</option>
                                            <option value="sms">SMS / WhatsApp</option>
                                            <option value="email">Email</option>
                                            <option value="visit">In-Person Visit</option>
                                            <option value="letter">Letter</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label>Date &amp; Time</label>
                                        <input type="datetime-local" value={contactedAt} onChange={e => setContactedAt(e.target.value)} />
                                    </div>
                                    <div>
                                        <label>Reason / Subject</label>
                                        <input type="text" placeholder="e.g. Health update, Conduct concern, Welfare check…" value={subject} onChange={e => setSubject(e.target.value)} />
                                    </div>
                                    <div>
                                        <label>Outcome / Status</label>
                                        <select value={outcome} onChange={e => setOutcome(e.target.value)}>
                                            <option value="completed">Completed &mdash; parent informed</option>
                                            <option value="no_answer">No Answer &mdash; will retry</option>
                                            <option value="message_left">Message Left</option>
                                            <option value="awaiting_reply">Awaiting Parent Reply</option>
                                            <option value="sms_sent">SMS Sent</option>
                                            <option value="email_sent">Email Sent</option>
                                        </select>
                                    </div>
                                    <div className="full">
                                        <label>Notes</label>
                                        <textarea placeholder="Summary of what was discussed or agreed upon…" value={notes} onChange={e => setNotes(e.target.value)} />
                                    </div>
                                    <div>
                                        <label>Follow-up Required?</label>
                                        <select value={followUp} onChange={e => setFollowUp(e.target.value)}>
                                            <option value="no">No</option>
                                            <option value="1day">Yes &mdash; follow up in 1 day</option>
                                            <option value="3days">Yes &mdash; follow up in 3 days</option>
                                            <option value="nextweek">Yes &mdash; follow up next week</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label>Urgency</label>
                                        <select value={urgency} onChange={e => setUrgency(e.target.value)}>
                                            <option value="routine">Routine</option>
                                            <option value="important">Important</option>
                                            <option value="urgent">Urgent</option>
                                        </select>
                                    </div>
                                </div>
                                {saveError && <p style={{ color: '#dc2626', fontSize: '0.85rem' }}>{saveError}</p>}
                                <div className="btn-row mt-1-5">
                                    <button className="btn btn-primary" onClick={handleSubmit} disabled={saving || !studentId || !parentContact.trim() || !subject.trim()}>
                                        <span className="material-symbols-rounded">save</span> {saving ? 'Saving…' : 'Save Log'}
                                    </button>
                                    <button className="btn btn-outline" onClick={resetForm}>Clear</button>
                                </div>
                            </div>
                        </div>

                        <div className="card">
                            <div className="card-header">
                                <h3 className="card-title"><span className="material-symbols-rounded">history</span> Communication Log</h3>
                                <button className="btn btn-outline btn-sm"><span className="material-symbols-rounded">download</span> Export</button>
                            </div>
                            <div className="card-content">
                                <div className="comms-filter-bar">
                                    <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
                                        <option value="">All Types</option>
                                        <option value="call">Phone Call</option>
                                        <option value="sms">SMS / WhatsApp</option>
                                        <option value="email">Email</option>
                                        <option value="visit">In-Person Visit</option>
                                    </select>
                                    <select value={outcomeFilter} onChange={e => setOutcomeFilter(e.target.value)}>
                                        <option value="">All Statuses</option>
                                        <option value="completed">Completed</option>
                                        <option value="awaiting_reply">Pending Reply</option>
                                        <option value="no_answer">No Answer</option>
                                        <option value="sms_sent">Sent</option>
                                    </select>
                                    <select value={studentFilter} onChange={e => setStudentFilter(e.target.value)}>
                                        <option value="">All Students</option>
                                        {students.map(s => (
                                            <option key={s.student_pk} value={s.student_pk}>{s.full_name}</option>
                                        ))}
                                    </select>
                                    <select value={periodFilter} onChange={e => setPeriodFilter(e.target.value)}>
                                        <option value="">All Time</option>
                                        <option value="this_month">This Month</option>
                                        <option value="last_month">Last Month</option>
                                        <option value="last_3_months">Last 3 Months</option>
                                    </select>
                                </div>

                                <div className="comms-list">
                                    {commLog.length === 0
                                        ? <p style={{ color: 'var(--muted-foreground)', fontSize: '0.875rem' }}>No communications logged yet.</p>
                                        : commLog.map((entry, index) => <CommEntry key={index} {...entry} />)}
                                </div>
                            </div>
                        </div>

                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
