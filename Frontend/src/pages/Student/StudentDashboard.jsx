import { Link } from 'react-router'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/student.css'
import { studentNavItems, studentSecondaryItems, studentUser } from './studentNav'
import { DashboardContent } from '../../components/layout/DashboardContent'


const dashboardStats = [
  { iconClass: 'blue',   icon: 'grade',      value: '3.8', label: 'Overall GPA',        sub: '▲ +0.2 this term',     subColor: null                      },
  { iconClass: 'teal',   icon: 'fact_check', value: '96%', label: 'Attendance',          sub: '48 / 50 days present', subColor: null                      },
  { iconClass: 'orange', icon: 'assignment', value: '3',   label: 'Pending Assignments', sub: '1 due tomorrow',       subColor: 'var(--warning)'          },
  { iconClass: 'yellow', icon: 'event',      value: '5',   label: 'Days to Next Exam',   sub: 'Physics — Mar 14',     subColor: 'var(--muted-foreground)' },
]

const todaySchedule = [
  { time: '07:30', dotClass: 'schedule-dot-green',  subject: 'Mathematics',          room: 'Room 201 • Mr. Rurangwa',  badge: 'Done', badgeClass: 'badge-done' },
  { time: '09:00', dotClass: 'schedule-dot-green',  subject: 'Physics',              room: 'Room 302 • Ms. Uwera',     badge: 'Done', badgeClass: 'badge-done' },
  { time: '10:30', dotClass: 'schedule-dot-teal',   subject: 'Advanced Physics Lab', room: 'Lab 1 • Ms. Uwera',        badge: 'Now',  badgeClass: 'badge-now'  },
  { time: '12:00', dotClass: 'schedule-dot-muted',  subject: 'Lunch Break',          room: 'Cafeteria',                badge: null,   badgeClass: null         },
  { time: '13:00', dotClass: 'schedule-dot-orange', subject: 'English Literature',   room: 'Room 105 • Ms. Umutoni',   badge: 'Next', badgeClass: 'badge-next' },
  { time: '14:30', dotClass: 'schedule-dot-indigo', subject: 'Chemistry',            room: 'Lab 2 • Mr. Bizimana',     badge: null,   badgeClass: null         },
]

const upcomingAssignments = [
  { dotColor: 'schedule-dot-orange', title: 'Physics Lab Report',        subject: 'Physics • Ms. Uwera',      due: 'Today!', dueClass: 'due-today' },
  { dotColor: 'schedule-dot-teal',   title: 'Mathematics Problem Set 4', subject: 'Mathematics • Mr. Rurangwa', due: 'Mar 11', dueClass: 'due-soon'  },
  { dotColor: 'schedule-dot-indigo', title: 'English Essay Draft',        subject: 'English • Ms. Umutoni',    due: 'Mar 15', dueClass: 'due-later' },
  { dotColor: '#ec4899',             title: 'Chemistry Worksheet',        subject: 'Chemistry • Mr. Bizimana', due: 'Mar 17', dueClass: 'due-later' },
]

const recentGrades = [
  { subject: 'Mathematics', assessment: 'Quiz 4',     score: '85%', grade: 'A',  badgeClass: 'badge-soft-success', date: 'Mar 7, 2026',  teacher: 'Mr. Rurangwa'   },
  { subject: 'Physics',     assessment: 'CAT 2',      score: '78%', grade: 'B+', badgeClass: 'badge-soft-info',    date: 'Mar 5, 2026',  teacher: 'Ms. Uwera'      },
  { subject: 'English',     assessment: 'Essay 2',    score: '92%', grade: 'A+', badgeClass: 'badge-soft-success', date: 'Mar 3, 2026',  teacher: 'Ms. Umutoni'    },
  { subject: 'Chemistry',   assessment: 'Lab Report', score: '71%', grade: 'B',  badgeClass: 'badge-soft-warning', date: 'Feb 28, 2026', teacher: 'Mr. Bizimana'   },
]

function DashboardStat({ iconClass, icon, value, label, sub, subColor }) {
  return (
    <div className="student-stat-card">
      <div className={`stat-icon ${iconClass}`}><span className="material-symbols-rounded">{icon}</span></div>
      <div className="stat-body">
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
        <div className="stat-sub" style={subColor ? { color: subColor } : {}}>{sub}</div>
      </div>
    </div>
  )
}

