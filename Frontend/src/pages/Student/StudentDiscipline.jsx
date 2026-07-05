import { useState, useEffect } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useNotifications } from '../../hooks/useNotifications'
import { studentNavItems, studentSecondaryItems } from './studentNav'
import { getStudentProfile, getStudentDiscipline } from '../../api/student'
import { useSchoolSettings } from '../../hooks/useSchoolSetting'
import { formatSchoolDate } from '../../utils/date'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/student.css'

// Static school policy data — not from DB
const conductCategories = [
    { cardClass: 'uniform',  iconClass: 'orange', icon: 'checkroom',  title: 'Uniform & Appearance',     rules: [
        'Full school uniform must be worn every school day',
        'School tie required from Monday to Friday',
        'Hair must be natural — no dye, extensions, or elaborate styles',
        'No jewellery except a plain wristwatch',
        'Shoes must be plain black and well-polished',
    ]},
    { cardClass: 'attend',   iconClass: 'amber',  icon: 'schedule',   title: 'Attendance & Punctuality', rules: [
        'Gates close at 7:25 AM — late arrival requires a late pass',
        'All absences must be explained by a signed parent/guardian note',
        'Minimum 85% attendance required per term',
        'Leaving school grounds requires written permission from administration',
    ]},
    { cardClass: 'academic', iconClass: 'green',  icon: 'school',     title: 'Academic Integrity',       rules: [
        'Cheating or copying in any assessment is a serious offence',
        'Plagiarism in assignments will result in a zero mark',
        'Electronic devices are not allowed in examinations',
        'All work submitted must be original and the student\'s own',
    ]},
    { cardClass: 'boarding', iconClass: 'purple', icon: 'home',       title: 'Dormitory & Boarding',     rules: [
        'Lights out at 10:15 PM — no exceptions',
        'No visitors of the opposite gender in dormitories at any time',
        'Students are responsible for cleanliness of their rooms',
        'All personal valuables must be stored in locked trunks',
    ]},
    { cardClass: 'digital',  iconClass: 'teal',   icon: 'devices',    title: 'Digital & Technology Use', rules: [
        'Personal phones are permitted after 4:30 PM only',
        'Phones must be surrendered to matron by 9:30 PM on school nights',
        'Social media posts that disparage the school or staff are prohibited',
        'School computers are for academic use only',
    ]},
    { cardClass: '',         iconClass: '',       icon: 'groups',     title: 'General Conduct',           rules: [
        'Bullying, harassment, or intimidation of any kind is strictly prohibited',
        'Students must address all staff respectfully at all times',
        'Damage to school property will result in repair costs and disciplinary action',
        'Possession of contraband (alcohol, tobacco, drugs) leads to immediate suspension',
    ]},
]

const appealSteps = [
    { num: 1, title: 'Submit Written Appeal',            desc: 'Write a formal appeal letter to the Director of Discipline within 48 hours of the decision' },
    { num: 2, title: 'Discipline Master Review Meeting', desc: 'Meet with the Director of Discipline to present your case and provide supporting evidence'    },
    { num: 3, title: 'Review Panel (if needed)',         desc: 'For serious cases, a panel of senior staff and parent representative will convene'            },
    { num: 4, title: 'Final Decision',                   desc: 'A written decision is communicated to the student and parent/guardian within 5 school days'  },
]

const TYPE_FILTER_TABS = ['All', 'Positive', 'Negative', 'Warning']

function typeMatch(report, filter) {
    if (filter === 'All')      return true
    if (filter === 'Positive') return report.report_type === 'positive' || report.report_type === 'achievement'
    if (filter === 'Negative') return report.report_type === 'incident'
    if (filter === 'Warning')  return report.report_type === 'warning'
    return true
}

function reportBadge(type) {
    switch (type) {
        case 'positive':    return { bg: 'var(--success-light)',     color: 'var(--success)',     label: 'Positive'    }
        case 'achievement': return { bg: 'var(--success-light)',     color: 'var(--success)',     label: 'Achievement' }
        case 'warning':     return { bg: 'rgba(245,158,11,0.12)',    color: '#f59e0b',            label: 'Warning'     }
        case 'incident':    return { bg: 'var(--destructive-light)', color: 'var(--destructive)', label: 'Negative'    }
        default:            return { bg: '',                         color: '',                   label: type          }
    }
}

function pointsDisplay(type) {
    if (type === 'positive' || type === 'achievement') return { label: '+', cls: 'disc-points-pos' }
    if (type === 'incident')                            return { label: '-', cls: 'disc-points-neg' }
    if (type === 'warning')                             return { label: 'W', cls: ''               }
    return { label: '—', cls: '' }
}

