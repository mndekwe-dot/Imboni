import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/student.css'
import { studentNavItems, studentSecondaryItems, studentUser } from './studentNav'


const boardingInfos = [
  { label: 'Dormitory', value: 'Karisimbi House', sub: 'Room 14B • Girls Wing' },
  { label: 'Dining Table', value: 'Table 7', sub: 'Main Dining Hall • Seat 3' },
  { label: 'Dormitory Supervisor', value: 'Mrs. Hakizimana', sub: 'Ext. 204 • House Office' },
  { label: 'Director of Discipline', value: 'Mr. Mutabazi', sub: 'Discipline Office • Block C' },
  { label: 'Emergency Contact', value: 'Mrs. Chantal Uwase', sub: '+250 788 000 001 (Parent)' },
]

const disciplineRecords = [
  { date: 'Mar 7, 2026', type: 'Positive', typeClass: 'disc-type-positive', description: 'Top scorer in Mathematics CAT 2', recordedBy: 'Mr. Rurangwa', points: '+5', pointsClass: 'disc-points-pos', statusLabel: 'Awarded', statusClass: 'badge-soft-success' },
  { date: 'Mar 4, 2026', type: 'Positive', typeClass: 'disc-type-positive', description: 'Volunteered for library organization', recordedBy: 'Mr. Mutabazi', points: '+3', pointsClass: 'disc-points-pos', statusLabel: 'Awarded', statusClass: 'badge-soft-success' },
  { date: 'Mar 4, 2026', type: 'Negative', typeClass: 'disc-type-negative', description: 'Late to first period class', recordedBy: 'Ms. Uwera', points: '−2', pointsClass: 'disc-points-neg', statusLabel: 'Noted', statusClass: 'badge-soft-danger' },
  { date: 'Feb 28, 2026', type: 'Positive', typeClass: 'disc-type-positive', description: 'Outstanding English essay — class commendation', recordedBy: 'Ms. Umutoni', points: '+5', pointsClass: 'disc-points-pos', statusLabel: 'Awarded', statusClass: 'badge-soft-success' },
  { date: 'Feb 20, 2026', type: 'Warning', typeClass: 'disc-type-warning', description: 'Dormitory lights on after curfew (10:30 PM)', recordedBy: 'Mrs. Hakizimana', points: '−3', pointsClass: 'disc-points-neg', statusLabel: 'Warning', statusClass: 'badge-soft-warning' },
  { date: 'Feb 14, 2026', type: 'Positive', typeClass: 'disc-type-positive', description: 'Represented school at Science Fair — 2nd place', recordedBy: 'Mr. Mutabazi', points: '+8', pointsClass: 'disc-points-pos', statusLabel: 'Awarded', statusClass: 'badge-soft-success' },
  { date: 'Jan 30, 2026', type: 'Positive', typeClass: 'disc-type-positive', description: 'Helped new students during orientation week', recordedBy: 'Mr. Mutabazi', points: '+3', pointsClass: 'disc-points-pos', statusLabel: 'Awarded', statusClass: 'badge-soft-success' },
]

function BoardingInfo({ label, value, sub, }) {
  return (
    <div className="boarding-info-item">
      <span className="bi-label">{label}</span>
      <span className="bi-value">{value}</span>
      <span className="bi-sub">{sub}</span>
    </div>
  )
}
function DisciplineRecord({ date, type, typeClass, description, recordedBy, points, pointClass, statusLabel, statusClass, }) {
  return (
    <tr>
      <td>{date}</td>
      <td><span className={typeClass}>{type}</span></td>
      <td>{description}</td>
      <td>{recordedBy}</td>
      <td><span className={pointClass}>{points}</span></td>
      <td><span className={`badge ${statusClass}`}>{statusLabel}</span></td>
    </tr>
  )
}
export function StudentActivities() {
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
          <div className="dashboard-content">

            {/* Boarding info */}
            <div className="boarding-hero">
              {boardingInfos.map((row, index) => (
                <BoardingInfo key={index}{...row} />
              ))}
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
                  <span className="score-breakdown-item" style={{ color: 'var(--success)' }}><span className="material-symbols-rounded">add_circle</span>+24 positive points</span>
                  <span className="score-breakdown-item" style={{ color: 'var(--destructive)' }}><span className="material-symbols-rounded">remove_circle</span>−5 deducted points</span>
                  <span className="score-breakdown-item" style={{ color: 'var(--muted-foreground)' }}><span className="material-symbols-rounded">history</span>Last updated Mar 7</span>
                </div>
              </div>
            </div>

            {/* Ta  bs */}
            <div className="term-tabs" style={{ marginBottom: '1.25rem' }}>
              <button className="term-tab active">Discipline Records</button>
              <button className="term-tab">Extracurricular Activities</button>
              <button className="term-tab">Upcoming Events</button>
            </div>

            {/* Discipline Records */}
            <div>
              <div className="filter-tabs-bar">
                <button className="filter-tab active">All</button>
                <button className="filter-tab">Positive</button>
                <button className="filter-tab">Negative</button>
                <button className="filter-tab">Warning</button>
              </div>
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">Behavior & Discipline Records</h3>
                  <span className="badge" style={{ background: 'var(--student-light)', color: 'var(--student)' }}>Term 2</span>
                </div>
                <div className="card-content">
                  <div className="table-responsive">
                    <table>
                      <thead>
                        <tr><th>Date</th><th>Type</th><th>Description</th><th>Recorded By</th><th>Points</th><th>Status</th></tr>
                      </thead>
                      <tbody>
                        {disciplineRecords.map((row,index)=>(
                          <DisciplineRecord key={index}{...row}/>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </main>
      </div>
    </>
  )
}
