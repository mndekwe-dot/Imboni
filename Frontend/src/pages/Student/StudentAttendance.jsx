import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/student.css'
import { studentNavItems, studentSecondaryItems, studentUser } from './studentNav'


//Student Attendance Page
const studentStatGrids = [
  { materialSymbols: 'check_circle', statValueColor: 'var(--success)', statValue: '48', statLabel: 'Days Present' },
  { materialSymbols: 'cancel', statValueColor: 'var(--destructive)', statValue: '2', statLabel: 'Days Absent' },
  { materialSymbols: 'schedule', statValueColor: 'var(--warning)', statValue: '3', statLabel: 'Late Arrivals' },
  { materialSymbols: 'event_note', statValueColor: 'var(--primary)', statValue: '50', statLabel: 'Total Days' },
]
//Student Attendance Records
const studentAttendanceRecords = [
  { date: 'Mar 9, 2026', attendanceDay: 'Monday',attendanceDot:'att-dot present', recordClassName: 'att-status-present', attendanceStatus: 'Present', timeIn: '7:25 AM', reason: '—' },
  { date: 'Mar 4, 2026', attendanceDay: 'Wednesday', attendanceDot:'att-dot late',recordClassName: 'att-status-late', attendanceStatus: 'Late', timeIn: '7:25 AM', reason: '	Transport delay' },
  { date: 'Feb 28, 2026', attendanceDay: 'Wednesday',attendanceDot:'att-dot absent', recordClassName: 'att-status-absent', attendanceStatus: 'Absent', timeIn: '7:25 AM', reason: '	Transport delay' },
  { date: 'Feb 12, 2026', attendanceDay: 'Wednesday', attendanceDot:'att-dot excused',recordClassName: 'att-status-excused', attendanceStatus: 'Absent', timeIn: '7:25 AM', reason: '	Transport delay' },
]

function StudentStatGrid({ materialSymbols, statValue, statValueColor, statLabel }) {
  return (
    <div className="student-stat-card">
      <div className="stat-icon green"><span className="material-symbols-rounded">{materialSymbols}</span></div>
      <div className="stat-body">
        <div className="stat-value" style={{ color: statValueColor }}>{statValue}</div>
        <div className="stat-label">{statLabel}</div>
      </div>
    </div>
  )
}
function StudentAttendanceRecord({date,attendanceDay,attendanceDot,recordClassName,attendanceStatus,timeIn,reason}){
  return (
    <tr>
      <td>{date}</td><td>{attendanceDay}</td>
      <td><span className={attendanceDot}></span><span className={recordClassName}>{attendanceStatus}</span></td>
      <td>{timeIn}</td><td>{reason}</td>
    </tr>
  )
}


export function StudentAttendance() {
  return (
    <>
      <a href="#main-content" className="skip-link">Skip to content</a>
      <div className="sidebar-overlay"></div>
      <div className="dashboard-layout">
        <Sidebar navItems={studentNavItems} secondaryItems={studentSecondaryItems} />
        <main className="dashboard-main" id="main-content">
          <DashboardHeader
            title="Attendance" subtitle="Your attendance record — Term 2, 2026"
            userName="Uwase Amina" userRole="Student · S4A"
            userInitials="UA" avatarClass="student-av" notifications={studentUser.notifications}
          />
          <div className="dashboard-content">

            {/* Hero */}
            <div className="attendance-hero">
              <div>
                <div className="attendance-big-number">96%</div>
                <div className="attendance-big-label">Overall Attendance Rate</div>
              </div>
              <div className="attendance-breakdown">
                <div className="att-breakdown-item">
                  <span>48</span><small>Days Present</small>
                </div>
                <div className="att-breakdown-item">
                  <span>2</span><small>Days Absent</small>
                </div>
                <div className="att-breakdown-item">
                  <span>1</span><small>Late Arrivals</small>
                </div>
                <div className="att-breakdown-item">
                  <span>50</span><small>Total School Days</small>
                </div>
              </div>
            </div>


            {/* Stat cards */}
            <div className="student-stats-grid">
              {studentStatGrids.map((row, index) => (
                <StudentStatGrid key={index}{...row} />
              ))}
            </div>

            {/* Records table */}
            <div className="attendance-table-card">
              <div className="section-card-header">
                <h3><span className="material-symbols-rounded">table_view</span> Attendance Records</h3>
                <button className="btn btn-outline btn-sm">
                  <span className="material-symbols-rounded">download</span> Export
                </button>
              </div>
              <div className="card-content">
                <div className="table-responsive">
                  <table>
                    <thead>
                      <tr><th>Date</th><th>Day</th><th>Status</th><th>Time In</th><th>Reason / Note</th></tr>
                    </thead>
                    <tbody>
                      {studentAttendanceRecords.map((row,index) => (
                        <StudentAttendanceRecord key={index}{...row}/>
                        ))
                      }
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
