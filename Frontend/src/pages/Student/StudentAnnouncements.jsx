import { AnnouncementFeed } from '../../components/announcements/AnnouncementFeed'
import { useAnnouncements } from '../../context/AnnouncementsContext'
import '../../styles/student.css'
import { studentNavItems, studentSecondaryItems, studentUser } from './studentNav'

const keyDates = [
  { day: '14', month: 'Mar', title: 'Physics Exam',                    sub: 'Room 302 · Ms. Uwera'               },
  { day: '15', month: 'Mar', title: 'English Essay Due',               sub: 'Submit to Ms. Umutoni'              },
  { day: '18', month: 'Mar', title: 'Science Competition Proposal',    sub: 'Submit to Ms. Uwera / Mr. Bizimana' },
  { day: '20', month: 'Mar', title: 'Parent-Teacher Conference',       sub: '8:00 AM – 4:00 PM'                  },
  { day: '28', month: 'Mar', title: 'Umuco Fest — Cultural Night',     sub: '5:00 PM · Auditorium'               },
]

const sidebar = (
    <>
        <div className="ann-sidebar-card">
            <div className="ann-sidebar-header">
                <span className="material-symbols-rounded">push_pin</span> Pinned — Urgent
            </div>
            <div className="ann-pinned-item">
                <div className="ann-pinned-title">Physics Exam moved to Mar 14</div>
                <div className="ann-pinned-sub">
                    <span className="material-symbols-rounded icon-sm-btn">person</span>
                    Ms. Uwera <span>·</span> Mar 8
                </div>
            </div>
        </div>

        <div className="ann-sidebar-card">
            <div className="ann-sidebar-header">
                <span className="material-symbols-rounded">event</span> Key Dates
            </div>
            {keyDates.map((kd, i) => (
                <div key={i} className="ann-deadline-item">
                    <div className="ann-deadline-date">
                        <div className="ann-deadline-day">{kd.day}</div>
                        <div className="ann-deadline-month">{kd.month}</div>
                    </div>
                    <div className="ann-deadline-text">
                        <div className="ann-deadline-title">{kd.title}</div>
                        <div className="ann-deadline-sub">{kd.sub}</div>
                    </div>
                </div>
            ))}
        </div>
    </>
)

export function StudentAnnouncements() {
    const { announcements } = useAnnouncements()

    const visible = announcements.filter(a =>
        a.audience === 'students' || a.audience === 'all'
    )

    return (
        <AnnouncementFeed
            navItems={studentNavItems}
            secondaryItems={studentSecondaryItems}
            title="Announcements"
            subtitle="School notices, class updates & activity alerts"
            userName="Uwase Amina"
            userRole="Student · S4A"
            userInitials="UA"
            avatarClass="student-av"
            notifications={studentUser.notifications}
            announcements={visible}
            chips={['All', 'Urgent', 'School', 'Class', 'Activities', 'Boarding']}
            sidebar={sidebar}
        />
    )
}
