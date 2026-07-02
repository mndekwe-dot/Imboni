import { useEffect, useState } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { Link } from 'react-router'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/matron.css'
import { matronNavItems, matronSecondaryItems } from './matronNav'
import { DashboardContent } from '../../components/layout/DashboardContent'
import {
    getMatronHealth, createHealthRecord, updateHealthRecord, getMatronStudents,
    getMedicationsToday, administerMedication, createMedication,
} from '../../api/matron'
import { useSessionUser } from '../../hooks/useSessionUser'


const conditionLabels = { illness: 'Illness', injury: 'Injury', checkup: 'Check-up', followup: 'Follow-up' }

const VISIT_TYPE_TO_CONDITION = {
    sickbay_admission: 'illness',
    medication:        'illness',
    routine_checkup:   'checkup',
    follow_up:         'followup',
    injury:            'injury',
    discharge:         'illness',
}

const STATUS_DISPLAY = {
    in_sick_bay: { statusClass: 'pending',  status: 'In Sick Bay' },
    observation: { statusClass: 'pending',  status: 'Observation' },
    cleared:     { statusClass: 'reviewed', status: 'Cleared'     },
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
    return (
        <div className={`bed-card ${badgeClass}`}>
            <span className={`bed-badge ${badgeClass}`}>{badge}</span>
            <div className="bed-number">{bed}</div>
            {isEmpty ? (
                <div className="bed-empty-label">&mdash; Empty &mdash;</div>
            ) : (
                <>
                    <div className="bed-student">{student}</div>
                    <div className="bed-condition">{condition}</div>
                    <div className="bed-since">{since}</div>
                    <div className="btn-row-sm" style={{ marginTop: '0.75rem' }}>
                        <button
                            className="btn btn-sm"
                            style={{ background: 'var(--success-light)', color: 'var(--success)', border: 'none' }}
                            onClick={() => onDischarge(recordId)}
                            disabled={discharging}
                        >
                            {discharging ? 'Discharging…' : 'Discharge'}
                        </button>
                    </div>
                </>
            )}
        </div>
    )
}

function HealthHistoryRow({ date, name, conditionTag, complaint, temp, action, statusClass, status }) {
    return (
        <tr>
            <td>{date}</td>
            <td><strong>{name}</strong></td>
            <td><span className={`condition-tag ${conditionTag}`}>{conditionLabels[conditionTag]}</span></td>
            <td>{complaint}</td>
            <td>{temp}</td>
            <td>{action}</td>
            <td><span className={`matron-report-status ${statusClass}`}>{status}</span></td>
        </tr>
    )
}

