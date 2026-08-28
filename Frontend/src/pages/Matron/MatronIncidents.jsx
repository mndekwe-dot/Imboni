import { Sidebar } from '../../components/layout/Sidebar'
import { Link, useSearchParams } from 'react-router'
import { PageLoading } from '../../components/layout/PageLoading'
import { useTranslation } from 'react-i18next'
import { FilterBar } from '../../components/ui/FilterBar'
import { FormSelect } from '../../components/ui/FormSelect'
import { StudentSearchPicker } from '../../components/ui/StudentSearchPicker'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/matron.css'
import { useEffect, useState } from 'react'
import { matronNavItems, matronSecondaryItems } from './matronNav'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { useSchoolSettings } from '../../hooks/useSchoolSetting'
import { formatSchoolDate } from '../../utils/date'
import { getMatronIncidents, createMatronIncident, searchMatronStudents, getMatronStudent } from '../../api/matron'
import { useSessionUser } from '../../hooks/useSessionUser'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useNotifications } from '../../hooks/useNotifications'
import { useMatronDormitory } from '../../hooks/useMatronDormitory'
import { downloadCsv } from '../../utils/exportTable'


const STATUS_STYLE = {
    pending_review: { statusClass: 'pending',  statusKey: 'common.pendingReview' },
    approved:       { statusClass: 'reviewed', statusKey: 'common.reviewed'      },
    rejected:       { statusClass: 'rejected', statusKey: 'common.rejected'      },
}

// Severity is a stored code; the word shown for it is not derived from the
// code itself, which used to be capitalised and printed as-is.
const SEVERITY_KEYS = {
    minor:    'modals.conduct.sevMinor',
    moderate: 'modals.conduct.sevModerate',
    serious:  'modals.conduct.sevSerious',
    critical: 'modals.conduct.sevCritical',
}

// Declared once so the form and any future filter read the same list, rather
// than two hand-kept sets of <option> elements drifting apart.
const REPORT_TYPE_OPTIONS = [
    { value: 'incident',    labelKey: 'modals.conduct.typeIncident'    },
    { value: 'warning',     labelKey: 'modals.conduct.typeWarning'     },
    { value: 'positive',    labelKey: 'matron.incidents.typePositive'  },
    { value: 'achievement', labelKey: 'modals.conduct.typeAchievement' },
]

