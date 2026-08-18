import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { TabGroup } from '../ui/TabGroup'
import { getStudentBehaviorStats, getStudentBehaviorReports, createDisReport } from '../../api/discipline'
import { formatDate } from '../../utils/date'
import '../../styles/components.css'

const TABS = [
    { key: 'profile', labelKey: 'modals.conduct.tabProfile', icon: 'person' },
    { key: 'log',     labelKey: 'modals.conduct.tabLog',     icon: 'report' },
]

const REPORT_TYPE_OPTIONS = [
    { value: 'incident',    labelKey: 'modals.conduct.typeIncident',    icon: 'warning',      cls: 'negative' },
    { value: 'warning',     labelKey: 'modals.conduct.typeWarning',     icon: 'error',        cls: 'warning'  },
    { value: 'positive',    labelKey: 'modals.conduct.typePositive',    icon: 'thumb_up',     cls: 'positive' },
    { value: 'achievement', labelKey: 'modals.conduct.typeAchievement', icon: 'emoji_events', cls: 'positive' },
]

const SEVERITY_OPTIONS = [
    { value: 'minor',    labelKey: 'modals.conduct.sevMinor'    },
    { value: 'moderate', labelKey: 'modals.conduct.sevModerate' },
    { value: 'serious',  labelKey: 'modals.conduct.sevSerious'  },
    { value: 'critical', labelKey: 'modals.conduct.sevCritical' },
]

const TYPE_META = {
    incident:    { icon: 'warning',      cls: 'warning'  },
    warning:     { icon: 'error',        cls: 'warning'  },
    positive:    { icon: 'thumb_up',     cls: 'positive' },
    achievement: { icon: 'emoji_events', cls: 'positive' },
}

const CONDUCT_COLORS = {
    A: { bg: '#dcfce7', color: '#15803d', labelKey: 'modals.conduct.gradeExcellent'        },
    B: { bg: '#dbeafe', color: '#1d4ed8', labelKey: 'modals.conduct.gradeGood'             },
    C: { bg: '#fef9c3', color: '#92400e', labelKey: 'modals.conduct.gradeSatisfactory'     },
    D: { bg: '#fee2e2', color: '#b91c1c', labelKey: 'modals.conduct.gradeNeedsImprovement' },
    F: { bg: '#fce7f3', color: '#9d174d', labelKey: 'modals.conduct.gradeUnsatisfactory'   },
}

function todayISO() {
    return new Date().toISOString().split('T')[0]
}

function fmtDate(d) {
    if (!d) return ''
    return formatDate(d)
}

// ── Profile tab ────────────────────────────────────────────────────────────────

