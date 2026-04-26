import { useState } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { EmptyState } from '../../components/ui/EmptyState'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/student.css'
import { studentNavItems, studentSecondaryItems, studentUser } from './studentNav'
import { DashboardContent } from '../../components/layout/DashboardContent'


const boardingInfos = [
  { label: 'Dormitory', value: 'Karisimbi House', sub: 'Room 14B · Girls Wing' },
  { label: 'Dining Table', value: 'Table 7', sub: 'Main Dining Hall · Seat 3' },
  { label: 'Dormitory Supervisor', value: 'Mrs. Hakizimana', sub: 'Ext. 204 · House Office' },
  { label: 'Director of Discipline', value: 'Mr. Mutabazi', sub: 'Discipline Office · Block C' },
  { label: 'Emergency Contact', value: 'Mrs. Chantal Uwase', sub: '+250 788 000 001 (Parent)' },
]

const disciplineRecords = [
  { date: 'Mar 7, 2026',  type: 'Positive', typeClass: 'disc-type-positive', description: 'Top scorer in Mathematics CAT 2',                      recordedBy: 'Mr. Rurangwa',   points: '+5', pointsClass: 'disc-points-pos', statusLabel: 'Awarded', statusClass: 'badge-soft-success' },
  { date: 'Mar 4, 2026',  type: 'Positive', typeClass: 'disc-type-positive', description: 'Volunteered for library organization',                  recordedBy: 'Mr. Mutabazi',   points: '+3', pointsClass: 'disc-points-pos', statusLabel: 'Awarded', statusClass: 'badge-soft-success' },
  { date: 'Mar 4, 2026',  type: 'Negative', typeClass: 'disc-type-negative', description: 'Late to first period class',                            recordedBy: 'Ms. Uwera',      points: '-2', pointsClass: 'disc-points-neg', statusLabel: 'Noted',   statusClass: 'badge-soft-danger'  },
  { date: 'Feb 28, 2026', type: 'Positive', typeClass: 'disc-type-positive', description: 'Outstanding English essay — class commendation',        recordedBy: 'Ms. Umutoni',    points: '+5', pointsClass: 'disc-points-pos', statusLabel: 'Awarded', statusClass: 'badge-soft-success' },
  { date: 'Feb 20, 2026', type: 'Warning',  typeClass: 'disc-type-warning',  description: 'Dormitory lights on after curfew (10:30 PM)',           recordedBy: 'Mrs. Hakizimana',points: '-3', pointsClass: 'disc-points-neg', statusLabel: 'Warning', statusClass: 'badge-soft-warning' },
  { date: 'Feb 14, 2026', type: 'Positive', typeClass: 'disc-type-positive', description: 'Represented school at Science Fair — 2nd place',        recordedBy: 'Mr. Mutabazi',   points: '+8', pointsClass: 'disc-points-pos', statusLabel: 'Awarded', statusClass: 'badge-soft-success' },
  { date: 'Jan 30, 2026', type: 'Positive', typeClass: 'disc-type-positive', description: 'Helped new students during orientation week',            recordedBy: 'Mr. Mutabazi',   points: '+3', pointsClass: 'disc-points-pos', statusLabel: 'Awarded', statusClass: 'badge-soft-success' },
]

const TYPE_TABS = ['All', 'Positive', 'Negative', 'Warning']
const MAIN_TABS = ['Discipline Records', 'Extracurricular Activities', 'Upcoming Events']

function BoardingInfo({ label, value, sub }) {
  return (
    <div className="boarding-info-item">
      <span className="bi-label">{label}</span>
      <span className="bi-value">{value}</span>
      <span className="bi-sub">{sub}</span>
    </div>
  )
}

function DisciplineRecord({ date, type, typeClass, description, recordedBy, points, pointsClass, statusLabel, statusClass }) {
  return (
    <tr>
      <td>{date}</td>
      <td><span className={typeClass}>{type}</span></td>
      <td>{description}</td>
      <td>{recordedBy}</td>
      <td><span className={pointsClass}>{points}</span></td>
      <td><span className={`badge ${statusClass}`}>{statusLabel}</span></td>
    </tr>
  )
}

