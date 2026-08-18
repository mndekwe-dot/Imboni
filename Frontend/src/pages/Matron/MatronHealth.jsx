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
import { SkeletonTable } from '../../components/ui/Skeleton'
import {
    getMatronHealth, createHealthRecord, updateHealthRecord, getMatronStudents,
    getMedicationsToday, administerMedication, createMedication,
} from '../../api/matron'
import { useSessionUser } from '../../hooks/useSessionUser'
import { OfflineIndicator } from '../../components/ui/OfflineIndicator'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useNotifications } from '../../hooks/useNotifications'
import { useMatronDormitory } from '../../hooks/useMatronDormitory'
import { formatDate } from '../../utils/date'


const conditionKeys = {
    illness:  'matron.health.condIllness',
    injury:   'matron.health.condInjury',
    checkup:  'matron.health.condCheckup',
    followup: 'matron.health.condFollowup',
}

const VISIT_TYPE_TO_CONDITION = {
    sickbay_admission: 'illness',
    medication:        'illness',
    routine_checkup:   'checkup',
    follow_up:         'followup',
    injury:            'injury',
    discharge:         'illness',
}

const STATUS_DISPLAY = {
    in_sick_bay: { statusClass: 'pending',  statusKey: 'matron.health.statusInSickBay' },
    observation: { statusClass: 'pending',  statusKey: 'matron.health.statusObservation' },
    cleared:     { statusClass: 'reviewed', statusKey: 'matron.health.statusCleared' },
}

function HealthStat({ iconClass, icon, value, label }) {
    return (
        <div className="health-stat-card">
            <div className={`health-stat-icon ${iconClass}`}><span className="material-symbols-rounded">{icon}</span></div>
            <div>
                <div className="health-stat-value">{value}</div>
                <div className="health-stat-label">{label}</div>
            </div>
        </div>
    )
}

function BedCard({ bed, badgeClass, badge, student, condition, since, isEmpty, recordId, onDischarge, discharging }) {
    const { t } = useTranslation()
    return (
        <div className={`bed-card ${badgeClass}`}>
            <span className={`bed-badge ${badgeClass}`}>{badge}</span>
            <div className="bed-number">{bed}</div>
            {isEmpty ? (
                <div className="bed-empty-label">{t('common.empty')}</div>
            ) : (
                <>
                    <div className="bed-student">{student}</div>
                    <div className="bed-condition">{condition}</div>
                    <div className="bed-since">{since}</div>
                    <div className="btn-row-sm bed-card-actions">
                        <button
                            className="btn btn-sm btn-discharge"
                            onClick={() => onDischarge(recordId)}
                            disabled={discharging}
                        >
                            {discharging ? t('matron.health.discharging') : t('matron.health.discharge')}
                        </button>
                    </div>
                </>
            )}
        </div>
    )
}

function HealthHistoryRow({ date, name, conditionTag, complaint, temp, action, statusClass, statusKey }) {
    const { t } = useTranslation()
    return (
        <tr>
            <td>{date}</td>
            <td><strong>{name}</strong></td>
            <td><span className={`condition-tag ${conditionTag}`}>{t(conditionKeys[conditionTag])}</span></td>
            <td>{complaint}</td>
            <td>{temp}</td>
            <td>{action}</td>
            <td><span className={`matron-report-status ${statusClass}`}>{t(statusKey)}</span></td>
        </tr>
    )
}

