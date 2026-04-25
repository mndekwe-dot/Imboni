import { useState } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { EmptyState } from '../../components/ui/EmptyState'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/student.css'
import { studentNavItems, studentSecondaryItems, studentUser } from './studentNav'
import { DashboardContent } from '../../components/layout/DashboardContent'


const assignmentStats = [
  { iconClass: 'orange', icon: 'pending',    value: '3',  valueColor: 'var(--warning)',     label: 'Pending'         },
  { iconClass: 'green',  icon: 'task_alt',   value: '8',  valueColor: 'var(--success)',     label: 'Submitted'       },
  { iconClass: 'red',    icon: 'warning',    value: '1',  valueColor: 'var(--destructive)', label: 'Overdue'         },
  { iconClass: 'blue',   icon: 'assignment', value: '12', valueColor: null,                 label: 'Total This Term' },
]

const assignments = [
  { cardClass: 'overdue',   icon: 'warning',   title: 'History Essay — Rwanda Pre-Colonial Kingdoms', subject: 'History · Mr. Ntakirutimana',  dueText: 'Was due Mar 7, 2026',     dueColor: 'var(--destructive)',      tagClass: 'tag-overdue',   tagLabel: 'Overdue',   actionLabel: 'Submit Now', grade: null,       gradeStyle: null },
  { cardClass: 'pending',   icon: 'science',   title: 'Physics Lab Report — Projectile Motion',       subject: 'Physics · Ms. Uwera',         dueText: 'Due today — Mar 9, 2026', dueColor: 'var(--destructive)',      tagClass: 'tag-pending',   tagLabel: 'Pending',   actionLabel: 'Upload',     grade: null,       gradeStyle: null },
  { cardClass: 'pending',   icon: 'calculate', title: 'Mathematics Problem Set 4',                    subject: 'Mathematics · Mr. Rurangwa',  dueText: 'Due Mar 11, 2026',        dueColor: 'var(--warning)',          tagClass: 'tag-pending',   tagLabel: 'Pending',   actionLabel: 'Upload',     grade: null,       gradeStyle: null },
  { cardClass: 'pending',   icon: 'edit_note', title: 'English Essay Draft — Persuasive Writing',     subject: 'English · Ms. Umutoni',       dueText: 'Due Mar 15, 2026',        dueColor: 'var(--muted-foreground)', tagClass: 'tag-pending',   tagLabel: 'Pending',   actionLabel: 'Upload',     grade: null,       gradeStyle: null },
  { cardClass: 'submitted', icon: 'task_alt',  title: 'Chemistry Worksheet — Periodic Table',         subject: 'Chemistry · Mr. Bizimana',    dueText: 'Submitted Mar 6, 2026',   dueColor: 'var(--muted-foreground)', tagClass: 'tag-submitted', tagLabel: 'Submitted', actionLabel: null,         grade: '75% · B',  gradeStyle: { background: 'var(--success-light)', color: 'var(--success)' } },
  { cardClass: 'submitted', icon: 'task_alt',  title: 'Mathematics CAT 2 Preparation Notes',          subject: 'Mathematics · Mr. Rurangwa',  dueText: 'Submitted Feb 28, 2026',  dueColor: 'var(--muted-foreground)', tagClass: 'tag-submitted', tagLabel: 'Submitted', actionLabel: null,         grade: '90% · A',  gradeStyle: { background: 'var(--success-light)', color: 'var(--success)' } },
  { cardClass: 'submitted', icon: 'task_alt',  title: 'Physics CAT 2 Take-home Questions',            subject: 'Physics · Ms. Uwera',         dueText: 'Submitted Feb 20, 2026',  dueColor: 'var(--muted-foreground)', tagClass: 'tag-submitted', tagLabel: 'Submitted', actionLabel: null,         grade: '82% · B+', gradeStyle: { background: 'var(--student-light)', color: 'var(--student)' } },
]

const STATUS_TABS = ['All', 'Pending', 'Submitted', 'Overdue']

function AssignmentStat({ iconClass, icon, value, valueColor, label }) {
  return (
    <div className="student-stat-card">
      <div className={`stat-icon ${iconClass}`}><span className="material-symbols-rounded">{icon}</span></div>
      <div className="stat-body">
        <div className="stat-value" style={valueColor ? { color: valueColor } : {}}>{value}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  )
}