function ProfileTab({ student, stats, history, histLoading }) {
    const { t } = useTranslation()
    const grade     = student.grade || ''
    const section   = student.section || ''
    const cls       = grade && section ? `${grade}${section}` : (grade || section || '-')
    const conductG  = stats?.conduct_grade
    const conductMeta = conductG ? CONDUCT_COLORS[conductG] : null

    const isNeg = r => r.report_type === 'incident' || r.report_type === 'warning'

    const marks = stats?.discipline_marks ?? 40

    return (
        <div className="scm-stack">

            {/* Conduct Grade banner */}
            <div
                className="scm-banner"
                style={conductMeta ? { '--scm-bg': conductMeta.bg } : undefined}
            >
                <div
                    className="scm-grade-badge"
                    style={conductMeta ? { '--scm-grade-bg': conductMeta.color } : undefined}
                >
                    {conductG || '-'}
                </div>
                <div>
                    <div className="scm-grade-label">
                        {conductMeta ? t(conductMeta.labelKey) : t('modals.conduct.noGrade')}
                    </div>
                    <div className="scm-grade-sub">{t('modals.conduct.currentTermStanding')}</div>
                </div>
                {stats && (
                    <div className="scm-marks">
                        <div className="scm-marks-label">{t('modals.conduct.disciplineMarks')}</div>
                        <div className="scm-marks-row">
                            <div className="scm-marks-track">
                                {/* width and threshold colour are data-driven */}
                                <div className="scm-marks-fill" style={{
                                    width: `${(marks / 40) * 100}%`,
                                    background: marks >= 30 ? 'var(--success)'
                                              : marks >= 20 ? 'var(--warning)' : 'var(--destructive)',
                                }} />
                            </div>
                            <span className="scm-marks-value">
                                {marks}
                                <span className="scm-marks-max">/40</span>
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {/* Student details grid */}
            <div className="scm-detail-grid">
                {[
                    { label: t('modals.disStaff.fullName'), value: student.name       },
                    { label: t('modals.conduct.admNumber'), value: student.student_id },
                    { label: t('common.class'),             value: cls                },
                    { label: t('modals.conduct.incidents'), value: student.incident_count ?? '-' },
                ].map(({ label, value }) => (
                    <div key={label} className="scm-detail-cell">
                        <div className="scm-detail-label">{label}</div>
                        <div className="scm-detail-value">{value}</div>
                    </div>
                ))}
            </div>

            {/* Conduct History */}
            <div>
                <div className="scm-section-title">
                    <span className="material-symbols-rounded">history</span>
                    {t('modals.conduct.conductHistory')}
                </div>

                {histLoading ? (
                    <p className="scm-note">{t('modals.conduct.loadingHistory')}</p>
                ) : history.length === 0 ? (
                    <div className="scm-empty">
                        <span className="material-symbols-rounded scm-empty-icon">
                            history_toggle_off
                        </span>
                        {t('modals.conduct.noRecords')}
                    </div>
                ) : (
                    <div className="scm-history">
                        {history.map((item) => {
                            const meta = TYPE_META[item.report_type] || { icon: 'info', cls: '' }
                            const neg  = isNeg(item)
                            return (
                                <div key={item.id} className={`scm-history-item${neg ? ' is-negative' : ''}`}>
                                    <div className={`disc-activity-icon scm-history-icon ${meta.cls}`}>
                                        <span className="material-symbols-rounded">{meta.icon}</span>
                                    </div>
                                    <div className="scm-history-main">
                                        <div className="scm-history-title">{item.title}</div>
                                        {item.badge && (
                                            <span className="scm-history-badge">{item.badge}</span>
                                        )}
                                        {item.description && (
                                            <div className="scm-history-desc">{item.description}</div>
                                        )}
                                        <div className="scm-history-meta">
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
    const { t } = useTranslation()
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
            <div className="scm-done">
                <div className="scm-done-icon">
                    <span className="material-symbols-rounded">check_circle</span>
                </div>
                <h3 className="scm-done-title">{t('modals.conduct.reportSaved')}</h3>
                <p className="scm-done-text">
                    {t('modals.conduct.recordFiled', { name: student.name })}
                </p>
                <button className="btn btn-outline btn-sm" onClick={reset}>{t('modals.conduct.logAnother')}</button>
            </div>
        )
    }

    return (
        <div className="scm-form">

            {/* Report type selector */}
            <div className="scm-type-grid">
                {REPORT_TYPE_OPTIONS.map(opt => (
                    <button
                        key={opt.value}
                        type="button"
                        onClick={() => setReportType(opt.value)}
                        className={`scm-type-btn${reportType === opt.value ? ' active' : ''}`}
                    >
                        <span className="material-symbols-rounded">{opt.icon}</span>
                        <span className="scm-type-label">{t(opt.labelKey)}</span>
                    </button>
                ))}
            </div>

            <div className="form-group">
                <label className="form-label">{t('common.titleRequired')}</label>
                <input
                    className="form-input" name="title" value={form.title}
                    onChange={handleChange} placeholder={t('modals.conduct.titlePlaceholder')}
                />
            </div>

            {isNeg && (
                <>
                    <div className="form-group">
                        <label className="form-label">{t('modals.conduct.severity')}</label>
                        <div className="scm-sev-row">
                            {SEVERITY_OPTIONS.map(s => (
                                <button
                                    key={s.value}
                                    type="button"
                                    onClick={() => setForm(prev => ({ ...prev, severity: s.value }))}
                                    className={`scm-sev-btn${form.severity === s.value ? ' active' : ''}`}
                                >{t(s.labelKey)}</button>
                            ))}
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">
                            {t('modals.conduct.marksDeducted')}
                            <span className="scm-label-hint">
                                {t('modals.conduct.marksHint')}
                            </span>
                        </label>
                        <input
                            className="form-input scm-marks-input"
                            type="number" min="0" max="40" step="1"
                            name="marks_deducted"
                            value={form.marks_deducted}
                            onChange={e => {
                                const v = Math.max(0, Math.min(40, parseInt(e.target.value) || 0))
                                setForm(prev => ({ ...prev, marks_deducted: e.target.value === '' ? '' : v }))
                            }}
                            placeholder={t('modals.conduct.egFive')}
                        />
                    </div>
                </>
            )}

            <div className="form-group">
                <label className="form-label">{t('modals.conduct.descriptionRequired')}</label>
                <textarea
                    className="form-input form-textarea" rows="3"
                    name="description" value={form.description}
                    onChange={handleChange} placeholder={t('modals.conduct.descPlaceholder')}
                />
            </div>

            <div className="scm-form-row-2">
                <div className="form-group">
                    <label className="form-label">{t('common.date')}</label>
                    <input
                        className="form-input" type="date"
                        name="date" value={form.date}
                        max={todayISO()} onChange={handleChange}
                    />
                </div>
                <div className="form-group">
                    <label className="form-label">{t('modals.conduct.locationOptional')}</label>
                    <input
                        className="form-input" name="location" value={form.location}
                        onChange={handleChange} placeholder={t('modals.conduct.egLocation')}
                    />
                </div>
            </div>

            {error && <p className="scm-error">{error}</p>}

            <div className="scm-actions">
                <button
                    className="btn btn-primary"
                    onClick={handleSubmit}
                    disabled={saving || !form.title || !form.description}
                >
                    <span className="material-symbols-rounded">save</span>
                    {saving ? t('common.saving') : t('modals.conduct.submitReport')}
                </button>
            </div>
        </div>
    )
}

// ── Modal shell ────────────────────────────────────────────────────────────────

export function StudentConductModal({ student, onClose }) {
    const { t } = useTranslation()
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
                    <div className="scm-head">
                        <div className="scm-avatar">
                            {student.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                        </div>
                        <div>
                            <div className="scm-head-name">{student.name}</div>
                            <div className="scm-head-meta">
                                {cls && <span className="scm-head-class">{cls}</span>}
                                <span>Student ID: {student.student_id || '-'}</span>
                            </div>
                        </div>
                    </div>
                    <button className="btn-icon-clean" onClick={onClose}>
                        <span className="material-symbols-rounded">close</span>
                    </button>
                </div>

                {/* Tabs */}
                <div className="modal-tabs">
                    <TabGroup tabs={TABS.map(tb => ({ ...tb, label: t(tb.labelKey) }))} value={tab} onChange={setTab} />
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
                        // Refresh the profile's history in the background, but don't switch
                        // tabs away immediately — that would hide LogTab's own "Report Saved"
                        // confirmation screen before the user ever sees it.
                        <LogTab student={student} onReportSaved={refreshHistory} />
                    )}
                </div>

            </div>
        </div>
    )
}