const SEVERITY_OPTIONS = [
    { value: 'minor',    labelKey: 'modals.conduct.sevMinor'    },
    { value: 'moderate', labelKey: 'modals.conduct.sevModerate' },
    { value: 'serious',  labelKey: 'modals.conduct.sevSerious'  },
    { value: 'critical', labelKey: 'matron.incidents.sevCritical' },
]

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
    const [searchParams] = useSearchParams()
    const [filter, setFilter] = useState('all')
    const [reports, setReports] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    const [student, setStudent] = useState(null)
    const [reportType, setReportType] = useState('incident')
    const [severity, setSeverity] = useState('minor')
    const [incidentDate, setIncidentDate] = useState('')
    const [description, setDescription] = useState('')
    const [actionTaken, setActionTaken] = useState('')
    const [saving, setSaving] = useState(false)
    const [saveError, setSaveError] = useState(null)

    useEffect(() => {
        // Only the reports. The student list used to be fetched here in full
        // just to populate a <select>; the picker asks the server per search.
        getMatronIncidents()
            .then(incidents => setReports(Array.isArray(incidents) ? incidents : []))
            .catch(err => setError(err.message))
            .finally(() => setLoading(false))
    }, [])

    /* Arrived from a student on the roll: `?student=<boarding record id>`.
       The id rather than the name, so the form cannot be opened against a
       student who merely shares a name with someone; and in the URL rather
       than in router state, so a reload does not silently drop the person the
       report is about. */
    const preselectId = searchParams.get('student')
    useEffect(() => {
        if (!preselectId) return
        let cancelled = false
        getMatronStudent(preselectId)
            .then(data => {
                if (cancelled || !data) return
                setStudent({ id: data.id, student_pk: data.student_pk, name: data.name })
            })
            // An unknown id leaves the picker empty and typeable, which is the
            // state the page has when opened directly.
            .catch(() => {})
        return () => { cancelled = true }
    }, [preselectId])

    function resetForm() {
        setStudent(null); setReportType('incident'); setSeverity('minor')
        setIncidentDate(''); setDescription(''); setActionTaken('')
    }

    async function handleSubmit() {
        if (!student || !description.trim()) return
        setSaving(true); setSaveError(null)
        try {
            const created = await createMatronIncident({
                student_id: student.student_pk ?? student.id,
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

    /* The Export button was markup with no handler. What it exports is what the
       filter is currently showing, not the unfiltered set — otherwise the file
       and the screen disagree about what was asked for. */
    function handleExport() {
        downloadCsv(t('matron.incidents.pastReports'), {
            columns: [
                t('common.date'), t('common.student'), t('common.type'),
                t('modals.conduct.severity'), t('matron.incidents.disciplineStatus'),
            ],
            rows: visible.map(r => [r.date, r.name, r.type, r.severity, t(r.statusKey)]),
        })
    }

    if (loading) return (
        <PageLoading
            navItems={matronNavItems} secondaryItems={matronSecondaryItems}
            title={t('matron.incidents.title')}
            subtitle={t('matron.incidents.subtitle')}
            user={sessionUser}
        />
    )
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
                                {/* Typed, not scrolled: a dormitory roll is long
                                    and the whole school's is longer. */}
                                <StudentSearchPicker
                                    value={student}
                                    onChange={setStudent}
                                    fetchStudents={searchMatronStudents}
                                    required
                                />
                                <div className="form-group">
                                    <label className="form-label" htmlFor="incident-type">
                                        {t('matron.incidents.reportType')}
                                    </label>
                                    <FormSelect
                                        id="incident-type"
                                        value={reportType}
                                        onChange={setReportType}
                                        options={REPORT_TYPE_OPTIONS.map(o => ({
                                            value: o.value, label: t(o.labelKey),
                                        }))}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label" htmlFor="incident-severity">
                                        {t('modals.conduct.severity')}
                                    </label>
                                    <FormSelect
                                        id="incident-severity"
                                        value={severity}
                                        onChange={setSeverity}
                                        options={SEVERITY_OPTIONS.map(o => ({
                                            value: o.value, label: t(o.labelKey),
                                        }))}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label" htmlFor="incident-date">
                                        {t('matron.incidents.dateOfIncident')}
                                    </label>
                                    <input
                                        id="incident-date"
                                        className="form-input"
                                        type="date"
                                        value={incidentDate}
                                        onChange={e => setIncidentDate(e.target.value)}
                                    />
                                </div>
                                <div className="form-group u-col-span-full">
                                    <label className="form-label" htmlFor="incident-desc">
                                        {t('common.description')}
                                    </label>
                                    <textarea
                                        id="incident-desc"
                                        className="form-input form-textarea"
                                        placeholder={t('matron.incidents.descPlaceholder')}
                                        value={description}
                                        onChange={e => setDescription(e.target.value)}
                                    />
                                </div>
                                <div className="form-group u-col-span-full">
                                    <label className="form-label" htmlFor="incident-action">
                                        {t('matron.incidents.actionTaken')}
                                    </label>
                                    <textarea
                                        id="incident-action"
                                        className="form-input form-textarea u-min-h-60"
                                        placeholder={t('matron.incidents.actionPlaceholder')}
                                        value={actionTaken}
                                        onChange={e => setActionTaken(e.target.value)}
                                    />
                                </div>
                            </div>
                            {saveError && <p className="u-danger u-fs-085">{saveError}</p>}
                            <div className="btn-row">
                                <button className="btn btn-primary" onClick={handleSubmit} disabled={saving || !student || !description.trim()}>
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
                                <button className="btn btn-outline btn-sm" onClick={handleExport} disabled={!visible.length}>
                                    <span className="material-symbols-rounded icon-sm">download</span> {t('common.export')}
                                </button>
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
