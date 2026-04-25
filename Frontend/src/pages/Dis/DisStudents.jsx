import { Sidebar } from '../../components/layout/Sidebar'
import { FilterBar } from '../../components/ui/FilterBar'
import { ClassPicker } from '../../components/ui/ClassPicker'
import { StudentConductModal } from '../../components/modals/StudentConductModal'
import { DataTable } from '../../components/ui/DataTable'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { disNavItems, disSecondaryItems, disUser } from './disNav'
import { useSchoolConfig } from '../../hooks/useSchoolConfig'
import { useState } from 'react'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/discipline.css'
import { DashboardContent } from '../../components/layout/DashboardContent'


// ── Students tab data ──
const students = [
    { avClass: 'matron', initials: 'MK', name: 'Mukamazimpaka Sandra', classChip: 'S1B',   section: 'O-Level', year: 'S1', class: 'B',   adm: '2024-S1-001', house: 'Sabyinyo',  houseClass: 'sabyinyo', score: 92, pos: '+18', neg: '-2',  conductClass: 'excellent', conduct: 'Excellent' },
    { avClass: 'patron', initials: 'NP', name: 'Nsabimana Patrick',    classChip: 'S2B',   section: 'O-Level', year: 'S2', class: 'B',   adm: '2024-S2-002', house: 'Karisimbi', houseClass: 'karisimbi',    score: 68, pos: '+5',  neg: '-12', conductClass: 'fair',      conduct: 'Fair'      },
    { avClass: 'matron', initials: 'IM', name: 'Ingabire Marie',        classChip: 'S3B',   section: 'O-Level', year: 'S3', class: 'B',   adm: '2024-S3-003', house: 'Bisoke',    houseClass: 'bisoke',    score: 85, pos: '+14', neg: '-3',  conductClass: 'good',      conduct: 'Good'      },
    { avClass: 'patron', initials: 'ND', name: 'Ndagijimana Eric',      classChip: 'S6A',   section: 'A-Level', year: 'S6', class: 'A',   adm: '2024-S6-004', house: 'Muhabura',  houseClass: 'muhabura',     score: 45, pos: '+2',  neg: '-25', conductClass: 'poor',      conduct: 'Poor'      },
    { avClass: 'matron', initials: 'UA', name: 'Uwase Amina',           classChip: 'S4A',   section: 'A-Level', year: 'S4', class: 'A',   adm: '2024-S4-005', house: 'Bisoke',    houseClass: 'bisoke',    score: 95, pos: '+22', neg: '0',   conductClass: 'excellent', conduct: 'Excellent' },
    { avClass: 'patron', initials: 'BJ', name: 'Bizimana James',        classChip: 'S5A',   section: 'A-Level', year: 'S5', class: 'A',   adm: '2024-S5-006', house: 'Karisimbi', houseClass: 'karisimbi',    score: 74, pos: '+10', neg: '-6',  conductClass: 'good',      conduct: 'Good'      },
    { avClass: 'matron', initials: 'UL', name: 'Uwineza Lydia',         classChip: 'S5B',   section: 'A-Level', year: 'S5', class: 'B',   adm: '2024-S5-007', house: 'Bisoke',    houseClass: 'bisoke',    score: 88, pos: '+16', neg: '-1',  conductClass: 'excellent', conduct: 'Excellent' },
]

const conductFilterOptions = [
    { key: 'all',       label: 'All'       },
    { key: 'excellent', label: 'Excellent' },
    { key: 'good',      label: 'Good'      },
    { key: 'fair',      label: 'Fair'      },
    { key: 'poor',      label: 'Poor'      },
]

function StudentRow({ avClass, initials, name, classChip, adm, house, houseClass, score, pos, neg, conductClass, conduct, onView }) {
    return (
        <tr>
            <td><div className="student-inline"><div className={`student-av-sm ${avClass}`}>{initials}</div>{name}</div></td>
            <td><span className="class-chip">{classChip}</span></td>
            <td className="text-muted">{adm}</td>
            <td><span className={`disc-badge ${houseClass}`}>{house}</span></td>
            <td><strong>{score}</strong></td>
            <td><span className="disc-points-pos">{pos}</span></td>
            <td><span className="disc-points-neg">{neg}</span></td>
            <td><span className={`conduct-badge ${conductClass}`}>{conduct}</span></td>
            <td className="action-cell">
                <button className="btn btn-primary btn-sm" onClick={onView}>View</button>
            </td>
        </tr>
    )
}

