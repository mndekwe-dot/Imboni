import { Sidebar } from '../../components/layout/Sidebar'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { FilterBar } from '../../components/ui/FilterBar'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/matron.css'
import { useEffect, useState } from 'react'
import { matronNavItems, matronSecondaryItems } from './matronNav'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { useSchoolSettings } from '../../hooks/useSchoolSetting'
import { formatSchoolDate } from '../../utils/date'
import { getMatronIncidents, createMatronIncident, getMatronStudents } from '../../api/matron'
import { useSessionUser } from '../../hooks/useSessionUser'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useNotifications } from '../../hooks/useNotifications'
import { useMatronDormitory } from '../../hooks/useMatronDormitory'
import { SkeletonTable } from '../../components/ui/Skeleton'
import { classLabel } from '../../utils/classes'


const STATUS_STYLE = {
    pending_review: { statusClass: 'pending',  statusKey: 'common.pendingReview' },
    approved:       { statusClass: 'reviewed', statusKey: 'common.reviewed'      },
    rejected:       { statusClass: 'reviewed', statusKey: 'common.rejected'      },
}

// Severity is a stored code; the word shown for it is not derived from the
// code itself, which used to be capitalised and printed as-is.
const SEVERITY_KEYS = {
    minor:    'modals.conduct.sevMinor',
    moderate: 'modals.conduct.sevModerate',
    serious:  'modals.conduct.sevSerious',
    critical: 'modals.conduct.sevCritical',
}