export function StudentActivities() {
  const [mainTab, setMainTab]   = useState('Discipline Records')
  const [typeFilter, setTypeFilter] = useState('All')

  const filtered = typeFilter === 'All'
    ? disciplineRecords
    : disciplineRecords.filter(r => r.type === typeFilter)

  const countFor = t => t === 'All' ? disciplineRecords.length : disciplineRecords.filter(r => r.type === t).length

  return (
    <>
      <a href="#main-content" className="skip-link">Skip to content</a>
      <div className="sidebar-overlay"></div>
      <div className="dashboard-layout">
        <Sidebar navItems={studentNavItems} secondaryItems={studentSecondaryItems} />
        <main className="dashboard-main" id="main-content">
          <DashboardHeader
            title="Activities & Discipline"
            subtitle="Boarding details, behavior record and extracurricular activities"
            userName="Uwase Amina" userRole="Student · S4A"
            userInitials="UA" avatarClass="student-av" notifications={studentUser.notifications}
          />
          <DashboardContent>

            {/* Boarding info */}
            <div className="boarding-hero">
              {boardingInfos.map((row, i) => <BoardingInfo key={i} {...row} />)}
            </div>

            {/* Behavior score */}
            <div className="behavior-score-card">
              <div className="score-ring-wrap">
                <svg width="90" height="90" viewBox="0 0 90 90">
                  <circle className="score-ring-bg" cx="45" cy="45" r="36" />
                  <circle className="score-ring-fg" cx="45" cy="45" r="36" strokeDasharray="226" strokeDashoffset="50" />
                </svg>
                <div className="score-ring-label">87<small>/100</small></div>
              </div>
              <div className="score-info">
                <div className="score-title">Discipline & Behavior Score — Term 2</div>
                <span className="score-status good">Good Standing</span>
                <div className="score-breakdown">
                  <span className="score-breakdown-item score-pos"><span className="material-symbols-rounded">add_circle</span>+24 positive points</span>
                  <span className="score-breakdown-item score-neg"><span className="material-symbols-rounded">remove_circle</span>-5 deducted points</span>
                  <span className="score-breakdown-item score-hist"><span className="material-symbols-rounded">history</span>Last updated Mar 7</span>
                </div>
              </div>
            </div>

            {/* Toolbar container */}
            <div className="toolbar-card">
              {MAIN_TABS.map(tab => (
                <button
                  key={tab}
                  className={`btn ${mainTab === tab ? 'btn-primary' : 'btn-outline'}`}
                  style={{ fontSize: '0.82rem', padding: '0.35rem 0.85rem' }}
                  onClick={() => setMainTab(tab)}
                >
                  {tab}
                </button>
              ))}
              {mainTab === 'Discipline Records' && (
                <>
                  <div className="vdivider" />
                  {TYPE_TABS.map(t => (
                    <button
                      key={t}
                      className={`btn ${typeFilter === t ? 'btn-primary' : 'btn-outline'}`}
                      style={{ fontSize: '0.78rem', padding: '0.3rem 0.75rem' }}
                      onClick={() => setTypeFilter(t)}
                    >
                      {t}
                      <span className="tab-count-sm">{countFor(t)}</span>
                    </button>
                  ))}
                </>
              )}
            </div>

            {/* Content or EmptyState */}
            {mainTab === 'Discipline Records' && (
              filtered.length === 0 ? (
                <EmptyState
                  icon="verified_user"
                  title={`No ${typeFilter.toLowerCase()} records`}
                  description="No discipline records match this filter."
                  action={{ label: 'Show All', icon: 'refresh', onClick: () => setTypeFilter('All') }}
                />
              ) : (
                <div className="act-list-card">
                  <div className="act-list-header">
                    <div className="act-list-title">Behavior & Discipline Records</div>
                    <span className="act-list-count">
                      {filtered.length} record{filtered.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="table-responsive">
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th><th>Type</th><th>Description</th>
                          <th>Recorded By</th><th>Points</th><th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((row, i) => <DisciplineRecord key={i} {...row} />)}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            )}

            {mainTab === 'Extracurricular Activities' && (
              <EmptyState
                icon="sports_soccer"
                title="No extracurricular records"
                description="Your extracurricular activity participation will appear here."
              />
            )}

            {mainTab === 'Upcoming Events' && (
              <EmptyState
                icon="event"
                title="No upcoming events"
                description="School events and activity dates will appear here."
              />
            )}

          </DashboardContent>
        </main>
      </div>
    </>
  )
}