// ── Reports tab data ──
const allRecords = [
    { date: 'Mar 7, 2026',  initials: 'HG', name: 'Hakizimana Grace',   classChip: 'S3A', house: 'Bisoke',    houseClass: 'bisoke',    typeClass: 'negative', type: 'Dormitory',  desc: 'Lights-out violation — phone use after 10 PM',               reportedBy: 'Mrs. Mukamana Esperance', points: '-2', pointsClass: 'disc-points-neg', status: 'pending'   },
    { date: 'Mar 7, 2026',  initials: 'NE', name: 'Ndagijimana Eric',   classChip: 'S6A', house: 'Muhabura',  houseClass: 'muhabura',     typeClass: 'negative', type: 'Dormitory',  desc: 'Fighting in dormitory — altercation with roommate',          reportedBy: 'Mr. Rugamba Patrick',    points: '-4', pointsClass: 'disc-points-neg', status: 'pending'   },
    { date: 'Mar 6, 2026',  initials: 'IM', name: 'Ingabire Marie',     classChip: 'S3B', house: 'Bisoke',    houseClass: 'bisoke',    typeClass: 'negative', type: 'Dormitory',  desc: 'Food smuggled into dormitory — snacks found under bed',       reportedBy: 'Mrs. Mukamana Esperance', points: '-2', pointsClass: 'disc-points-neg', status: 'pending'   },
    { date: 'Mar 5, 2026',  initials: 'MK', name: 'Mutabazi Kevin',     classChip: 'S4A', house: 'Karisimbi', houseClass: 'karisimbi',    typeClass: 'negative', type: 'Dormitory',  desc: 'Absent from dorm during evening prep without permission',     reportedBy: 'Mr. Mutabazi',           points: '-3', pointsClass: 'disc-points-neg', status: 'pending'   },
    { date: 'Mar 5, 2026',  initials: 'UL', name: 'Uwineza Lydia',      classChip: 'S5B', house: 'Bisoke',    houseClass: 'bisoke',    typeClass: 'negative', type: 'Dormitory',  desc: 'Noise disturbance after lights out — repeated warning',       reportedBy: 'Mrs. Mukamana Esperance', points: '-2', pointsClass: 'disc-points-neg', status: 'pending'   },
    { date: 'Mar 5, 2026',  initials: 'HG', name: 'Hakizimana Grace',   classChip: 'S3A', house: 'Bisoke',    houseClass: 'bisoke',    typeClass: 'positive', type: 'Positive',   desc: 'Represented school at Inter-school Debate — 2nd place',      reportedBy: 'Mr. Mutabazi',           points: '+5', pointsClass: 'disc-points-pos', status: 'recorded'  },
    { date: 'Mar 4, 2026',  initials: 'BJ', name: 'Bizimana James',     classChip: 'S5A', house: 'Karisimbi', houseClass: 'karisimbi',    typeClass: 'negative', type: 'Misconduct', desc: 'Disruptive behavior in Mathematics class',                    reportedBy: 'Mr. Rurangwa Pacifique', points: '-3', pointsClass: 'disc-points-neg', status: 'pending'   },
    { date: 'Mar 3, 2026',  initials: 'UA', name: 'Uwase Amina',        classChip: 'S4A', house: 'Bisoke',    houseClass: 'bisoke',    typeClass: 'warning',  type: 'Late',       desc: 'Late to school without valid reason — 2nd occurrence',       reportedBy: 'Gate Prefect',           points: '-2', pointsClass: 'disc-points-neg', status: 'recorded'  },
    { date: 'Mar 1, 2026',  initials: 'NP', name: 'Nsabimana Patrick',  classChip: 'S2B', house: 'Karisimbi', houseClass: 'karisimbi',    typeClass: 'negative', type: 'Dormitory',  desc: 'Noise in dormitory after curfew (10:30 PM)',                  reportedBy: 'Mrs. Hakizimana Gloriose', points: '-2', pointsClass: 'disc-points-neg', status: 'recorded'  },
    { date: 'Feb 28, 2026', initials: 'HS', name: 'Habimana Samuel',    classChip: 'S6B', house: 'Muhabura',  houseClass: 'muhabura',     typeClass: 'warning',  type: 'Uniform',    desc: 'Incorrect uniform — claims uniform was at laundry',          reportedBy: 'Mr. Mutabazi',           points: '-2', pointsClass: 'disc-points-neg', status: 'appeal'    },
    { date: 'Feb 24, 2026', initials: 'UL', name: 'Uwineza Lydia',      classChip: 'S5B', house: 'Bisoke',    houseClass: 'bisoke',    typeClass: 'positive', type: 'Leadership', desc: 'Selected as Dormitory Prefect of Bisoke House',              reportedBy: 'Mr. Mutabazi',           points: '+8', pointsClass: 'disc-points-pos', status: 'recorded'  },
    { date: 'Feb 20, 2026', initials: 'NP', name: 'Nkurunziza Peter',   classChip: 'S4B', house: 'Muhabura',  houseClass: 'muhabura',     typeClass: 'negative', type: 'Missing',    desc: 'Not in dormitory at curfew check — found in common room',    reportedBy: 'Mr. Rugamba Patrick',    points: '-4', pointsClass: 'disc-points-neg', status: 'escalated' },
]