function DisciplineRow({ report }) {
    const badge  = reportBadge(report.report_type)
    const points = pointsDisplay(report.report_type)
    const dateStr = report.date
        ? new Date(report.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : '—'
    return (
        <tr>
            <td>{dateStr}</td>
            <td><span className="badge" style={{ background: badge.bg, color: badge.color }}>{badge.label}</span></td>
            <td>{report.description}</td>
            <td>{report.reported_by || '—'}</td>
            <td>
                {points.cls
                    ? <span className={points.cls}>{points.label}</span>
                    : <span className="text-warning-bold">{points.label}</span>
                }
            </td>
        </tr>
    )
}

function ConductCategory({ cardClass, iconClass, icon, title, rules }) {
    return (
        <div className={`conduct-category-card ${cardClass}`}>
            <div className="conduct-category-header">
                <div className={`conduct-category-icon ${iconClass}`}>
                    <span className="material-symbols-rounded">{icon}</span>
                </div>
                <span className="conduct-category-title">{title}</span>
            </div>
            <ul className="rule-list">
                {rules.map((rule, i) => <li key={i}>{rule}</li>)}
            </ul>
        </div>
    )
}

function AppealStep({ num, title, desc }) {
    return (
        <div className="appeal-step">
            <div className="appeal-step-num">{num}</div>
            <div className="appeal-step-text">
                <strong>{title}</strong>
                <span>{desc}</span>
            </div>
        </div>
    )
}

export function StudentDiscipline() {
    const [profile,    setProfile]    = useState(null)
    const [discipline, setDiscipline] = useState(null)
    const [loading,    setLoading]    = useState(true)
    const [typeFilter, setTypeFilter] = useState('All')
    const { notifications: liveNotifications, markRead } = useNotifications()
    const { setting } = useSchoolSettings()

    const storedUser = JSON.parse(localStorage.getItem('imboni_user') || '{}')
    const firstName  = storedUser.first_name || ''
    const lastName   = storedUser.last_name  || ''
    const fullName   = storedUser.full_name  || `${firstName} ${lastName}`.trim()
    const initials   = `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase()

    useEffect(() => {
        Promise.all([
            getStudentProfile().catch(() => null),
            getStudentDiscipline().catch(() => null),
        ]).then(([prof, disc]) => {
            setProfile(prof)
            setDiscipline(disc)
        }).finally(() => setLoading(false))
    }, [])

    const gradeSection = profile ? `${profile.grade}${profile.section}` : ''
    const userRole     = gradeSection ? `Student · ${gradeSection}` : 'Student'

    const reports      = discipline?.reports      || []
    const conductGrade = discipline?.conduct_grade || '—'
    const conductLabel = discipline?.conduct_label || 'No grade yet'

    const positiveCount = reports.filter(r => r.report_type === 'positive' || r.report_type === 'achievement').length
    const negativeCount = reports.filter(r => r.report_type === 'incident').length
    const warningCount  = reports.filter(r => r.report_type === 'warning').length

    const conductStats = [
        { iconClass: 'teal',  icon: 'verified',   value: loading ? '—' : conductGrade,    valueColor: 'var(--student)',     label: 'Conduct Grade'   },
        { iconClass: 'green', icon: 'thumb_up',   value: loading ? '—' : `+${positiveCount}`, valueColor: 'var(--success)',  label: 'Positive Points' },
        { iconClass: 'red',   icon: 'thumb_down', value: loading ? '—' : `-${negativeCount}`, valueColor: 'var(--destructive)', label: 'Negative Points' },
        { iconClass: 'blue',  icon: 'shield',     value: loading ? '—' : conductLabel,    valueColor: 'var(--primary)',     label: 'Current Standing'},
    ]

    const filteredReports = reports.filter(r => typeMatch(r, typeFilter))

    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={studentNavItems} secondaryItems={studentSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title="Discipline"
                        subtitle="School rules, your discipline record & appeals"
                        userName={fullName || 'Student'}
                        userRole={userRole}
                        userInitials={initials}
                        avatarClass="student-av"
                        notifications={liveNotifications}
                        onNotificationRead={markRead}
                    />

                    <DashboardContent>

                        {/* Conduct stat cards */}
                        <div className="student-stats-grid mb-1-5">
                            {conductStats.map((stat, i) => (
                                <div key={i} className="student-stat-card">
                                    <div className={`stat-icon ${stat.iconClass}`}>
                                        <span className="material-symbols-rounded">{stat.icon}</span>
                                    </div>
                                    <div className="stat-body">
                                        <div className="stat-value" style={{ color: stat.valueColor }}>{stat.value}</div>
                                        <div className="stat-label">{stat.label}</div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Discipline records */}
                        <div className="card mb-1-5">
                            <div className="card-header">
                                <h3 className="card-title">
                                    <span className="material-symbols-rounded">history</span> My Discipline Records
                                </h3>
                                <div className="filter-tabs-bar mb-0 mt-0">
                                    {TYPE_FILTER_TABS.map(t => (
                                        <button
                                            key={t}
                                            className={`filter-tab${typeFilter === t ? ' active' : ''}`}
                                            onClick={() => setTypeFilter(t)}
                                        >
                                            {t}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="card-content">
                                {loading ? (
                                    <p style={{ color: 'var(--muted-foreground)' }}>Loading records…</p>
                                ) : filteredReports.length === 0 ? (
                                    <p style={{ color: 'var(--muted-foreground)' }}>
                                        No {typeFilter.toLowerCase() !== 'all' ? typeFilter.toLowerCase() + ' ' : ''}records found.
                                    </p>
                                ) : (
                                    <div className="table-responsive">
                                        <table>
                                            <thead>
                                                <tr>
                                                    <th>Date</th><th>Type</th><th>Description</th>
                                                    <th>Issued By</th><th>Points</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredReports.map(r => <DisciplineRow key={r.id} report={r} />)}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Code of conduct — static school policy */}
                        <div className="mb-3">
                            <h3 className="flex-row-gap-sm" style={{ fontWeight: 700, fontSize: '1rem' }}>
                                <span className="material-symbols-rounded">menu_book</span> Code of Conduct
                            </h3>
                        </div>
                        <div className="conduct-rules-grid">
                            {conductCategories.map((cat, i) => <ConductCategory key={i} {...cat} />)}
                        </div>

                        {/* Appeals process — static school policy */}
                        <div className="card mt-1-5">
                            <div className="card-header">
                                <h3 className="card-title">
                                    <span className="material-symbols-rounded">balance</span> Appeals Process
                                </h3>
                            </div>
                            <div className="card-content">
                                <div className="appeal-steps">
                                    {appealSteps.map((step, i) => <AppealStep key={i} {...step} />)}
                                </div>
                            </div>
                        </div>

                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
