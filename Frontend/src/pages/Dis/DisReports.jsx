import { Sidebar } from '../../components/layout/Sidebar'
import { useState } from 'react'
import { FilterBar } from '../../components/ui/FilterBar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/discipline.css'


import { disNavItems, disSecondaryItems, disUser } from './disNav'
const allRecords = [
    { date: 'Mar 7, 2026',  initials: 'IB', name: 'Ingabire Belise',    classChip: 'S4A', house: 'Karisimbi', houseClass: 'karisimbi',    typeClass: 'negative', type: 'Dormitory',  desc: 'Lights-out violation — phone use after 10 PM',               reportedBy: 'Mrs. Hakizimana',       points: '-2', pointsClass: 'disc-points-neg', status: 'pending'   },
    { date: 'Mar 7, 2026',  initials: 'ND', name: 'Ndagijimana Eric',   classChip: 'S6A', house: 'Muhabura',  houseClass: 'muhabura',     typeClass: 'negative', type: 'Dormitory',  desc: 'Fighting in dormitory — altercation with roommate',           reportedBy: 'Mr. Rugamba Patrick',   points: '-4', pointsClass: 'disc-points-neg', status: 'pending'   },
    { date: 'Mar 6, 2026',  initials: 'NN', name: 'Nzeyimana Naomie',   classChip: 'S1A', house: 'Karisimbi', houseClass: 'karisimbi',    typeClass: 'negative', type: 'Dormitory',  desc: 'Food smuggled into dormitory — snacks found under bed',       reportedBy: 'Mrs. Hakizimana',       points: '-2', pointsClass: 'disc-points-neg', status: 'pending'   },
    { date: 'Mar 5, 2026',  initials: 'MK', name: 'Mukamazimpaka Joy',  classChip: 'S5A', house: 'Sabyinyo',  houseClass: 'sabyinyo', typeClass: 'negative', type: 'Dormitory',  desc: 'Absent from dorm during evening prep without permission',     reportedBy: 'Mr. Mutabazi',          points: '-3', pointsClass: 'disc-points-neg', status: 'pending'   },
    { date: 'Mar 5, 2026',  initials: 'UI', name: 'Uwimana Immaculée',  classChip: 'S2B', house: 'Bisoke',    houseClass: 'bisoke',    typeClass: 'negative', type: 'Dormitory',  desc: 'Noise disturbance after lights out — repeated warning',       reportedBy: 'Mrs. Mukamana Esp.',    points: '-2', pointsClass: 'disc-points-neg', status: 'pending'   },
    { date: 'Mar 5, 2026',  initials: 'HG', name: 'Hakizimana Grace',   classChip: 'S3A', house: 'Sabyinyo',  houseClass: 'sabyinyo', typeClass: 'positive', type: 'Positive',   desc: 'Represented school at Inter-school Debate — 2nd place',      reportedBy: 'Mr. Mutabazi',          points: '+5', pointsClass: 'disc-points-pos', status: 'recorded'  },
    { date: 'Mar 4, 2026',  initials: 'BJ', name: 'Bizimana James',     classChip: 'S5A', house: 'Muhabura',  houseClass: 'muhabura',     typeClass: 'negative', type: 'Misconduct', desc: 'Disruptive behavior in Mathematics class',                    reportedBy: 'Mr. Rurangwa',          points: '-3', pointsClass: 'disc-points-neg', status: 'pending'   },
    { date: 'Mar 3, 2026',  initials: 'UA', name: 'Uwase Amina',        classChip: 'S4A', house: 'Bisoke',    houseClass: 'bisoke',    typeClass: 'warning',  type: 'Late',       desc: 'Late to school without valid reason — 2nd occurrence',       reportedBy: 'Gate Prefect',          points: '-2', pointsClass: 'disc-points-neg', status: 'recorded'  },
    { date: 'Mar 1, 2026',  initials: 'NI', name: 'Niyomugabo Iris',    classChip: 'S2A', house: 'Karisimbi', houseClass: 'karisimbi',    typeClass: 'negative', type: 'Dormitory',  desc: 'Noise in dormitory after curfew (10:30 PM)',                  reportedBy: 'Mrs. Hakizimana',       points: '-2', pointsClass: 'disc-points-neg', status: 'recorded'  },
    { date: 'Feb 28, 2026', initials: 'HS', name: 'Habimana Samuel',    classChip: 'S6B', house: 'Bisoke',    houseClass: 'bisoke',    typeClass: 'warning',  type: 'Uniform',    desc: 'Incorrect uniform — claims uniform was at laundry',          reportedBy: 'Mr. Mutabazi',          points: '-2', pointsClass: 'disc-points-neg', status: 'appeal'    },
    { date: 'Feb 24, 2026', initials: 'UL', name: 'Uwineza Lydia',      classChip: 'S5B', house: 'Karisimbi', houseClass: 'karisimbi',    typeClass: 'positive', type: 'Leadership', desc: 'Selected as Dormitory Prefect of Karisimbi House',            reportedBy: 'Mr. Mutabazi',          points: '+8', pointsClass: 'disc-points-pos', status: 'recorded'  },
    { date: 'Feb 20, 2026', initials: 'NP', name: 'Nkurunziza Peter',   classChip: 'S4B', house: 'Muhabura',  houseClass: 'muhabura',     typeClass: 'negative', type: 'Missing',    desc: 'Not in dormitory at curfew check — found in common room',    reportedBy: 'Mr. Nsabimana Jean',    points: '-4', pointsClass: 'disc-points-neg', status: 'escalated' },
]
const filterOptions = [
    { key: 'all',       label: 'All Records',  },
    { key: 'pending',   label: 'Pending', count: allRecords.filter(r => r.status === 'pending').length },
    { key: 'recorded',  label: 'Approved'      },
    { key: 'escalated', label: 'Escalated'     },
    { key: 'appeal',    label: 'Under Appeal'  },
]