const reportFilterOptions = [
    { key: 'all',       label: 'All Records'                                                             },
    { key: 'pending',   label: 'Pending',      count: allRecords.filter(r => r.status === 'pending').length },
    { key: 'recorded',  label: 'Approved'                                                                },
    { key: 'escalated', label: 'Escalated'                                                               },
    { key: 'appeal',    label: 'Under Appeal'                                                            },
]

const statusStyles = {
    pending:   { background: 'rgba(245,158,11,0.12)',    color: '#b45309'              },
    recorded:  { background: 'var(--success-light)',     color: 'var(--success)'       },
    escalated: { background: 'var(--destructive-light)', color: 'var(--destructive)'   },
    appeal:    { background: 'rgba(79,70,229,0.1)',      color: '#4f46e5'              },
}

function RecordRow({ initials, name, classChip, house, houseClass, typeClass, type, desc, reportedBy, points, pointsClass, status, onApprove, onReject }) {
    return (
        <tr>
            <td><div className="student-inline"><div className={`student-av-sm ${houseClass}`}>{initials}</div>{name}</div></td>
            <td><span className="class-chip">{classChip}</span></td>
            <td><span className={`disc-badge ${houseClass}`}>{house}</span></td>
            <td><span className={`incident-type-tag ${typeClass}`}>{type}</span></td>
            <td>{desc}</td>
            <td>{reportedBy}</td>
            <td><span className={pointsClass}>{points}</span></td>
            <td><span className="badge" style={statusStyles[status]}>{status.charAt(0).toUpperCase() + status.slice(1)}</span></td>
            {(onApprove || onReject) && (
                <td className="action-cell">
                    <button className="btn btn-primary btn-sm" onClick={onApprove}>Approve</button>
                    <button className="btn btn-outline btn-sm" onClick={onReject}>Reject</button>
                </td>
            )}
        </tr>
    )
}

