import { useEffect, useState } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { PageSkeleton } from '../../components/layout/PageSkeleton'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/matron.css'
import { matronNavItems, matronSecondaryItems } from './matronNav'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { getParentComms, sendParentComm, getMatronStudents } from '../../api/matron'
import { useSessionUser } from '../../hooks/useSessionUser'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useNotifications } from '../../hooks/useNotifications'
import { useMatronDormitory } from '../../hooks/useMatronDormitory'
import { SkeletonList } from '../../components/ui/Skeleton'
import { formatDateTime } from '../../utils/date'


const OUTCOME_DISPLAY = {
    completed:      { statusClass: 'completed', statusKey: 'matron.parentComms.outcomeCompleted'   },
    no_answer:      { statusClass: 'pending',   statusKey: 'matron.parentComms.outcomeNoAnswer'    },
    message_left:   { statusClass: 'sent',      statusKey: 'matron.parentComms.outcomeMessageLeft' },
    awaiting_reply: { statusClass: 'pending',   statusKey: 'matron.parentComms.outcomePendingReply' },
    sms_sent:       { statusClass: 'sent',      statusKey: 'matron.parentComms.outcomeSent'        },
    email_sent:     { statusClass: 'sent',      statusKey: 'matron.parentComms.outcomeSent'        },
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

function CommEntry({ typeClass, typeIcon, student, parent, subject, notes, meta, statusClass, statusKey }) {
    const { t } = useTranslation()
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
                <span className={`comm-status-badge ${statusClass}`}>{t(statusKey)}</span>
            </div>
        </div>
    )
}

