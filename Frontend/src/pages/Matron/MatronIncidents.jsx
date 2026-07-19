import { Sidebar } from '../../components/layout/Sidebar'
import { Link } from 'react-router'
import { FilterBar } from '../../components/ui/FilterBar'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/matron.css'
import { useEffect, useState } from 'react'
import { matronNavItems, matronSecondaryItems, matronUser } from './matronNav'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { useSchoolSettings } from '../../hooks/useSchoolSetting'
import { formatSchoolDate } from '../../utils/date'
import { getMatronIncidents, createMatronIncident, getMatronStudents } from '../../api/matron'
import { useSessionUser } from '../../hooks/useSessionUser'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useNotifications } from '../../hooks/useNotifications'
import { Loading } from '../../components/ui/Loading'


const STATUS_STYLE = {
    pending_review: { statusClass: 'pending',  status: 'Pending Review' },
    approved:       { statusClass: 'reviewed', status: 'Reviewed'        },
    rejected:       { statusClass: 'reviewed', status: 'Rejected'        },
}

const SEVERITY_STYLE = {
    minor:    { background: 'var(--muted)', color: 'var(--muted-text)' },
    moderate: { background: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
    serious:  { background: 'var(--destructive-light)', color: 'var(--destructive)' },
    critical: { background: 'var(--destructive-light)', color: 'var(--destructive)' },
}

function PastReportRow({ date, name, type, severityStyle, severity, statusClass, status }) {
    return (
        <tr>
            <td>{date}</td>
            <td><strong>{name}</strong></td>
            <td>{type}</td>
            <td><span className="badge" style={severityStyle}>{severity}</span></td>
            <td><span className={`matron-report-status ${statusClass}`}>{status}</span></td>
        </tr>
    )
}

export function MatronIncidents() {
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
            setSaveError(e?.message || 'Failed to submit report.')
        } finally {
            setSaving(false)
        }
    }

    const pastReports = reports.map(r => ({
        date: r.date,
        name: r.student_name,
        type: r.badge,
        severityStyle: SEVERITY_STYLE[r.severity] || SEVERITY_STYLE.minor,
        severity: r.severity ? r.severity[0].toUpperCase() + r.severity.slice(1) : r.report_type,
        ...(STATUS_STYLE[r.status] || STATUS_STYLE.pending_review),
    }))

    const filterOptions = [
        { key: 'all',      label: 'All Reports' },
        { key: 'pending',  label: 'Pending', count: pastReports.filter(r => r.statusClass === 'pending').length },
        { key: 'reviewed', label: 'Reviewed' },
    ]

    const visible = filter === 'all'
        ? pastReports
        : pastReports.filter(r => r.statusClass === filter)

    if (loading) return <Loading fullPage />
    if (error) return <p className="u-pad u-danger">Error: {error}</p>

    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>

            <div className="dashboard-layout">
                <Sidebar navItems={matronNavItems} secondaryItems={matronSecondaryItems} />

                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title="Report Incident"
                        subtitle="Submit incident reports directly to the Director of Discipline"
                        {...sessionUser}
                        notifications={liveNotifications}
                        onNotificationRead={markRead}
                    />

                    <DashboardContent>

                        <div className="incident-form-card">
                            <div className="incident-form-title">
                                <span className="material-symbols-rounded">report</span> New Incident Report: {matronUser.userRole.split(',').pop().trim()} &rarr; Discipline Master
                            </div>
                            <div className="incident-form-grid">
                                <div className="form-field">
                                    <label>Student</label>
                                    <select value={studentId} onChange={e => setStudentId(e.target.value)}>
                                        <option value="">Select student...</option>
                                        {students.map(s => (
                                            <option key={s.student_pk} value={s.student_pk}>
                                                {s.full_name} (S{s.grade}{s.section})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-field">
                                    <label>Report Type</label>
                                    <select value={reportType} onChange={e => setReportType(e.target.value)}>
                                        <option value="incident">Incident</option>
                                        <option value="warning">Warning</option>
                                        <option value="positive">Positive Report</option>
                                        <option value="achievement">Achievement</option>
                                    </select>
                                </div>
                                <div className="form-field">
                                    <label>Severity</label>
                                    <select value={severity} onChange={e => setSeverity(e.target.value)}>
                                        <option value="minor">Minor</option>
                                        <option value="moderate">Moderate</option>
                                        <option value="serious">Serious</option>
                                        <option value="critical">Critical (Requires Immediate Action)</option>
                                    </select>
                                </div>
                                <div className="form-field">
                                    <label>Date of Incident</label>
                                    <input type="date" value={incidentDate} onChange={e => setIncidentDate(e.target.value)} />
                                </div>
                                <div className="form-field form-field-full">
                                    <label>Description</label>
                                    <textarea
                                        placeholder="Describe the incident in detail: what happened, where, who was involved, any witnesses..."
                                        value={description}
                                        onChange={e => setDescription(e.target.value)}
                                    />
                                </div>
                                <div className="form-field form-field-full">
                                    <label>Action Taken (if any)</label>
                                    <textarea
                                        placeholder="What immediate action did you take? (e.g. verbal warning, parent called, student confined to dorm)"
                                        className="u-min-h-60"
                                        value={actionTaken}
                                        onChange={e => setActionTaken(e.target.value)}
                                    />
                                </div>
                            </div>
                            {saveError && <p className="u-danger u-fs-085">{saveError}</p>}
                            <div className="btn-row">
                                <button className="btn btn-primary" onClick={handleSubmit} disabled={saving || !studentId || !description.trim()}>
                                    <span className="material-symbols-rounded">send</span> {saving ? 'Submitting…' : 'Submit to Discipline'}
                                </button>
                                <button className="btn btn-outline" onClick={resetForm}>Clear Form</button>
                            </div>
                        </div>

                        <FilterBar
                            options={filterOptions}
                            active={filter}
                            onChange={setFilter}
                        />
                        
                        <div className="card">
                            <div className="card-header">
                                <h3 className="card-title"><span className="material-symbols-rounded">history</span> My Past Reports</h3>
                                <button className="btn btn-outline btn-sm"><span className="material-symbols-rounded">download</span> Export</button>
                            </div>
                            <div className="card-content">
                                <div className="table-responsive">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Date</th>
                                                <th>Student</th>
                                                <th>Type</th>
                                                <th>Severity</th>
                                                <th>Discipline Status</th>
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
