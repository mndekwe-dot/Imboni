import { useEffect, useState } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { PageLoading } from '../../components/layout/PageLoading'
import { useTranslation } from 'react-i18next'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/discipline.css'
import { disNavItems, disSecondaryItems } from './disNav'
import { DashboardContent } from '../../components/layout/DashboardContent'
import {
    getDisParentComms, sendDisParentComm, searchDisStudents,
} from '../../api/discipline'
import { useSessionUser } from '../../hooks/useSessionUser'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useNotifications } from '../../hooks/useNotifications'
import { formatDateTime } from '../../utils/date'
import { StatCard } from '../../components/layout/StatCard'
import { FormSelect } from '../../components/ui/FormSelect'
import { StudentSearchPicker } from '../../components/ui/StudentSearchPicker'
import { EmptyState } from '../../components/ui/EmptyState'

/**
 * The log of what the school has said to a family, and about whom.
 *
 * This lived in the Matron portal. Deciding that a parent should be called —
 * and being the person who calls — is the Discipline Master's authority: a
 * matron reports what happened in the dormitory and the office decides how the
 * family hears about it. The record follows the authority.
 */

const OUTCOME_DISPLAY = {
    completed:      { statusClass: 'completed', statusKey: 'dis.parentComms.outcomeCompleted'    },
    no_answer:      { statusClass: 'pending',   statusKey: 'dis.parentComms.outcomeNoAnswer'     },
    message_left:   { statusClass: 'sent',      statusKey: 'dis.parentComms.outcomeMessageLeft'  },
    awaiting_reply: { statusClass: 'pending',   statusKey: 'dis.parentComms.outcomePendingReply' },
    sms_sent:       { statusClass: 'sent',      statusKey: 'dis.parentComms.outcomeSent'         },
    email_sent:     { statusClass: 'sent',      statusKey: 'dis.parentComms.outcomeSent'         },
}

const TYPE_ICON = { call: 'call', sms: 'sms', email: 'mail', visit: 'person', letter: 'mail' }

const COMM_TYPES = [
    { value: 'call',   labelKey: 'dis.parentComms.typeCall'   },
    { value: 'sms',    labelKey: 'dis.parentComms.typeSms'    },
    { value: 'email',  labelKey: 'common.email'               },
    { value: 'visit',  labelKey: 'dis.parentComms.typeVisit'  },
    { value: 'letter', labelKey: 'dis.parentComms.typeLetter' },
]

const OUTCOMES = [
    { value: 'completed',      labelKey: 'dis.parentComms.optCompleted'     },
    { value: 'no_answer',      labelKey: 'dis.parentComms.optNoAnswer'      },
    { value: 'message_left',   labelKey: 'dis.parentComms.optMessageLeft'   },
    { value: 'awaiting_reply', labelKey: 'dis.parentComms.optAwaitingReply' },
    { value: 'sms_sent',       labelKey: 'dis.parentComms.optSmsSent'       },
    { value: 'email_sent',     labelKey: 'dis.parentComms.optEmailSent'     },
]

const FOLLOW_UPS = [
    { value: 'no',       labelKey: 'common.no'                        },
    { value: '1day',     labelKey: 'dis.parentComms.followUp1Day'     },
    { value: '3days',    labelKey: 'dis.parentComms.followUp3Days'    },
    { value: 'nextweek', labelKey: 'dis.parentComms.followUpNextWeek' },
]

const URGENCIES = [
    { value: 'routine',   labelKey: 'common.routine'   },
    { value: 'important', labelKey: 'common.important' },
    { value: 'urgent',    labelKey: 'common.urgent'    },
]

const TYPE_FILTERS = [
    { value: '',      labelKey: 'dis.parentComms.allTypes'   },
    { value: 'call',  labelKey: 'dis.parentComms.typeCall'   },
    { value: 'sms',   labelKey: 'dis.parentComms.typeSms'    },
    { value: 'email', labelKey: 'common.email'               },
    { value: 'visit', labelKey: 'dis.parentComms.typeVisit'  },
]

const OUTCOME_FILTERS = [
    { value: '',               labelKey: 'dis.parentComms.allStatuses'         },
    { value: 'completed',      labelKey: 'common.completed'                    },
    { value: 'awaiting_reply', labelKey: 'dis.parentComms.outcomePendingReply' },
    { value: 'no_answer',      labelKey: 'dis.parentComms.outcomeNoAnswer'     },
    { value: 'sms_sent',       labelKey: 'common.sent'                         },
]

const PERIOD_FILTERS = [
    { value: '',              labelKey: 'common.allTime'      },
    { value: 'this_month',    labelKey: 'common.thisMonth'    },
    { value: 'last_month',    labelKey: 'common.lastMonth'    },
    { value: 'last_3_months', labelKey: 'common.last3Months'  },
]

