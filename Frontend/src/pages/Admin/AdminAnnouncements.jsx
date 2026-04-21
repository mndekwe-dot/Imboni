import { AnnouncementFeed } from '../../components/announcements/AnnouncementFeed'
import { StatCard } from '../../components/layout/StatCard'
import '../../styles/admin.css'
import { adminNavItems, adminSecondaryItems, adminUser } from './adminNav'


const announcements = [
    { type: 'urgent',   icon: 'priority_high',  title: 'School Closed — Public Holiday, March 9',        date: 'Mar 6, 2026',     author: 'Dr. A. Nkurunziza (Principal)',   audience: 'School-wide',    body: 'The school will be closed on Monday, March 9, 2026 in observance of the national public holiday. Normal classes resume Tuesday, March 10.',              isUnread: false },
    { type: 'school',   icon: 'campaign',        title: 'Term 2 Opening Date Confirmed — April 28',        date: 'Mar 5, 2026',     author: 'Administration',             audience: 'School-wide',    body: 'Term 2, 2026 will open on Monday, April 28. All students must report by 8:00 AM. Boarders should arrive by 4:00 PM on Sunday, April 27.',               isUnread: false },
    { type: 'school',   icon: 'groups',          title: 'Parent-Teacher Conference — March 20',             date: 'Mar 4, 2026',     author: 'Dr. A. Nkurunziza (Principal)',   audience: 'School-wide',    body: 'The Term 1 Parent-Teacher Conference is scheduled for Friday, March 20 from 8:00 AM to 4:00 PM. All parents are encouraged to attend.',                  isUnread: false },
    { type: 'academic', icon: 'school',          title: 'End-of-Term Exam Timetable Published',             date: 'Feb 28, 2026',    author: 'Dr. J.C. Ndagijimana (DOS)',         audience: 'School-wide',    body: 'The Term 1 end-of-term exam timetable has been published. Exams run March 16–21. Students must check their individual schedules on the portal.',          isUnread: false },
    { type: 'general',  icon: 'construction',    title: 'Library Renovation — Access Restricted Mar 10–14', date: 'Feb 25, 2026',   author: 'Administration',             audience: 'School-wide',    body: 'The library will be closed for renovation from March 10 to 14. Students may access the reading room in Block B during this period.',                       isUnread: false },
    { type: 'event',    icon: 'emoji_events',    title: 'Inter-School Sports Gala — March 22',              date: 'Feb 20, 2026',    author: 'Dr. A. Nkurunziza (Principal)',   audience: 'School-wide',    body: 'Imboni Academy will host the Annual Inter-School Sports Gala on Saturday, March 22. All students, parents and staff are invited to attend.',            isUnread: false },
]

const topPanel = (
    <div className="portal-stat-grid" style={{ marginBottom: '1.25rem' }}>
        <StatCard colorClass=""        icon="campaign"          value="18"  label="Published"       trend="This term"      />
        <StatCard colorClass="warning" icon="draft"             value="3"   label="Drafts"          trend="Awaiting review" />
        <StatCard colorClass="danger"  icon="priority_high"     value="1"   label="Urgent"          trend="Active"         />
        <StatCard colorClass="info"    icon="visibility"        value="4.2K" label="Total Views"    trend="This term"      />
    </div>
)

export function AdminAnnouncements() {
    return (
        <AnnouncementFeed
            navItems={adminNavItems}
            secondaryItems={adminSecondaryItems}
            title="Announcements"
            subtitle="Compose and broadcast school-wide notices"
            userName={adminUser.userName}
            userRole={adminUser.userRole}
            userInitials={adminUser.userInitials}
            avatarClass={adminUser.avatarClass}
            notifications={adminUser.notifications}
            announcements={announcements}
            chips={['All', 'Urgent', 'School', 'Academic', 'Events', 'General']}
            topPanel={topPanel}
        />
    )
}