function ScheduleSlot({ time, dotClass, subject, room, badge, badgeClass }) {
  return (
    <div className="schedule-slot">
      <span className="schedule-time">{time}</span>
      <span className={`schedule-dot ${dotClass}`}></span>
      <div className="schedule-info">
        <div className="schedule-subject">{subject}</div>
        <div className="schedule-room">{room}</div>
      </div>
      {badge && <span className={`schedule-badge ${badgeClass}`}>{badge}</span>}
    </div>
  )
}

function AssignItem({ dotColor, title, subject, due, dueClass }) {
  const isHex = dotColor.startsWith('#')
  return (
    <div className="assign-item">
      <span
        className={`assign-subject-dot${isHex ? '' : ' ' + dotColor}`}
        style={isHex ? { background: dotColor } : {}}
      ></span>
      <div className="assign-info">
        <div className="assign-title">{title}</div>
        <div className="assign-subject">{subject}</div>
      </div>
      <span className={`assign-due ${dueClass}`}>{due}</span>
    </div>
  )
}

function GradeRow({ subject, assessment, score, grade, badgeClass, date, teacher }) {
  return (
    <tr>
      <td><strong>{subject}</strong></td>
      <td>{assessment}</td>
      <td>{score}</td>
      <td><span className={`badge ${badgeClass}`}>{grade}</span></td>
      <td>{date}</td>
      <td>{teacher}</td>
    </tr>
  )
}

export function StudentDashboard() {
  return (
    <>
      <a href="#main-content" className="skip-link">Skip to content</a>
      <div className="sidebar-overlay"></div>
      <div className="dashboard-layout">

        <Sidebar navItems={studentNavItems} secondaryItems={studentSecondaryItems} />

        <main className="dashboard-main" id="main-content">
          <DashboardHeader
            title="Dashboard"
            subtitle="Welcome back, Amina"
            userName="Uwase Amina"
            userRole="Student · S4A"
            userInitials="UA"
            avatarClass="student-av"
            notifications={studentUser.notifications}
          />

          <DashboardContent>

            {/* Welcome Banner */}
            <div className="student-welcome-banner">
              <div className="welcome-text">
                <h2>Good morning, Amina!</h2>
                <p>S4A &nbsp;•&nbsp; Student ID: 2024-001 &nbsp;•&nbsp; Monday, March 9, 2026</p>
              </div>
              <div className="welcome-chips">
                <div className="welcome-chip"><span>Term 2</span><small>Current</small></div>
                <div className="welcome-chip"><span>Week 8</span><small>of 14</small></div>
                <div className="welcome-chip"><span>5 days</span><small>to next exam</small></div>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="student-stats-grid">
              {dashboardStats.map((stat, i) => (
                <DashboardStat key={i} {...stat} />
              ))}
            </div>

            {/* Two-column layout */}
            <div className="dashboard-two-col">

              {/* Today's Schedule */}
              <div className="today-schedule-card">
                <div className="section-card-header">
                  <h3><span className="material-symbols-rounded">schedule</span> Today's Schedule</h3>
                  <Link to="/student/timetable" className="btn btn-outline btn-sm">Full Timetable</Link>
                </div>
                <div className="section-card-body">
                  {todaySchedule.map((slot, i) => (
                    <ScheduleSlot key={i} {...slot} />
                  ))}
                </div>
              </div>

              {/* Upcoming Assignments */}
              <div className="upcoming-assignments-card">
                <div className="section-card-header">
                  <h3><span className="material-symbols-rounded">assignment</span> Upcoming Assignments</h3>
                  <Link to="/student/assignments" className="btn btn-outline btn-sm">View All</Link>
                </div>
                {upcomingAssignments.map((item, i) => (
                  <AssignItem key={i} {...item} />
                ))}
              </div>

            </div>

            {/* Recent Grades */}
            <div className="card mb-1-5">
              <div className="card-header">
                <h3 className="card-title">Recent Grades</h3>
                <Link to="/student/results" className="btn btn-outline btn-sm">Full Report</Link>
              </div>
              <div className="card-content">
                <div className="table-responsive">
                  <table>
                    <thead>
                      <tr>
                        <th>Subject</th><th>Assessment</th><th>Score</th><th>Grade</th><th>Date</th><th>Teacher</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentGrades.map((row, i) => (
                        <GradeRow key={i} {...row} />
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