const FOLLOW_UP_DAYS = { no: null, '1day': 1, '3days': 3, nextweek: 7 }

function CommEntry({ typeClass, typeIcon, student, parent, subject, notes, meta, statusClass, statusKey }) {
    const { t } = useTranslation()
    return (
        <div className="dis-comm-entry">
            <div className={`dis-comm-type-icon ${typeClass}`}>
                <span className="material-symbols-rounded">{typeIcon}</span>
            </div>
            <div className="dis-comm-body">
                <div className="dis-comm-header">
                    <span className="dis-comm-student">{student}</span>
                    <span className="dis-comm-parent">&rarr; {parent}</span>
                </div>
                <div className="dis-comm-subject">{subject}</div>
                <div className="dis-comm-notes">{notes}</div>
                <div className="dis-comm-meta">{meta}</div>
            </div>
            <div className="dis-comm-right">
                <span className={`dis-comm-status-badge ${statusClass}`}>{t(statusKey)}</span>
            </div>
        </div>
    )
}

export function DisParentComms() {
    const { t } = useTranslation()
    const sessionUser = useSessionUser()
    const { notifications: liveNotifications, markRead } = useNotifications()
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    const [typeFilter, setTypeFilter] = useState('')
    const [outcomeFilter, setOutcomeFilter] = useState('')
    const [studentFilter, setStudentFilter] = useState(null)
    const [periodFilter, setPeriodFilter] = useState('')

    const [student, setStudent] = useState(null)
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
        if (studentFilter) params.student_id = studentFilter.id ?? studentFilter.student_pk
        if (periodFilter) params.period = periodFilter
        getDisParentComms(params)
            .then(setData)
            .catch(err => setError(err.message))
            .finally(() => setLoading(false))
    }

    useEffect(() => {
        load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [typeFilter, outcomeFilter, studentFilter, periodFilter])

    function resetForm() {
        setStudent(null); setParentContact(''); setCommType('call'); setContactedAt('')
        setSubject(''); setNotes(''); setOutcome('completed'); setFollowUp('no'); setUrgency('routine')
    }

    async function handleSubmit() {
        if (!student || !parentContact.trim() || !subject.trim()) return
        setSaving(true); setSaveError(null)
        try {
            const days = FOLLOW_UP_DAYS[followUp]
            let followUpDate = null
            if (days) {
                const d = new Date()
                d.setDate(d.getDate() + days)
                followUpDate = d.toISOString().slice(0, 10)
            }
            await sendDisParentComm({
                student_id: student.id ?? student.student_pk,
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
            setSaveError(e?.response?.data?.error || e?.message || t('dis.parentComms.saveFailed'))
        } finally {
            setSaving(false)
        }
    }

    const opts = list => list.map(o => ({ value: o.value, label: t(o.labelKey) }))

    if (loading) return (
        <PageLoading
            navItems={disNavItems} secondaryItems={disSecondaryItems}
            title={t('dis.parentComms.title')}
            user={sessionUser}
        />
    )
    if (error) return <p className="u-pad u-danger">{t('common.errorPrefix')}: {error}</p>

    const commsStats = [
        { iconClass: 'calls',   icon: 'call',    value: data.stats.calls_this_month, label: t('dis.parentComms.callsThisMonth') },
        { iconClass: 'sms',     icon: 'sms',     value: data.stats.sms_sent,         label: t('dis.parentComms.smsSent')        },
        { iconClass: 'email',   icon: 'mail',    value: data.stats.emails_sent,      label: t('dis.parentComms.emailsSent')     },
        { iconClass: 'pending', icon: 'pending', value: data.stats.awaiting_reply,   label: t('dis.parentComms.awaitingReply')  },
    ]

    const commLog = data.log.map(entry => ({
        typeClass: entry.comm_type,
        typeIcon: TYPE_ICON[entry.comm_type] || 'call',
        student: entry.student_name,
        parent: entry.parent_contact,
        subject: entry.subject,
        notes: entry.notes,
        meta: formatDateTime(entry.contacted_at)
            + (entry.follow_up_required
                ? ' · ' + t('dis.parentComms.followUpDue', { date: entry.follow_up_date })
                : ''),
        ...(OUTCOME_DISPLAY[entry.outcome] || OUTCOME_DISPLAY.completed),
    }))

    return (
        <>
            <a href="#main-content" className="skip-link">{t('common.skipToContent')}</a>
            <div className="sidebar-overlay"></div>

            <div className="dashboard-layout">
                <Sidebar navItems={disNavItems} secondaryItems={disSecondaryItems} />

                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title={t('dis.parentComms.title')}
                        subtitle={t('dis.parentComms.subtitleSchool')}
                        {...sessionUser}
                        notifications={liveNotifications}
                        onNotificationRead={markRead}
                    />

                    <DashboardContent>

                        <div className="portal-stat-grid mb-5">
                            {commsStats.map((stat, index) => (
                                <StatCard key={index} icon={stat.icon} value={stat.value}
                                          label={stat.label} colorClass={stat.iconClass} />
                            ))}
                        </div>

                        <div className="card mb-1-5">
                            <div className="card-header">
                                <h3 className="card-title">
                                    <span className="material-symbols-rounded">add_comment</span>
                                    {' '}{t('dis.parentComms.logNew')}
                                </h3>
                            </div>
                            <div className="card-content">
                                <div className="dis-comms-form-grid">
                                    <StudentSearchPicker
                                        value={student}
                                        onChange={setStudent}
                                        fetchStudents={searchDisStudents}
                                        required
                                    />
                                    <div className="form-group">
                                        <label className="form-label" htmlFor="pc-contact">
                                            {t('dis.parentComms.contacted')}
                                        </label>
                                        <input id="pc-contact" className="form-input" type="text"
                                            placeholder={t('dis.parentComms.egParent')}
                                            value={parentContact}
                                            onChange={e => setParentContact(e.target.value)} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label" htmlFor="pc-type">
                                            {t('dis.parentComms.commType')}
                                        </label>
                                        <FormSelect id="pc-type" value={commType}
                                            onChange={setCommType} options={opts(COMM_TYPES)} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label" htmlFor="pc-when">
                                            {t('common.dateTime')}
                                        </label>
                                        <input id="pc-when" className="form-input" type="datetime-local"
                                            value={contactedAt}
                                            onChange={e => setContactedAt(e.target.value)} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label" htmlFor="pc-reason">
                                            {t('dis.parentComms.reason')}
                                        </label>
                                        <input id="pc-reason" className="form-input" type="text"
                                            placeholder={t('dis.parentComms.egReason')}
                                            value={subject}
                                            onChange={e => setSubject(e.target.value)} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label" htmlFor="pc-outcome">
                                            {t('dis.parentComms.outcome')}
                                        </label>
                                        <FormSelect id="pc-outcome" value={outcome}
                                            onChange={setOutcome} options={opts(OUTCOMES)} />
                                    </div>
                                    <div className="form-group u-col-span-full">
                                        <label className="form-label" htmlFor="pc-notes">
                                            {t('common.notes')}
                                        </label>
                                        <textarea id="pc-notes" className="form-input form-textarea"
                                            placeholder={t('dis.parentComms.notesPlaceholder')}
                                            value={notes}
                                            onChange={e => setNotes(e.target.value)} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label" htmlFor="pc-followup">
                                            {t('dis.parentComms.followUpRequired')}
                                        </label>
                                        <FormSelect id="pc-followup" value={followUp}
                                            onChange={setFollowUp} options={opts(FOLLOW_UPS)} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label" htmlFor="pc-urgency">
                                            {t('dis.parentComms.urgency')}
                                        </label>
                                        <FormSelect id="pc-urgency" value={urgency}
                                            onChange={setUrgency} options={opts(URGENCIES)} />
                                    </div>
                                </div>
                                {saveError && <p className="u-danger u-fs-085">{saveError}</p>}
                                <div className="btn-row mt-1-5">
                                    <button className="btn btn-primary" onClick={handleSubmit}
                                        disabled={saving || !student || !parentContact.trim() || !subject.trim()}>
                                        <span className="material-symbols-rounded">save</span>
                                        {' '}{saving ? t('common.saving') : t('dis.parentComms.saveLog')}
                                    </button>
                                    <button className="btn btn-outline" onClick={resetForm}>
                                        {t('common.clear')}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="card">
                            <div className="card-header">
                                <h3 className="card-title">
                                    <span className="material-symbols-rounded">history</span>
                                    {' '}{t('dis.parentComms.log')}
                                </h3>
                            </div>
                            <div className="card-content">
                                <div className="dis-comms-filter-bar">
                                    <FormSelect value={typeFilter} onChange={setTypeFilter}
                                        options={opts(TYPE_FILTERS)}
                                        ariaLabel={t('dis.parentComms.allTypes')} />
                                    <FormSelect value={outcomeFilter} onChange={setOutcomeFilter}
                                        options={opts(OUTCOME_FILTERS)}
                                        ariaLabel={t('dis.parentComms.allStatuses')} />
                                    <StudentSearchPicker
                                        value={studentFilter}
                                        onChange={setStudentFilter}
                                        fetchStudents={searchDisStudents}
                                        label={t('common.allStudents')}
                                        placeholder={t('common.allStudents')}
                                        hideLabel
                                    />
                                    <FormSelect value={periodFilter} onChange={setPeriodFilter}
                                        options={opts(PERIOD_FILTERS)}
                                        ariaLabel={t('common.allTime')} />
                                </div>

                                <div className="dis-comms-list">
                                    {commLog.length === 0
                                        ? <EmptyState icon="forum" title={t('dis.parentComms.empty')} />
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
