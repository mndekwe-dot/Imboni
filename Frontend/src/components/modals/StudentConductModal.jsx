import { useState, useEffect } from 'react'
import { TabGroup } from '../ui/TabGroup'
import { getStudentBehaviorStats, getStudentBehaviorReports, createDisReport } from '../../api/discipline'
import '../../styles/components.css'

const TABS = [
    { key: 'profile', label: 'Profile',      icon: 'person'  },
    { key: 'log',     label: 'Log Incident', icon: 'report'  },
]

const REPORT_TYPE_OPTIONS = [
    { value: 'incident',    label: 'Incident',    icon: 'warning',       cls: 'negative' },
    { value: 'warning',     label: 'Warning',     icon: 'error',         cls: 'warning'  },
    { value: 'positive',    label: 'Positive',    icon: 'thumb_up',      cls: 'positive' },
    { value: 'achievement', label: 'Achievement', icon: 'emoji_events',  cls: 'positive' },
]

const SEVERITY_OPTIONS = [
    { value: 'minor',    label: 'Minor'    },
    { value: 'moderate', label: 'Moderate' },
    { value: 'serious',  label: 'Serious'  },
    { value: 'critical', label: 'Critical' },
]

const TYPE_META = {
    incident:    { icon: 'warning',      cls: 'warning'  },
    warning:     { icon: 'error',        cls: 'warning'  },
    positive:    { icon: 'thumb_up',     cls: 'positive' },
    achievement: { icon: 'emoji_events', cls: 'positive' },
}

const CONDUCT_COLORS = {
    A: { bg: '#dcfce7', color: '#15803d', label: 'Excellent'         },
    B: { bg: '#dbeafe', color: '#1d4ed8', label: 'Good'              },
    C: { bg: '#fef9c3', color: '#92400e', label: 'Satisfactory'      },
    D: { bg: '#fee2e2', color: '#b91c1c', label: 'Needs Improvement' },
    F: { bg: '#fce7f3', color: '#9d174d', label: 'Unsatisfactory'    },
}

function todayISO() {
    return new Date().toISOString().split('T')[0]
}