function MedicationChecklist({ students }) {
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
            await administerMedication(item.schedule_id, { time: item.time })
            load()
        } finally {
            setGiving(null)
        }
    }

    async function handleAdd() {
        const times = form.times.split(',').map(t => t.trim()).filter(Boolean)
        if (!form.student_id || !form.medicine_name.trim() || !form.dosage.trim() || !form.start_date || times.length === 0) {
            setSaveError('Fill in student, medicine, dosage, start date and at least one time.')
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
            setSaveError(e?.response?.data?.error || 'Failed to save the schedule.')
        } finally {
            setSaving(false)
        }
    }

    const items = checklist?.items || []

    return (
        <div className="card mb-1-5">
            <div className="card-header">
                <h3 className="card-title"><span className="material-symbols-rounded">medication</span> Today&apos;s Medication</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {checklist && (
                        <span className="settings-info-text align-self-center">
                            {checklist.given}/{checklist.total} given
                            {checklist.overdue > 0 && <span style={{ color: '#dc2626' }}> &middot; {checklist.overdue} overdue</span>}
                        </span>
                    )}
                    <button className="btn btn-outline btn-sm" onClick={() => setShowAdd(s => !s)}>
                        <span className="material-symbols-rounded icon-sm">add</span>
                        Add Schedule
                    </button>
                </div>
            </div>
            <div className="card-content">
                {showAdd && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.6rem', marginBottom: '1rem', padding: '0.75rem', background: 'var(--muted)', borderRadius: 10 }}>
                        <div>
                            <label className="form-label" htmlFor="med-student">Student</label>
                            <select id="med-student" className="form-input" value={form.student_id}
                                onChange={e => setForm(f => ({ ...f, student_id: e.target.value }))}>
                                <option value="">— Select —</option>
                                {students.map(s => <option key={s.id} value={s.id}>{s.name || s.full_name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="form-label" htmlFor="med-name">Medicine</label>
                            <input id="med-name" className="form-input" placeholder="e.g. Amoxicillin"
                                value={form.medicine_name} onChange={e => setForm(f => ({ ...f, medicine_name: e.target.value }))} />
                        </div>
                        <div>
                            <label className="form-label" htmlFor="med-dosage">Dosage</label>
                            <input id="med-dosage" className="form-input" placeholder="e.g. 500mg"
                                value={form.dosage} onChange={e => setForm(f => ({ ...f, dosage: e.target.value }))} />
                        </div>
                        <div>
                            <label className="form-label" htmlFor="med-times">Times (comma-separated)</label>
                            <input id="med-times" className="form-input" placeholder="08:00, 13:00, 20:00"
                                value={form.times} onChange={e => setForm(f => ({ ...f, times: e.target.value }))} />
                        </div>
                        <div>
                            <label className="form-label" htmlFor="med-start">Start</label>
                            <input id="med-start" type="date" className="form-input"
                                value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
                        </div>
                        <div>
                            <label className="form-label" htmlFor="med-end">End (optional)</label>
                            <input id="med-end" type="date" className="form-input"
                                value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem' }}>
                            <button className="btn btn-primary btn-sm" onClick={handleAdd} disabled={saving}>
                                {saving ? 'Saving…' : 'Save Schedule'}
                            </button>
                        </div>
                        {saveError && <p style={{ color: '#dc2626', fontSize: '0.8rem', gridColumn: '1/-1', margin: 0 }}>{saveError}</p>}
                    </div>
                )}

                {!checklist ? (
                    <p style={{ color: 'var(--muted-foreground)' }}>Loading medication checklist…</p>
                ) : items.length === 0 ? (
                    <p style={{ color: 'var(--muted-foreground)' }}>No medications scheduled for today.</p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        {items.map(item => {
                            const key = `${item.schedule_id}|${item.time}`
                            return (
                                <div key={key} style={{
                                    display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap',
                                    padding: '0.55rem 0.8rem', borderRadius: 10,
                                    border: `1px solid ${item.overdue ? '#dc2626' : 'var(--border)'}`,
                                    background: item.given ? 'rgba(16,185,129,0.06)' : 'transparent',
                                }}>
                                    <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', minWidth: 48 }}>{item.time}</span>
                                    <div style={{ flex: 1, minWidth: 160 }}>
                                        <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{item.student_name}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
                                            {item.medicine_name} · {item.dosage} · S{item.grade}{item.section}
                                        </div>
                                    </div>
                                    {item.given ? (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: 'var(--success)', fontSize: '0.8rem', fontWeight: 600 }}>
                                            <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>check_circle</span>
                                            Given
                                        </span>
                                    ) : (
                                        <>
                                            {item.overdue && (
                                                <span style={{ color: '#dc2626', fontSize: '0.75rem', fontWeight: 600 }}>Overdue</span>
                                            )}
                                            <button className="btn btn-primary btn-sm"
                                                disabled={giving === key}
                                                onClick={() => handleGive(item)}>
                                                {giving === key ? 'Saving…' : 'Mark Given'}
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
    const sessionUser = useSessionUser()
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
            setSaveError(e?.response?.data?.error || e?.message || 'Failed to save record.')
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

    if (loading) return <p style={{ padding: '2rem' }}>Loading...</p>
    if (error) return <p style={{ padding: '2rem', color: 'var(--danger)' }}>Error: {error}</p>

    const healthStats = [
        { iconClass: 'sick',     icon: 'sick',          value: data.stats.in_sick_bay_now,    label: 'In Sick Bay Now'    },
        { iconClass: 'recovery', icon: 'healing',       value: data.stats.under_observation,  label: 'Under Observation'  },
        { iconClass: 'visits',   icon: 'calendar_today',value: data.stats.visits_this_month,  label: 'Visits This Month'  },
        { iconClass: 'cleared',  icon: 'check_circle',  value: data.stats.cleared_this_month, label: 'Cleared This Month' },
    ]

    const healthHistory = data.history.map(r => ({
        date: new Date(r.visit_datetime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        name: r.name,
        conditionTag: r.condition_tag,
        complaint: r.complaint,
        temp: r.temperature_c ? `${r.temperature_c} °C` : '—',
        action: r.action_taken || '—',
        ...(STATUS_DISPLAY[r.status] || STATUS_DISPLAY.cleared),
    }))

    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>

            <div className="dashboard-layout">
                <Sidebar navItems={matronNavItems} secondaryItems={matronSecondaryItems} />

                <main className="dashboard-main" id="main-content">
                    <header className="dashboard-header">
                        <button className="mobile-menu-btn" onClick={() => document.dispatchEvent(new CustomEvent('imboni:open-sidebar'))}><span className="material-symbols-rounded">menu</span></button>
                        <div className="dashboard-header-title">
                            <h1>Health &amp; Wellness</h1>
                            <p>Sick bay management and student health records &mdash; Karisimbi House</p>
                        </div>
                        <div className="dashboard-header-actions">
                            <span className="date-display">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                            <div className="header-user">
                                <div className="header-user-info">
                                    <span className="header-user-name">{sessionUser.userName}</span>
                                    <span className="header-user-role">Matron</span>
                                </div>
                                <Link to="/profile?role=matron" className={`header-user-av ${sessionUser.avatarClass}`}>{sessionUser.userInitials}</Link>
                            </div>
                        </div>
                    </header>

                    <DashboardContent>

                        <div className="health-stats">
                            {healthStats.map((stat, index) => (
                                <HealthStat key={index} {...stat} />
                            ))}
                        </div>

                        <MedicationChecklist students={students} />

                        <div className="card mb-1-5">
                            <div className="card-header">
                                <h3 className="card-title"><span className="material-symbols-rounded">bed</span> Sick Bay &mdash; Current Residents</h3>
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
                                <h3 className="card-title"><span className="material-symbols-rounded">add_circle</span> Log Health Visit</h3>
                            </div>
                            <div className="card-content">
                                <div className="health-form-grid">
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
                                        <label>Visit Type</label>
                                        <select value={visitType} onChange={e => setVisitType(e.target.value)}>
                                            <option value="sickbay_admission">Sick Bay Admission</option>
                                            <option value="routine_checkup">Routine Check-up</option>
                                            <option value="medication">Medication Dispensed</option>
                                            <option value="follow_up">Follow-up Visit</option>
                                            <option value="injury">Injury</option>
                                            <option value="discharge">Discharge</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label>Date &amp; Time</label>
                                        <input type="datetime-local" value={visitDateTime} onChange={e => setVisitDateTime(e.target.value)} />
                                    </div>
                                    <div>
                                        <label>Temperature (&deg;C) &mdash; optional</label>
                                        <input type="number" step="0.1" min="35" max="42" placeholder="e.g. 37.4" value={temperature} onChange={e => setTemperature(e.target.value)} />
                                    </div>
                                    <div className="full">
                                        <label>Complaint / Condition</label>
                                        <input type="text" placeholder="Brief description of presenting complaint…" value={complaint} onChange={e => setComplaint(e.target.value)} />
                                    </div>
                                    <div className="full">
                                        <label>Action Taken / Treatment</label>
                                        <textarea
                                            placeholder="Medication given, rest ordered, parent notified, referred to hospital…"
                                            value={actionTaken}
                                            onChange={e => setActionTaken(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label>Admit to Sick Bay?</label>
                                        <select value={admitChoice} onChange={e => setAdmitChoice(e.target.value)}>
                                            <option value="no">No &mdash; outpatient visit</option>
                                            <option value="yes">Yes &mdash; assign to bed</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label>Notify Parent?</label>
                                        <select value={notifyParent} onChange={e => setNotifyParent(e.target.value)}>
                                            <option value="none">No</option>
                                            <option value="sms">Yes &mdash; send SMS</option>
                                            <option value="call">Yes &mdash; call parent</option>
                                            <option value="both">Yes &mdash; both</option>
                                        </select>
                                    </div>
                                </div>
                                {saveError && <p style={{ color: '#dc2626', fontSize: '0.85rem' }}>{saveError}</p>}
                                <div className="btn-row mt-1-5">
                                    <button className="btn btn-primary" onClick={handleSubmit} disabled={saving || !studentId || !complaint.trim()}>
                                        <span className="material-symbols-rounded">save</span> {saving ? 'Saving…' : 'Save Record'}
                                    </button>
                                    <button className="btn btn-outline" onClick={resetForm}>Clear</button>
                                </div>
                            </div>
                        </div>

                        <div className="card">
                            <div className="card-header">
                                <h3 className="card-title"><span className="material-symbols-rounded">history</span> Health Visit History</h3>
                                <div className="btn-row-sm">
                                    <select className="btn btn-outline btn-sm select-xs" value={historyFilter} onChange={e => setHistoryFilter(e.target.value)}>
                                        <option value="">All Students</option>
                                        {students.map(s => (
                                            <option key={s.student_pk} value={s.student_pk}>{s.full_name}</option>
                                        ))}
                                    </select>
                                    <button className="btn btn-outline btn-sm"><span className="material-symbols-rounded">download</span> Export</button>
                                </div>
                            </div>
                            <div className="card-content">
                                <div className="table-responsive">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Date</th>
                                                <th>Student</th>
                                                <th>Type</th>
                                                <th>Complaint</th>
                                                <th>Temp</th>
                                                <th>Action</th>
                                                <th>Status</th>
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