function AssignmentCard({ cardClass, icon, title, subject, dueText, dueColor, tagClass, tagLabel, actionLabel, grade, gradeStyle }) {
  const dueIcon = cardClass === 'submitted' ? 'check_circle' : 'event'
  return (
    <div className={`assignment-card ${cardClass}`}>
      <div className="assignment-icon"><span className="material-symbols-rounded">{icon}</span></div>
      <div className="assignment-body">
        <div className="assignment-title">{title}</div>
        <div className="assignment-subject">{subject}</div>
        <div className="assignment-meta">
          <span className="assignment-due" style={{ color: dueColor }}>
            <span className="material-symbols-rounded">{dueIcon}</span>
            {dueText}
          </span>
          <span className={`assignment-status-tag ${tagClass}`}>{tagLabel}</span>
        </div>
      </div>
      <div className="assignment-actions">
        {actionLabel && cardClass === 'overdue' && (
          <button className="btn btn-sm btn-outline" style={{ color: 'var(--destructive)', borderColor: 'var(--destructive)' }}>{actionLabel}</button>
        )}
        {actionLabel && cardClass === 'pending' && (
          <button className="btn btn-sm btn-primary">{actionLabel}</button>
        )}
        {grade && (
          <span className="badge" style={{ ...gradeStyle, padding: '0.3rem 0.7rem' }}>{grade}</span>
        )}
      </div>
    </div>
  )
}

export function StudentAssignments() {
  const [statusFilter, setStatusFilter] = useState('All')

  const filtered = statusFilter === 'All'
    ? assignments
    : assignments.filter(a => a.tagLabel === statusFilter)

  const countFor = label => label === 'All' ? assignments.length : assignments.filter(a => a.tagLabel === label).length

  return (
    <>
      <a href="#main-content" className="skip-link">Skip to content</a>
      <div className="sidebar-overlay"></div>
      <div className="dashboard-layout">
        <Sidebar navItems={studentNavItems} secondaryItems={studentSecondaryItems} />
        <main className="dashboard-main" id="main-content">
          <DashboardHeader
            title="Assignments" subtitle="Track all your tasks and deadlines"
            userName="Uwase Amina" userRole="Student · S4A"
            userInitials="UA" avatarClass="student-av" notifications={studentUser.notifications}
          />
          <DashboardContent>

            {/* Stat cards */}
            <div className="student-stats-grid">
              {assignmentStats.map((stat, i) => <AssignmentStat key={i} {...stat} />)}
            </div>

            {/* Toolbar container */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              flexWrap: 'wrap', margin: '1rem 0',
              background: 'var(--card)', border: '1px solid var(--border)',
              borderRadius: 16, padding: '0.75rem 1rem',
              boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
            }}>
              {STATUS_TABS.map(tab => (
                <button
                  key={tab}
                  className={`btn ${statusFilter === tab ? 'btn-primary' : 'btn-outline'}`}
                  style={{ fontSize: '0.82rem', padding: '0.35rem 0.85rem' }}
                  onClick={() => setStatusFilter(tab)}
                >
                  {tab}
                  <span style={{ marginLeft: '0.35rem', opacity: 0.75, fontSize: '0.78rem' }}>
                    {countFor(tab)}
                  </span>
                </button>
              ))}
            </div>

            {/* Content container or EmptyState */}
            {filtered.length === 0 ? (
              <EmptyState
                icon="assignment"
                title={`No ${statusFilter.toLowerCase()} assignments`}
                description="No assignments match this filter right now."
                action={{ label: 'Show All', icon: 'refresh', onClick: () => setStatusFilter('All') }}
              />
            ) : (
              <div style={{
                background: 'var(--card)', border: '1px solid var(--border)',
                borderRadius: 16, overflow: 'hidden',
                boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)',
                }}>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                    {statusFilter === 'All' ? 'All Assignments' : `${statusFilter} Assignments`}
                  </div>
                  <span style={{ fontSize: '0.82rem', color: 'var(--muted-foreground)' }}>
                    {filtered.length} item{filtered.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div style={{ padding: '0.25rem 0' }}>
                  {filtered.map((item, i) => (
                    <div
                      key={i}
                      style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none' }}
                    >
                      <AssignmentCard {...item} />
                    </div>
                  ))}
                </div>
              </div>
            )}

          </DashboardContent>
        </main>
      </div>
    </>
  )
}