function fmtDate(d) {
    if (!d) return ''
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Profile tab ────────────────────────────────────────────────────────────────

function ProfileTab({ student, stats, history, histLoading }) {
    const grade     = student.grade || ''
    const section   = student.section || ''
    const cls       = grade && section ? `${grade}${section}` : (grade || section || '—')
    const conductG  = stats?.conduct_grade
    const conductMeta = conductG ? CONDUCT_COLORS[conductG] : null

    const isNeg = r => r.report_type === 'incident' || r.report_type === 'warning'

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            {/* Conduct Grade banner */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: '1rem',
                background: conductMeta ? conductMeta.bg : 'var(--muted)',
                borderRadius: '12px', padding: '1rem 1.25rem',
            }}>
                <div style={{
                    width: '3rem', height: '3rem', borderRadius: '50%',
                    background: conductMeta ? conductMeta.color : 'var(--muted-foreground)',
                    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 800, fontSize: '1.4rem',
                }}>
                    {conductG || '—'}
                </div>
                <div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                        {conductMeta?.label || 'No Conduct Grade'}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)', marginTop: '0.1rem' }}>
                        Current Term Standing
                    </div>
                </div>
                {stats && (
                    <div style={{ marginLeft: 'auto', minWidth: '110px' }}>
                        <div style={{ fontSize: '0.68rem', color: 'var(--muted-foreground)', marginBottom: '0.25rem', textAlign: 'right' }}>
                            Discipline Marks
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            <div style={{ flex: 1, height: '6px', borderRadius: '4px', background: 'rgba(0,0,0,0.12)', overflow: 'hidden' }}>
                                <div style={{
                                    height: '100%', borderRadius: '4px',
                                    width: `${((stats.discipline_marks ?? 40) / 40) * 100}%`,
                                    background: (stats.discipline_marks ?? 40) >= 30 ? '#16a34a'
                                              : (stats.discipline_marks ?? 40) >= 20 ? '#f59e0b' : '#dc2626',
                                    transition: 'width 0.3s',
                                }} />
                            </div>
                            <span style={{ fontWeight: 800, fontSize: '1rem', whiteSpace: 'nowrap' }}>
                                {stats.discipline_marks ?? 40}
                                <span style={{ fontWeight: 400, fontSize: '0.7rem', color: 'var(--muted-foreground)' }}>/40</span>
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {/* Student details grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem' }}>
                {[
                    { label: 'Full Name',   value: student.name       },
                    { label: 'Adm Number',  value: student.student_id },
                    { label: 'Class',       value: cls                },
                    { label: 'Incidents',   value: student.incident_count ?? '—' },
                ].map(({ label, value }) => (
                    <div key={label} style={{
                        background: 'var(--muted)', borderRadius: '10px',
                        padding: '0.625rem 0.875rem',
                    }}>
                        <div style={{ fontSize: '0.68rem', color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.2rem' }}>
                            {label}
                        </div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{value}</div>
                    </div>
                ))}
            </div>

            {/* Conduct History */}
            <div>
                <div style={{
                    fontWeight: 700, fontSize: '0.875rem', marginBottom: '0.75rem',
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                    color: 'var(--foreground)',
                }}>
                    <span className="material-symbols-rounded" style={{ fontSize: '1.1rem' }}>history</span>
                    Conduct History
                </div>

                {histLoading ? (
                    <p style={{ color: 'var(--muted-foreground)', fontSize: '0.85rem', padding: '0.5rem 0' }}>Loading history…</p>
                ) : history.length === 0 ? (
                    <div style={{
                        background: 'var(--muted)', borderRadius: '10px',
                        padding: '1.25rem', textAlign: 'center',
                        color: 'var(--muted-foreground)', fontSize: '0.85rem',
                    }}>
                        <span className="material-symbols-rounded" style={{ fontSize: '2rem', display: 'block', marginBottom: '0.4rem', opacity: 0.4 }}>
                            history_toggle_off
                        </span>
                        No conduct records yet
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {history.map((item) => {
                            const meta = TYPE_META[item.report_type] || { icon: 'info', cls: '' }
                            const neg  = isNeg(item)
                            return (
                                <div key={item.id} style={{
                                    display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
                                    background: 'var(--muted)', borderRadius: '10px',
                                    padding: '0.75rem 1rem',
                                    borderLeft: `3px solid ${neg ? '#ef4444' : '#16a34a'}`,
                                }}>
                                    <div className={`disc-activity-icon ${meta.cls}`} style={{ flexShrink: 0 }}>
                                        <span className="material-symbols-rounded">{meta.icon}</span>
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{item.title}</div>
                                        {item.badge && (
                                            <span style={{
                                                display: 'inline-block', marginTop: '0.15rem',
                                                fontSize: '0.7rem', fontWeight: 600,
                                                padding: '0.1rem 0.5rem', borderRadius: '9px',
                                                background: neg ? '#fee2e2' : '#dcfce7',
                                                color: neg ? '#b91c1c' : '#15803d',
                                            }}>{item.badge}</span>
                                        )}
                                        {item.description && (
                                            <div style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)', marginTop: '0.2rem' }}>
                                                {item.description}
                                            </div>
                                        )}
                                        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.3rem', fontSize: '0.72rem', color: 'var(--muted-foreground)' }}>
                                            <span>{fmtDate(item.date)}</span>
                                            {item.reported_by_display && <span>· {item.reported_by_display}</span>}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}

// ── Log Incident tab ───────────────────────────────────────────────────────────

function LogTab({ student, onReportSaved }) {
    const [reportType, setReportType] = useState('incident')
    const [form, setForm] = useState({ title: '', description: '', severity: 'minor', location: '', date: todayISO(), marks_deducted: '' })
    const [saving, setSaving]         = useState(false)
    const [done,   setDone]           = useState(false)
    const [error,  setError]          = useState(null)

    const isNeg = reportType === 'incident' || reportType === 'warning'

    function handleChange(e) {
        setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    }

    async function handleSubmit() {
        if (!form.title || !form.description) return
        setSaving(true)
        setError(null)
        try {
            await createDisReport({
                student_id:     student.id,
                report_type:    reportType,
                title:          form.title,
                description:    form.description,
                date:           form.date,
                severity:       isNeg ? form.severity : null,
                location:       form.location || '',
                marks_deducted: isNeg && form.marks_deducted ? parseInt(form.marks_deducted) : null,
            })
            setDone(true)
            if (onReportSaved) onReportSaved()
        } catch {
            setError('Failed to save. Please try again.')
        } finally {
            setSaving(false)
        }
    }

    function reset() {
        setForm({ title: '', description: '', severity: 'minor', location: '', date: todayISO(), marks_deducted: '' })
        setReportType('incident')
        setDone(false)
        setError(null)
    }

    if (done) {
        return (
            <div style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
                <div style={{
                    width: '4rem', height: '4rem', borderRadius: '50%',
                    background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 1rem',
                }}>
                    <span className="material-symbols-rounded" style={{ fontSize: '2rem', color: '#15803d' }}>check_circle</span>
                </div>
                <h3 style={{ margin: '0 0 0.4rem', fontSize: '1rem' }}>Report Saved</h3>
                <p style={{ color: 'var(--muted-foreground)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                    Conduct record for <strong>{student.name}</strong> has been filed.
                </p>
                <button className="btn btn-outline btn-sm" onClick={reset}>Log Another</button>
            </div>
        )
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            {/* Report type selector */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.4rem' }}>
                {REPORT_TYPE_OPTIONS.map(opt => (
                    <button
                        key={opt.value}
                        onClick={() => setReportType(opt.value)}
                        style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem',
                            padding: '0.625rem 0.25rem', borderRadius: '10px', border: '2px solid',
                            borderColor: reportType === opt.value ? 'var(--primary)' : 'var(--border)',
                            background: reportType === opt.value ? 'var(--primary)' : 'transparent',
                            color: reportType === opt.value ? '#fff' : 'var(--foreground)',
                            cursor: 'pointer', transition: 'all 0.15s',
                        }}
                    >
                        <span className="material-symbols-rounded" style={{ fontSize: '1.1rem' }}>{opt.icon}</span>
                        <span style={{ fontSize: '0.7rem', fontWeight: 600 }}>{opt.label}</span>
                    </button>
                ))}
            </div>

            <div className="form-group">
                <label className="form-label">Title *</label>
                <input
                    className="form-input" name="title" value={form.title}
                    onChange={handleChange} placeholder="Brief title of the report…"
                />
            </div>

            {isNeg && (
                <>
                    <div className="form-group">
                        <label className="form-label">Severity</label>
                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                            {SEVERITY_OPTIONS.map(s => (
                                <button
                                    key={s.value}
                                    onClick={() => setForm(prev => ({ ...prev, severity: s.value }))}
                                    style={{
                                        padding: '0.3rem 0.75rem', borderRadius: '9px',
                                        border: '1.5px solid',
                                        borderColor: form.severity === s.value ? '#dc2626' : 'var(--border)',
                                        background: form.severity === s.value ? '#fee2e2' : 'transparent',
                                        color: form.severity === s.value ? '#b91c1c' : 'var(--muted-foreground)',
                                        fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                                    }}
                                >{s.label}</button>
                            ))}
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">
                            Marks Deducted
                            <span style={{ fontWeight: 400, color: 'var(--muted-foreground)', marginLeft: '0.35rem' }}>
                                (optional · max 40)
                            </span>
                        </label>
                        <input
                            className="form-input"
                            type="number" min="0" max="40" step="1"
                            name="marks_deducted"
                            value={form.marks_deducted}
                            onChange={e => {
                                const v = Math.max(0, Math.min(40, parseInt(e.target.value) || 0))
                                setForm(prev => ({ ...prev, marks_deducted: e.target.value === '' ? '' : v }))
                            }}
                            placeholder="e.g. 5"
                            style={{ maxWidth: '120px' }}
                        />
                    </div>
                </>
            )}

            <div className="form-group">
                <label className="form-label">Description *</label>
                <textarea
                    className="form-input form-textarea" rows="3"
                    name="description" value={form.description}
                    onChange={handleChange} placeholder="Describe what happened in detail…"
                />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                    <label className="form-label">Date</label>
                    <input
                        className="form-input" type="date"
                        name="date" value={form.date}
                        max={todayISO()} onChange={handleChange}
                    />
                </div>
                <div className="form-group">
                    <label className="form-label">Location (optional)</label>
                    <input
                        className="form-input" name="location" value={form.location}
                        onChange={handleChange} placeholder="e.g. Dormitory Block A"
                    />
                </div>
            </div>

            {error && <p style={{ color: '#dc2626', fontSize: '0.82rem', margin: 0 }}>{error}</p>}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
                <button
                    className="btn btn-primary"
                    onClick={handleSubmit}
                    disabled={saving || !form.title || !form.description}
                >
                    <span className="material-symbols-rounded">save</span>
                    {saving ? 'Saving…' : 'Submit Report'}
                </button>
            </div>
        </div>
    )
}

// ── Modal shell ────────────────────────────────────────────────────────────────

export function StudentConductModal({ student, onClose }) {
    const [tab,        setTab]        = useState('profile')
    const [stats,      setStats]      = useState(null)
    const [history,    setHistory]    = useState([])
    const [histLoading,setHistLoading]= useState(false)

    useEffect(() => {
        if (!student?.id) return
        document.body.style.overflow = 'hidden'
        setTab('profile')
        setStats(null)
        setHistory([])
        setHistLoading(true)

        Promise.all([
            getStudentBehaviorStats(student.id),
            getStudentBehaviorReports(student.id),
        ]).then(([s, h]) => {
            setStats(s)
            setHistory(Array.isArray(h) ? h : (h?.results || []))
        }).catch(console.error)
          .finally(() => setHistLoading(false))

        return () => { document.body.style.overflow = '' }
    }, [student?.id])

    if (!student) return null

    const grade   = student.grade || ''
    const section = student.section || ''
    const cls     = grade && section ? `${grade}${section}` : (grade || section || '')

    function refreshHistory() {
        setHistLoading(true)
        Promise.all([
            getStudentBehaviorStats(student.id),
            getStudentBehaviorReports(student.id),
        ]).then(([s, h]) => {
            setStats(s)
            setHistory(Array.isArray(h) ? h : (h?.results || []))
        }).catch(console.error)
          .finally(() => setHistLoading(false))
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{
                            width: '2.75rem', height: '2.75rem', borderRadius: '50%',
                            background: 'var(--primary)', color: '#fff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 700, fontSize: '0.95rem', flexShrink: 0,
                        }}>
                            {student.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                        </div>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: '1rem' }}>{student.name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                                {cls && <span style={{ background: 'var(--primary)', color: '#fff', borderRadius: '5px', padding: '0.05rem 0.4rem', fontSize: '0.7rem', fontWeight: 600 }}>{cls}</span>}
                                <span>Adm: {student.student_id || '—'}</span>
                            </div>
                        </div>
                    </div>
                    <button className="btn-icon-clean" onClick={onClose}>
                        <span className="material-symbols-rounded">close</span>
                    </button>
                </div>

                {/* Tabs */}
                <div className="modal-tabs">
                    <TabGroup tabs={TABS} value={tab} onChange={setTab} />
                </div>

                {/* Body */}
                <div className="modal-body">
                    {tab === 'profile' && (
                        <ProfileTab
                            student={student}
                            stats={stats}
                            history={history}
                            histLoading={histLoading}
                        />
                    )}
                    {tab === 'log' && (
                        <LogTab student={student} onReportSaved={() => { setTab('profile'); refreshHistory() }} />
                    )}
                </div>

            </div>
        </div>
    )
}