// ── Main page ──
export function DisStudents() {
    const { config } = useSchoolConfig()
    const [activeTab, setActiveTab] = useState('students')

    // Students tab state
    const [conductFilter, setConductFilter] = useState('all')
    const [section, setSection] = useState('')
    const [year, setYear] = useState('')
    const [classVal, setClassVal] = useState('')
    const [modal, setModal] = useState(null)

    const visibleStudents = students.filter(s => {
        if (conductFilter !== 'all' && s.conductClass !== conductFilter) return false
        if (section && s.section !== section) return false
        if (year && s.year !== year) return false
        if (classVal && s.class !== classVal) return false
        return true
    })

    // Reports tab state
    const [reportFilter, setReportFilter] = useState('all')
    const [records, setRecords] = useState(allRecords)

    const visibleRecords = reportFilter === 'all'
        ? records
        : records.filter(r => r.status === reportFilter)

    function approveRecord(idx) {
        setRecords(prev => prev.map((r, i) => i === idx ? { ...r, status: 'recorded' } : r))
    }
    function rejectRecord(idx) {
        setRecords(prev => prev.map((r, i) => i === idx ? { ...r, status: 'escalated' } : r))
    }

    return (
        <>
            <StudentConductModal student={modal?.student} onClose={() => setModal(null)} />
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={disNavItems} secondaryItems={disSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title="Students"
                        subtitle="Conduct records, incident reports and disciplinary queue — Term 2, 2026"
                        {...disUser}
                    />

                    <DashboardContent>

                        {/* Tab switcher */}
                        <div className="filter-tabs-bar mb-5">
                            <button
                                className={`filter-tab${activeTab === 'students' ? ' active' : ''}`}
                                onClick={() => setActiveTab('students')}
                            >
                                <span className="material-symbols-rounded">people</span> Conduct Records
                            </button>
                            <button
                                className={`filter-tab${activeTab === 'reports' ? ' active' : ''}`}
                                onClick={() => setActiveTab('reports')}
                            >
                                <span className="material-symbols-rounded">report</span> Incident Reports
                                {records.filter(r => r.status === 'pending').length > 0 && (
                                    <span className="approval-count-badge">
                                        {records.filter(r => r.status === 'pending').length}
                                    </span>
                                )}
                            </button>
                        </div>

                        {/* ── STUDENTS TAB ── */}
                        {activeTab === 'students' && (
                            <>
                                <ClassPicker
                                    sections={config.sections}
                                    section={section} onSectionChange={setSection}
                                    year={year} onYearChange={setYear}
                                    classVal={classVal} onClassChange={setClassVal}
                                />

                                <div className="disc-stat-grid">
                                    {[
                                        { iconClass: 'info',    icon: 'groups',   value: visibleStudents.length,                                        label: 'Students Shown'     },
                                        { iconClass: 'success', icon: 'star',     value: visibleStudents.filter(s => s.conductClass === 'excellent').length, label: 'Excellent Standing' },
                                        { iconClass: 'warning', icon: 'warning',  value: visibleStudents.filter(s => s.conductClass === 'fair').length,  label: 'Fair / At Risk'     },
                                        { iconClass: 'red',     icon: 'cancel',   value: visibleStudents.filter(s => s.conductClass === 'poor').length,  label: 'Poor Conduct'       },
                                    ].map((stat, i) => (
                                        <div key={i} className="disc-stat-card">
                                            <div className={`disc-stat-icon ${stat.iconClass}`}><span className="material-symbols-rounded">{stat.icon}</span></div>
                                            <div>
                                                <div className="disc-stat-value">{stat.value}</div>
                                                <div className="disc-stat-label">{stat.label}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="card mb-1-5">
                                    <div className="card-content">
                                        <div className="filter-tabs-bar mt-0">
                                            <FilterBar options={conductFilterOptions} active={conductFilter} onChange={setConductFilter} />
                                        </div>
                                    </div>
                                </div>

                                <DataTable
                                    title="Student Conduct Records"
                                    data={visibleStudents}
                                    columns={['Student','Class','Adm #','Dormitory','Score','Pos','Neg','Standing','Actions']}
                                    renderRow={(student, index) => <StudentRow key={index} {...student} onView={() => setModal({ student })} />}
                                    emptyIcon="people"
                                    emptyTitle="No students found"
                                    emptyDesc="No students match the selected conduct filter and class."
                                    onClearFilters={() => { setConductFilter('all'); setSection(''); setYear(''); setClassVal('') }}
                                />
                            </>
                        )}

                        {/* ── REPORTS TAB ── */}
                        {activeTab === 'reports' && (
                            <>
                                <FilterBar
                                    options={reportFilterOptions}
                                    active={reportFilter}
                                    onChange={setReportFilter}
                                />

                                <DataTable
                                    title="Incident Approval Queue"
                                    data={visibleRecords}
                                    columns={['Student','Class','Dormitory','Type','Description','Reported By','Points','Status',...(reportFilter==='pending'?['Actions']:[])]}
                                    renderRow={(row, i) => (
                                        <RecordRow key={i} {...row}
                                            onApprove={reportFilter==='pending' ? () => approveRecord(records.indexOf(row)) : undefined}
                                            onReject={reportFilter==='pending'  ? () => rejectRecord(records.indexOf(row))  : undefined}
                                        />
                                    )}
                                    emptyIcon="report"
                                    emptyTitle="No incident records"
                                    emptyDesc={reportFilter==='all' ? 'No incidents have been reported.' : `No ${reportFilter} incidents found.`}
                                    onClearFilters={reportFilter!=='all' ? () => setReportFilter('all') : undefined}
                                />
                            </>
                        )}

                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