export function MatronParentComms() {
    const dormitory = useMatronDormitory()
    const { t } = useTranslation()
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
            setSaveError(e?.response?.data?.error || e?.message || t('matron.parentComms.saveFailed'))
        } finally {
            setSaving(false)
        }
    }

    if (loading) return (
        <PageSkeleton
            navItems={matronNavItems} secondaryItems={matronSecondaryItems}
            title={t('matron.parentComms.title')}
            user={sessionUser}
        >
            <SkeletonList items={5} />
        </PageSkeleton>
    )
    if (error) return <p className="u-pad u-danger">{t('common.errorPrefix')}: {error}</p>

    const commsStats = [
        { iconClass: 'calls',   icon: 'call',    value: data.stats.calls_this_month, label: t('matron.parentComms.callsThisMonth') },
        { iconClass: 'sms',     icon: 'sms',     value: data.stats.sms_sent,         label: t('matron.parentComms.smsSent')        },
        { iconClass: 'email',   icon: 'mail',    value: data.stats.emails_sent,      label: t('matron.parentComms.emailsSent')     },
        { iconClass: 'pending', icon: 'pending', value: data.stats.awaiting_reply,   label: t('matron.parentComms.awaitingReply')  },
    ]

    const TYPE_ICON = { call: 'call', sms: 'sms', email: 'mail', visit: 'person', letter: 'mail' }

    const commLog = data.log.map(entry => ({
        typeClass: entry.comm_type,
        typeIcon: TYPE_ICON[entry.comm_type] || 'call',
        student: entry.student_name,
        parent: entry.parent_contact,
        subject: entry.subject,
        notes: entry.notes,
        meta: formatDateTime(entry.contacted_at)
            + (entry.follow_up_required
                ? ' · ' + t('matron.parentComms.followUpDue', { date: entry.follow_up_date })
                : ''),
        ...(OUTCOME_DISPLAY[entry.outcome] || OUTCOME_DISPLAY.completed),
    }))

    return (
        <>
            <a href="#main-content" className="skip-link">{t('common.skipToContent')}</a>
            <div className="sidebar-overlay"></div>

            <div className="dashboard-layout">
                <Sidebar navItems={matronNavItems} secondaryItems={matronSecondaryItems} />

                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title={t('matron.parentComms.title')}
                        subtitle={dormitory
                            ? t('matron.parentComms.subtitle', { house: dormitory })
                            : t('matron.parentComms.subtitleNoHouse')}
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
                                <h3 className="card-title"><span className="material-symbols-rounded">add_comment</span> {t('matron.parentComms.logNew')}</h3>
                            </div>
                            <div className="card-content">
                                <div className="comms-form-grid">
                                    <div>
                                        <label>{t('common.student')}</label>
                                        <select value={studentId} onChange={e => setStudentId(e.target.value)}>
                                            <option value="">{t('common.selectStudent')}</option>
                                            {students.map(s => (
                                                <option key={s.student_pk} value={s.student_pk}>
                                                    {s.full_name} (S{s.grade}{s.section})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label>{t('matron.parentComms.contacted')}</label>
                                        <input type="text" placeholder={t('matron.parentComms.egParent')} value={parentContact} onChange={e => setParentContact(e.target.value)} />
                                    </div>
                                    <div>
                                        <label>{t('matron.parentComms.commType')}</label>
                                        <select value={commType} onChange={e => setCommType(e.target.value)}>
                                            <option value="call">{t('matron.parentComms.typeCall')}</option>
                                            <option value="sms">{t('matron.parentComms.typeSms')}</option>
                                            <option value="email">{t('common.email')}</option>
                                            <option value="visit">{t('matron.parentComms.typeVisit')}</option>
                                            <option value="letter">{t('matron.parentComms.typeLetter')}</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label>{t('common.dateTime')}</label>
                                        <input type="datetime-local" value={contactedAt} onChange={e => setContactedAt(e.target.value)} />
                                    </div>
                                    <div>
                                        <label>{t('matron.parentComms.reason')}</label>
                                        <input type="text" placeholder={t('matron.parentComms.egReason')} value={subject} onChange={e => setSubject(e.target.value)} />
                                    </div>
                                    <div>
                                        <label>{t('matron.parentComms.outcome')}</label>
                                        <select value={outcome} onChange={e => setOutcome(e.target.value)}>
                                            <option value="completed">{t('matron.parentComms.optCompleted')}</option>
                                            <option value="no_answer">{t('matron.parentComms.optNoAnswer')}</option>
                                            <option value="message_left">{t('matron.parentComms.optMessageLeft')}</option>
                                            <option value="awaiting_reply">{t('matron.parentComms.optAwaitingReply')}</option>
                                            <option value="sms_sent">{t('matron.parentComms.optSmsSent')}</option>
                                            <option value="email_sent">{t('matron.parentComms.optEmailSent')}</option>
                                        </select>
                                    </div>
                                    <div className="full">
                                        <label>{t('common.notes')}</label>
                                        <textarea placeholder={t('matron.parentComms.notesPlaceholder')} value={notes} onChange={e => setNotes(e.target.value)} />
                                    </div>
                                    <div>
                                        <label>{t('matron.parentComms.followUpRequired')}</label>
                                        <select value={followUp} onChange={e => setFollowUp(e.target.value)}>
                                            <option value="no">{t('common.no')}</option>
                                            <option value="1day">{t('matron.parentComms.followUp1Day')}</option>
                                            <option value="3days">{t('matron.parentComms.followUp3Days')}</option>
                                            <option value="nextweek">{t('matron.parentComms.followUpNextWeek')}</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label>{t('matron.parentComms.urgency')}</label>
                                        <select value={urgency} onChange={e => setUrgency(e.target.value)}>
                                            <option value="routine">{t('common.routine')}</option>
                                            <option value="important">{t('common.important')}</option>
                                            <option value="urgent">{t('common.urgent')}</option>
                                        </select>
                                    </div>
                                </div>
                                {saveError && <p className="u-danger u-fs-085">{saveError}</p>}
                                <div className="btn-row mt-1-5">
                                    <button className="btn btn-primary" onClick={handleSubmit} disabled={saving || !studentId || !parentContact.trim() || !subject.trim()}>
                                        <span className="material-symbols-rounded">save</span> {saving ? t('common.saving') : t('matron.parentComms.saveLog')}
                                    </button>
                                    <button className="btn btn-outline" onClick={resetForm}>{t('common.clear')}</button>
                                </div>
                            </div>
                        </div>

                        <div className="card">
                            <div className="card-header">
                                <h3 className="card-title"><span className="material-symbols-rounded">history</span> {t('matron.parentComms.log')}</h3>
                                <button className="btn btn-outline btn-sm"><span className="material-symbols-rounded">download</span> {t('common.export')}</button>
                            </div>
                            <div className="card-content">
                                <div className="comms-filter-bar">
                                    <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
                                        <option value="">{t('matron.parentComms.allTypes')}</option>
                                        <option value="call">{t('matron.parentComms.typeCall')}</option>
                                        <option value="sms">{t('matron.parentComms.typeSms')}</option>
                                        <option value="email">{t('common.email')}</option>
                                        <option value="visit">{t('matron.parentComms.typeVisit')}</option>
                                    </select>
                                    <select value={outcomeFilter} onChange={e => setOutcomeFilter(e.target.value)}>
                                        <option value="">{t('matron.parentComms.allStatuses')}</option>
                                        <option value="completed">{t('common.completed')}</option>
                                        <option value="awaiting_reply">{t('matron.parentComms.outcomePendingReply')}</option>
                                        <option value="no_answer">{t('matron.parentComms.outcomeNoAnswer')}</option>
                                        <option value="sms_sent">{t('common.sent')}</option>
                                    </select>
                                    <select value={studentFilter} onChange={e => setStudentFilter(e.target.value)}>
                                        <option value="">{t('common.allStudents')}</option>
                                        {students.map(s => (
                                            <option key={s.student_pk} value={s.student_pk}>{s.full_name}</option>
                                        ))}
                                    </select>
                                    <select value={periodFilter} onChange={e => setPeriodFilter(e.target.value)}>
                                        <option value="">{t('common.allTime')}</option>
                                        <option value="this_month">{t('common.thisMonth')}</option>
                                        <option value="last_month">{t('common.lastMonth')}</option>
                                        <option value="last_3_months">{t('common.last3Months')}</option>
                                    </select>
                                </div>

                                <div className="comms-list">
                                    {commLog.length === 0
                                        ? <p className="u-muted u-sm">{t('matron.parentComms.empty')}</p>
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