function RecordRow({ initials, name, classChip, house, houseClass, typeClass, type, desc, reportedBy, points, pointsClass, status, onApprove, onReject }) {
    const statusStyles = {
        pending:   { background: 'rgba(245,158,11,0.12)',  color: '#b45309'            },
        recorded:  { background: 'var(--success-light)',   color: 'var(--success)'     },
        escalated: { background: 'var(--destructive-light)', color: 'var(--destructive)' },
        appeal:    { background: 'rgba(79,70,229,0.1)',    color: '#4f46e5'            },
    }
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

export function DisReports() {
    const [filter, setFilter] = useState('all')

    const visible = filter === 'all'
        ? allRecords
        : allRecords.filter(r => r.status === filter)


    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={disNavItems} secondaryItems={disSecondaryItems} />

                <main className="dashboard-main" id="main-content">
                    <DashboardHeader title="Discipline Reports" subtitle="Incident approval queue and full records \u2014 Term 2, 2026" {...disUser} />

                    <div className="dashboard-content">
                        
                        {/* Filter chips */}
                        <FilterBar
                            options={filterOptions}
                            active={filter}
                            onChange={setFilter}
                        />

                        {/*Table*/}
                        <div className="card">
                            <div className="card-content">
                                <div className="table-responsive">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Student</th>
                                                <th>Class</th>
                                                <th>Dormitory</th>
                                                <th>Type</th>
                                                <th>Description</th>
                                                <th>Reported By</th>
                                                <th>Points</th>
                                                <th>Status</th>
                                                {filter === 'pending' && <th>Actions</th>}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {visible.map((row, i) => (
                                                <RecordRow
                                                    key={i}
                                                    {...row}
                                                    onApprove={filter === 'pending' ? () => {} : undefined}
                                                    onReject={filter === 'pending'  ? () => {} : undefined}
                                                />
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </>
    )
}
