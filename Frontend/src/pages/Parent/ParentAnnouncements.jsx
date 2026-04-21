import { AnnouncementFeed } from '../../components/announcements/AnnouncementFeed'
import { StatCard } from '../../components/layout/StatCard'
import '../../styles/parent.css'
import { parentNavItems, parentSecondaryItems, parentUser } from './parentNav'


const announcements = [
    { type: 'urgent',  icon: 'priority_high',  title: 'National Exam Preparation — Important Notice',  date: 'April 15, 2026',    author: 'School Administration', audience: 'School-wide',    body: 'S4 and S6 students will begin intensive national exam preparation from May 10, 2026. Additional evening study sessions will be organised. Parents are urged to ensure students are well-rested and prepared.',                                  isUnread: true  },
    { type: 'school',  icon: 'campaign',        title: 'Term 2 Exam Schedule Released',                 date: 'April 10, 2026',    author: 'Dr. Jean-Claude Ndagijimana — Director of Studies', audience: 'School-wide', body: "The Term 2 exam schedule has been published. Exams run May 4\u20138, 2026. Please check your child\u2019s specific timetable in the Results section.",                                                            isUnread: true  },
    { type: 'event',   icon: 'groups',          title: 'Parent-Teacher Conference \u2014 April 25',     date: 'April 5, 2026',     author: 'Administration',        audience: 'School-wide',    body: 'We invite all parents for a one-on-one progress discussion on Saturday, April 25. Meetings will be held in the main hall from 2:00 PM. Booking is required — please confirm via the parent portal.',                                         isUnread: false },
    { type: 'event',   icon: 'brand_awareness', title: 'Umuco Fest \u2014 Cultural Festival',            date: 'April 2, 2026',     author: 'Dr. Alphonse Nkurunziza — Principal',  audience: 'School-wide',    body: 'Imboni Academy will host the annual Umuco Fest cultural festival on Saturday, May 2, 2026. All students and parents are invited. S4A students are leading the event committee.',                                isUnread: false },
    { type: 'class',   icon: 'calculate',       title: 'S4 Mathematics Competition Registration',        date: 'March 28, 2026',    author: 'Mr. Pacifique Rurangwa', audience: 'Class-specific', body: 'Registration for the inter-school mathematics competition is open for S4 students. Interested students should register at the DOS office by April 10.',                                                                              isUnread: false },
    { type: 'general', icon: 'info',            title: 'Boarding Fees \u2014 Term 2 Reminder',           date: 'March 20, 2026',    author: 'Mr. Olivier Habimana — Finance',      audience: 'School-wide',    body: 'Term 2 boarding and tuition fees are due by April 30, 2026. Parents who have not yet cleared their balance are urged to contact the finance office at their earliest convenience.',                                isUnread: false },
]

const topPanel = (
    <div className="portal-stat-grid" style={{ marginBottom: '1.25rem' }}>
        <StatCard colorClass="info"    icon="inbox"             value="6" label="Total Messages"  trend="Inbox"   />
        <StatCard colorClass="warning" icon="mark_email_unread" value="2" label="Unread"           trend="New"     />
        <StatCard colorClass="danger"  icon="priority_high"     value="1" label="Urgent"           trend="Action needed" />
        <StatCard colorClass="success" icon="event"             value="2" label="Upcoming Events"  trend="This month" />
    </div>
)

export function ParentAnnouncements() {
    return (
        <AnnouncementFeed
            navItems={parentNavItems}
            secondaryItems={parentSecondaryItems}
            title="Announcements"
            subtitle="Stay updated with school news and notifications"
            userName="Mrs. Chantal Uwase"
            userRole="Parent"
            userInitials="CU"
            avatarClass="parent-av"
            notifications={parentUser.notifications}
            announcements={announcements}
            chips={['All', 'School-wide', 'Class', 'Urgent', 'Events']}
            topPanel={topPanel}
        />
    )
}