const SEVERITY_STYLE = {
    minor:    { background: 'var(--muted)', color: 'var(--muted-text)' },
    moderate: { background: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
    serious:  { background: 'var(--destructive-light)', color: 'var(--destructive)' },
    critical: { background: 'var(--destructive-light)', color: 'var(--destructive)' },
}

function PastReportRow({ date, name, type, severityStyle, severity, statusClass, statusKey }) {
    const { t } = useTranslation()
    return (
        <tr>
            <td>{date}</td>
            <td><strong>{name}</strong></td>
            <td>{type}</td>
            <td><span className="badge" style={severityStyle}>{severity}</span></td>
            <td><span className={`matron-report-status ${statusClass}`}>{t(statusKey)}</span></td>
        </tr>
    )
}

export function MatronIncidents() {
    const dormitory = useMatronDormitory()
    const { t } = useTranslation()
    const { setting } = useSchoolSettings()
    const sessionUser = useSessionUser()
    const { notifications: liveNotifications, markRead } = useNotifications()
    const [filter, setFilter] = useState('all')
    const [reports, setReports] = useState([])
    const [students, setStudents] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    const [studentId, setStudentId] = useState('')
    const [reportType, setReportType] = useState('incident')
    const [severity, setSeverity] = useState('minor')
    const [incidentDate, setIncidentDate] = useState('')
    const [description, setDescription] = useState('')
    const [actionTaken, setActionTaken] = useState('')
    const [saving, setSaving] = useState(false)
    const [saveError, setSaveError] = useState(null)

    useEffect(() => {
        Promise.all([getMatronIncidents(), getMatronStudents()])
            .then(([incidents, studs]) => {
                setReports(Array.isArray(incidents) ? incidents : [])
                setStudents(Array.isArray(studs) ? studs : [])
            })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false))
    }, [])

    function resetForm() {
        setStudentId(''); setReportType('incident'); setSeverity('minor')
        setIncidentDate(''); setDescription(''); setActionTaken('')
    }

    async function handleSubmit() {
        if (!studentId || !description.trim()) return
        setSaving(true); setSaveError(null)
        try {
            const created = await createMatronIncident({
                student_id: studentId,
                title: `${reportType[0].toUpperCase()}${reportType.slice(1)} report`,
                report_type: reportType,
                severity,
                description: description.trim(),
                date: incidentDate || new Date().toISOString().slice(0, 10),
                action_taken: actionTaken.trim(),
            })
            setReports(prev => [created, ...prev])
            resetForm()
        } catch (e) {
            setSaveError(e?.message || t('matron.incidents.submitFailed'))
        } finally {
            setSaving(false)
        }
    }

    const pastReports = reports.map(r => ({
        date: r.date,
        name: r.student_name,
        type: r.badge,
        severityStyle: SEVERITY_STYLE[r.severity] || SEVERITY_STYLE.minor,
        severity: SEVERITY_KEYS[r.severity] ? t(SEVERITY_KEYS[r.severity]) : r.report_type,
        ...(STATUS_STYLE[r.status] || STATUS_STYLE.pending_review),
    }))

    const filterOptions = [
        { key: 'all',      label: t('matron.incidents.allReports') },
        { key: 'pending',  label: t('common.pending'), count: pastReports.filter(r => r.statusClass === 'pending').length },
        { key: 'reviewed', label: t('common.reviewed') },
    ]

    const visible = filter === 'all'
        ? pastReports
        : pastReports.filter(r => r.statusClass === filter)

    if (loading) return <SkeletonTable rows={6} cols={5} />
    if (error) return <p className="u-pad u-danger">{t('common.errorPrefix')}: {error}</p>

    return (
        <>
            <a href="#main-content" className="skip-link">{t('common.skipToContent')}</a>
            <div className="sidebar-overlay"></div>

            <div className="dashboard-layout">
                <Sidebar navItems={matronNavItems} secondaryItems={matronSecondaryItems} />

                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title={t('matron.incidents.title')}
                        subtitle={t('matron.incidents.subtitle')}
                        {...sessionUser}
                        notifications={liveNotifications}
                        onNotificationRead={markRead}
                    />

                    <DashboardContent>

                        <div className="incident-form-card">
                            <div className="incident-form-title">
                                <span className="material-symbols-rounded">report</span> {dormitory
                                    ? t('matron.incidents.banner', { house: dormitory })
                                    : t('matron.incidents.bannerNoHouse')}
                            </div>
                            <div className="incident-form-grid">
                                <div className="form-field">
                                    <label>{t('common.student')}</label>
                                    <select value={studentId} onChange={e => setStudentId(e.target.value)}>
                                        <option value="">{t('common.selectStudent')}</option>
                                        {students.map(s => (
                                            <option key={s.student_pk} value={s.student_pk}>
                                                {s.full_name} ({classLabel(s.grade, s.section)})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-field">
                                    <label>{t('matron.incidents.reportType')}</label>
                                    <select value={reportType} onChange={e => setReportType(e.target.value)}>
                                        <option value="incident">{t('modals.conduct.typeIncident')}</option>
                                        <option value="warning">{t('modals.conduct.typeWarning')}</option>
                                        <option value="positive">{t('matron.incidents.typePositive')}</option>
                                        <option value="achievement">{t('modals.conduct.typeAchievement')}</option>
                                    </select>
                                </div>
                                <div className="form-field">
                                    <label>{t('modals.conduct.severity')}</label>
                                    <select value={severity} onChange={e => setSeverity(e.target.value)}>
                                        <option value="minor">{t('modals.conduct.sevMinor')}</option>
                                        <option value="moderate">{t('modals.conduct.sevModerate')}</option>
                                        <option value="serious">{t('modals.conduct.sevSerious')}</option>
                                        <option value="critical">{t('matron.incidents.sevCritical')}</option>
                                    </select>
                                </div>
                                <div className="form-field">
                                    <label>{t('matron.incidents.dateOfIncident')}</label>
                                    <input type="date" value={incidentDate} onChange={e => setIncidentDate(e.target.value)} />
                                </div>
                                <div className="form-field form-field-full">
                                    <label>{t('common.description')}</label>
                                    <textarea
                                        placeholder={t('matron.incidents.descPlaceholder')}
                                        value={description}
                                        onChange={e => setDescription(e.target.value)}
                                    />
                                </div>
                                <div className="form-field form-field-full">
                                    <label>{t('matron.incidents.actionTaken')}</label>
                                    <textarea
                                        placeholder={t('matron.incidents.actionPlaceholder')}
                                        className="u-min-h-60"
                                        value={actionTaken}
                                        onChange={e => setActionTaken(e.target.value)}
                                    />
                                </div>
                            </div>
                            {saveError && <p className="u-danger u-fs-085">{saveError}</p>}
                            <div className="btn-row">
                                <button className="btn btn-primary" onClick={handleSubmit} disabled={saving || !studentId || !description.trim()}>
                                    <span className="material-symbols-rounded">send</span> {saving ? t('matron.incidents.submitting') : t('matron.incidents.submitToDiscipline')}
                                </button>
                                <button className="btn btn-outline" onClick={resetForm}>{t('matron.incidents.clearForm')}</button>
                            </div>
                        </div>

                        <FilterBar
                            options={filterOptions}
                            active={filter}
                            onChange={setFilter}
                        />
                        
                        <div className="card">
                            <div className="card-header">
                                <h3 className="card-title"><span className="material-symbols-rounded">history</span> {t('matron.incidents.pastReports')}</h3>
                                <button className="btn btn-outline btn-sm"><span className="material-symbols-rounded">download</span> {t('common.export')}</button>
                            </div>
                            <div className="card-content">
                                <div className="table-responsive">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>{t('common.date')}</th>
                                                <th>{t('common.student')}</th>
                                                <th>{t('common.type')}</th>
                                                <th>{t('modals.conduct.severity')}</th>
                                                <th>{t('matron.incidents.disciplineStatus')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {visible.map((report, index) => (
                                                <PastReportRow key={index} {...report} />
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