function MedicationChecklist({ students }) {
    const { t } = useTranslation()
    const [checklist, setChecklist] = useState(null)
    const [giving, setGiving]       = useState(null)     // "scheduleId|time" in flight
    const [showAdd, setShowAdd]     = useState(false)
    const [form, setForm] = useState({ student_id: '', medicine_name: '', dosage: '', times: '08:00', start_date: '', end_date: '' })
    const [saveError, setSaveError] = useState(null)
    const [saving, setSaving]       = useState(false)

    function load() {
        getMedicationsToday()
            .then(setChecklist)
            .catch(() => setChecklist({ items: [], total: 0, given: 0, overdue: 0 }))
    }

    useEffect(() => { load() }, [])

    async function handleGive(item) {
        const key = `${item.schedule_id}|${item.time}`
        setGiving(key)
        try {
            const res = await administerMedication(item.schedule_id, { time: item.time })
            if (res?.queued) {
                // Offline — the dose is in the sync outbox; tick it locally so
                // the checklist reflects what actually happened in the dorm.
                setChecklist(prev => prev && ({
                    ...prev,
                    given: prev.given + 1,
                    overdue: item.overdue ? prev.overdue - 1 : prev.overdue,
                    items: prev.items.map(i =>
                        i.schedule_id === item.schedule_id && i.time === item.time
                            ? { ...i, given: true, overdue: false }
                            : i),
                }))
            } else {
                load()
            }
        } finally {
            setGiving(null)
        }
    }

    async function handleAdd() {
        const times = form.times.split(',').map(s => s.trim()).filter(Boolean)
        if (!form.student_id || !form.medicine_name.trim() || !form.dosage.trim() || !form.start_date || times.length === 0) {
            setSaveError(t('matron.health.medFormRequired'))
            return
        }
        setSaving(true); setSaveError(null)
        try {
            await createMedication({
                student_id: form.student_id,
                medicine_name: form.medicine_name.trim(),
                dosage: form.dosage.trim(),
                times,
                start_date: form.start_date,
                end_date: form.end_date || null,
            })
            setForm({ student_id: '', medicine_name: '', dosage: '', times: '08:00', start_date: '', end_date: '' })
            setShowAdd(false)
            load()
        } catch (e) {
            setSaveError(e?.response?.data?.error || t('matron.health.saveScheduleFailed'))
        } finally {
            setSaving(false)
        }
    }

    const items = checklist?.items || []

    return (
        <div className="card mb-1-5">
            <div className="card-header">
                <h3 className="card-title"><span className="material-symbols-rounded">medication</span> {t('matron.health.todayMedication')}</h3>
                <div className="u-row">
                    <OfflineIndicator />
                    {checklist && (
                        <span className="settings-info-text align-self-center">
                            {t('matron.health.givenCount', { given: checklist.given, total: checklist.total })}
                            {checklist.overdue > 0 && <span className="u-danger"> &middot; {t('matron.health.overdueCount', { count: checklist.overdue })}</span>}
                        </span>
                    )}
                    <button className="btn btn-outline btn-sm" onClick={() => setShowAdd(s => !s)}>
                        <span className="material-symbols-rounded icon-sm">add</span>
                        {t('matron.health.addSchedule')}
                    </button>
                </div>
            </div>
            <div className="card-content">
                {showAdd && (
                    <div className="med-add-grid">
                        <div>
                            <label className="form-label" htmlFor="med-student">{t('common.student')}</label>
                            <select id="med-student" className="form-input" value={form.student_id}
                                onChange={e => setForm(f => ({ ...f, student_id: e.target.value }))}>
                                <option value="">{t('common.selectEllipsis')}</option>
                                {students.map(s => <option key={s.id} value={s.id}>{s.name || s.full_name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="form-label" htmlFor="med-name">{t('matron.health.medicine')}</label>
                            <input id="med-name" className="form-input" placeholder={t('matron.health.egMedicine')}
                                value={form.medicine_name} onChange={e => setForm(f => ({ ...f, medicine_name: e.target.value }))} />
                        </div>
                        <div>
                            <label className="form-label" htmlFor="med-dosage">{t('matron.health.dosage')}</label>
                            <input id="med-dosage" className="form-input" placeholder={t('matron.health.egDosage')}
                                value={form.dosage} onChange={e => setForm(f => ({ ...f, dosage: e.target.value }))} />
                        </div>
                        <div>
                            <label className="form-label" htmlFor="med-times">{t('matron.health.times')}</label>
                            <input id="med-times" className="form-input" placeholder="08:00, 13:00, 20:00"
                                value={form.times} onChange={e => setForm(f => ({ ...f, times: e.target.value }))} />
                        </div>
                        <div>
                            <label className="form-label" htmlFor="med-start">{t('common.start')}</label>
                            <input id="med-start" type="date" className="form-input"
                                value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
                        </div>
                        <div>
                            <label className="form-label" htmlFor="med-end">{t('matron.health.endOptional')}</label>
                            <input id="med-end" type="date" className="form-input"
                                value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
                        </div>
                        <div className="med-add-actions">
                            <button className="btn btn-primary btn-sm" onClick={handleAdd} disabled={saving}>
                                {saving ? t('common.saving') : t('matron.health.saveSchedule')}
                            </button>
                        </div>
                        {saveError && <p className="med-add-error">{saveError}</p>}
                    </div>
                )}

                {!checklist ? (
                    <p className="u-muted">{t('matron.health.loadingChecklist')}</p>
                ) : items.length === 0 ? (
                    <p className="u-muted">{t('matron.health.noMedications')}</p>
                ) : (
                    <div className="med-list">
                        {items.map(item => {
                            const key = `${item.schedule_id}|${item.time}`
                            return (
                                <div key={key} className={`med-item ${item.overdue ? 'overdue' : ''} ${item.given ? 'given' : ''}`}>
                                    <span className="med-time">{item.time}</span>
                                    <div className="med-info">
                                        <div className="u-strong u-sm">{item.student_name}</div>
                                        <div className="med-sub">
                                            {item.medicine_name} · {item.dosage} · S{item.grade}{item.section}
                                        </div>
                                    </div>
                                    {item.given ? (
                                        <span className="med-given">
                                            <span className="material-symbols-rounded">check_circle</span>
                                            {t('common.given')}
                                        </span>
                                    ) : (
                                        <>
                                            {item.overdue && (
                                                <span className="med-overdue-label">{t('common.overdue')}</span>
                                            )}
                                            <button className="btn btn-primary btn-sm"
                                                disabled={giving === key}
                                                onClick={() => handleGive(item)}>
                                                {giving === key ? t('common.saving') : t('matron.health.markGiven')}
                                            </button>
                                        </>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}

export const MatronHealth = () => {
    const { t } = useTranslation()
    const dormitory = useMatronDormitory()
    const sessionUser = useSessionUser()
    const { notifications: liveNotifications, markRead } = useNotifications()
    const [data, setData] = useState(null)
    const [students, setStudents] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [dischargingId, setDischargingId] = useState(null)
    const [historyFilter, setHistoryFilter] = useState('')

    const [studentId, setStudentId] = useState('')
    const [visitType, setVisitType] = useState('sickbay_admission')
    const [visitDateTime, setVisitDateTime] = useState('')
    const [temperature, setTemperature] = useState('')
    const [complaint, setComplaint] = useState('')
    const [actionTaken, setActionTaken] = useState('')
    const [admitChoice, setAdmitChoice] = useState('no')
    const [notifyParent, setNotifyParent] = useState('none')
    const [saving, setSaving] = useState(false)
    const [saveError, setSaveError] = useState(null)

    function load(studentFilter) {
        setLoading(true)
        getMatronHealth(studentFilter ? { student_id: studentFilter } : undefined)
            .then(setData)
            .catch(err => setError(err.message))
            .finally(() => setLoading(false))
    }

    useEffect(() => {
        load(historyFilter)
        getMatronStudents().then(s => setStudents(Array.isArray(s) ? s : [])).catch(() => {})
    }, [historyFilter])

    function resetForm() {
        setStudentId(''); setVisitType('sickbay_admission'); setVisitDateTime('')
        setTemperature(''); setComplaint(''); setActionTaken(''); setAdmitChoice('no'); setNotifyParent('none')
    }

    async function handleSubmit() {
        if (!studentId || !complaint.trim()) return
        setSaving(true); setSaveError(null)
        try {
            await createHealthRecord({
                student_id: studentId,
                visit_type: visitType,
                condition_tag: VISIT_TYPE_TO_CONDITION[visitType] || 'illness',
                visit_datetime: visitDateTime || new Date().toISOString(),
                temperature_c: temperature || null,
                complaint: complaint.trim(),
                action_taken: actionTaken.trim(),
                admitted: admitChoice === 'yes',
                notify_parent: notifyParent,
            })
            resetForm()
            load(historyFilter)
        } catch (e) {
            setSaveError(e?.response?.data?.error || e?.message || t('matron.health.saveRecordFailed'))
        } finally {
            setSaving(false)
        }
    }

    async function handleDischarge(recordId) {
        setDischargingId(recordId)
        try {
            await updateHealthRecord(recordId, { status: 'cleared' })
            load(historyFilter)
        } finally {
            setDischargingId(null)
        }
    }

    if (loading) return (
        <PageSkeleton
            navItems={matronNavItems} secondaryItems={matronSecondaryItems}
            title={t('matron.health.title')}
            user={sessionUser}
        >
            <SkeletonTable rows={6} cols={5} />
        </PageSkeleton>
    )
    if (error) return <p className="u-pad u-danger">{t('common.errorPrefix')}: {error}</p>

    const healthStats = [
        { iconClass: 'sick',     icon: 'sick',          value: data.stats.in_sick_bay_now,    label: t('matron.health.inSickBayNow')     },
        { iconClass: 'recovery', icon: 'healing',       value: data.stats.under_observation,  label: t('matron.health.underObservation') },
        { iconClass: 'visits',   icon: 'calendar_today',value: data.stats.visits_this_month,  label: t('matron.health.visitsThisMonth')  },
        { iconClass: 'cleared',  icon: 'check_circle',  value: data.stats.cleared_this_month, label: t('matron.health.clearedThisMonth') },
    ]

    const healthHistory = data.history.map(r => ({
        date: formatDate(r.visit_datetime),
        name: r.name,
        conditionTag: r.condition_tag,
        complaint: r.complaint,
        temp: r.temperature_c ? `${r.temperature_c} °C` : '-',
        action: r.action_taken || '-',
        ...(STATUS_DISPLAY[r.status] || STATUS_DISPLAY.cleared),
    }))

    return (
        <>
            <a href="#main-content" className="skip-link">{t('common.skipToContent')}</a>
            <div className="sidebar-overlay"></div>

            <div className="dashboard-layout">
                <Sidebar navItems={matronNavItems} secondaryItems={matronSecondaryItems} />

                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title={t('matron.health.title')}
                        subtitle={dormitory
                            ? t('matron.health.subtitle', { house: dormitory })
                            : t('matron.health.subtitleNoHouse')}
                        {...sessionUser}
                        notifications={liveNotifications}
                        onNotificationRead={markRead}
                    />

                    <DashboardContent>

                        <div className="health-stats">
                            {healthStats.map((stat, index) => (
                                <HealthStat key={index} {...stat} />
                            ))}
                        </div>

                        <MedicationChecklist students={students} />

                        <div className="card mb-1-5">
                            <div className="card-header">
                                <h3 className="card-title"><span className="material-symbols-rounded">bed</span> {t('matron.health.sickBayResidents')}</h3>
                                <span className="settings-info-text align-self-center">
                                    {data.stats.beds_total} beds total &middot; {data.stats.beds_occupied} occupied &middot; {data.stats.beds_total - data.stats.beds_occupied} free
                                </span>
                            </div>
                            <div className="card-content">
                                <div className="sickbay-grid">
                                    {data.beds.map((bed, index) => (
                                        <BedCard
                                            key={index}
                                            {...bed}
                                            recordId={bed.record_id}
                                            onDischarge={handleDischarge}
                                            discharging={dischargingId === bed.record_id}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="card mb-1-5">
                            <div className="card-header">
                                <h3 className="card-title"><span className="material-symbols-rounded">add_circle</span> {t('matron.health.logVisit')}</h3>
                            </div>
                            <div className="card-content">
                                <div className="health-form-grid">
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
                                        <label>{t('matron.health.visitType')}</label>
                                        <select value={visitType} onChange={e => setVisitType(e.target.value)}>
                                            <option value="sickbay_admission">{t('matron.health.admission')}</option>
                                            <option value="routine_checkup">{t('matron.health.routineCheckup')}</option>
                                            <option value="medication">{t('matron.health.medicationDispensed')}</option>
                                            <option value="follow_up">{t('matron.health.followUpVisit')}</option>
                                            <option value="injury">{t('matron.health.injury')}</option>
                                            <option value="discharge">{t('matron.health.discharge')}</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label>{t('common.dateTime')}</label>
                                        <input type="datetime-local" value={visitDateTime} onChange={e => setVisitDateTime(e.target.value)} />
                                    </div>
                                    <div>
                                        <label>{t('matron.health.temperature')}</label>
                                        <input type="number" step="0.1" min="35" max="42" placeholder={t('matron.health.egTemperature')} value={temperature} onChange={e => setTemperature(e.target.value)} />
                                    </div>
                                    <div className="full">
                                        <label>{t('matron.health.complaint')}</label>
                                        <input type="text" placeholder={t('matron.health.complaintPlaceholder')} value={complaint} onChange={e => setComplaint(e.target.value)} />
                                    </div>
                                    <div className="full">
                                        <label>{t('matron.health.actionTaken')}</label>
                                        <textarea
                                            placeholder={t('matron.health.actionPlaceholder')}
                                            value={actionTaken}
                                            onChange={e => setActionTaken(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label>{t('matron.health.admitToSickBay')}</label>
                                        <select value={admitChoice} onChange={e => setAdmitChoice(e.target.value)}>
                                            <option value="no">{t('matron.health.admitNo')}</option>
                                            <option value="yes">{t('matron.health.admitYes')}</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label>{t('matron.health.notifyParent')}</label>
                                        <select value={notifyParent} onChange={e => setNotifyParent(e.target.value)}>
                                            <option value="none">{t('common.no')}</option>
                                            <option value="sms">{t('matron.health.notifySms')}</option>
                                            <option value="call">{t('matron.health.notifyCall')}</option>
                                            <option value="both">{t('matron.health.notifyBoth')}</option>
                                        </select>
                                    </div>
                                </div>
                                {saveError && <p className="health-form-error">{saveError}</p>}
                                <div className="btn-row mt-1-5">
                                    <button className="btn btn-primary" onClick={handleSubmit} disabled={saving || !studentId || !complaint.trim()}>
                                        <span className="material-symbols-rounded">save</span> {saving ? t('common.saving') : t('matron.health.saveRecord')}
                                    </button>
                                    <button className="btn btn-outline" onClick={resetForm}>{t('common.clear')}</button>
                                </div>
                            </div>
                        </div>

                        <div className="card">
                            <div className="card-header">
                                <h3 className="card-title"><span className="material-symbols-rounded">history</span> {t('matron.health.visitHistory')}</h3>
                                <div className="btn-row-sm">
                                    <select className="btn btn-outline btn-sm select-xs" value={historyFilter} onChange={e => setHistoryFilter(e.target.value)}>
                                        <option value="">{t('common.allStudents')}</option>
                                        {students.map(s => (
                                            <option key={s.student_pk} value={s.student_pk}>{s.full_name}</option>
                                        ))}
                                    </select>
                                    <button className="btn btn-outline btn-sm"><span className="material-symbols-rounded">download</span> {t('common.export')}</button>
                                </div>
                            </div>
                            <div className="card-content">
                                <div className="table-responsive">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>{t('common.date')}</th>
                                                <th>{t('common.student')}</th>
                                                <th>{t('common.type')}</th>
                                                <th>{t('matron.health.complaintShort')}</th>
                                                <th>{t('matron.health.tempShort')}</th>
                                                <th>{t('common.action')}</th>
                                                <th>{t('common.status')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {healthHistory.map((row, index) => (
                                                <HealthHistoryRow key={index} {...row} />
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
