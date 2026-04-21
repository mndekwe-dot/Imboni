import { MessagesPage } from '../../components/messaging/MessagesPage'
import '../../styles/admin.css'
import { adminNavItems, adminSecondaryItems, adminUser } from './adminNav'


const conversations = [
    { initials: 'JN', avatarClass: 'dos',     name: 'Dr. J.C. Ndagijimana', typeTag: 'DOS',       typeClass: 'dos',     time: '20 min',    preview: 'The exam timetable has been finalised, sir.',            isUnread: true,  isActive: true,  isOnline: true  },
    { initials: 'EM', avatarClass: 'dis',     name: 'Mr. E. Mutabazi',      typeTag: 'Discipline', typeClass: 'dis',     time: '2 hr',      preview: 'Two students escalated to your office, sir.',            isUnread: true,  isActive: false, isOnline: true  },
    { initials: 'GH', avatarClass: 'matron',  name: 'Mrs. G. Hakizimana',   typeTag: 'Matron',     typeClass: 'matron',  time: 'Yesterday', preview: 'Health bay report for Week 9 attached.',                 isUnread: false, isActive: false, isOnline: false },
    { initials: 'RN', avatarClass: 'staff',   name: 'Mrs. R. Nzabonimana',  typeTag: 'Finance',    typeClass: 'staff',   time: '2 days',    preview: 'March fee collection report is ready.',                  isUnread: true,  isActive: false, isOnline: false },
    { initials: 'BN', avatarClass: 'parent',  name: 'Mr. B. Nsabimana',     typeTag: 'Parent',     typeClass: 'parent',  time: '3 days',    preview: "Regarding Jean's bursary application...",                isUnread: false, isActive: false, isOnline: false },
    { initials: 'RM', avatarClass: 'staff',   name: 'Rwanda MOE',            typeTag: 'Ministry',   typeClass: 'staff',   time: '1 week',    preview: 'School inspection scheduled for April 14.',              isUnread: false, isActive: false, isOnline: false },
]

const messages = [
    { type: 'received', senderInitials: 'JN', senderAvatarClass: 'dos', dateSep: 'Today', time: '9:05 AM', ticks: null,   text: "Good morning, Dr. Nkurunziza. I am pleased to inform you that the end-of-term exam timetable has been finalised and published to all student and teacher portals. The exams run from March 16\u201321." },
    { type: 'sent',                                                       dateSep: null,    time: '9:22 AM', ticks: 'seen', text: "Well done, Dr. Ndagijimana. Please ensure all invigilators receive their room assignments by Thursday. Also confirm that the S6 practical arrangements are in order with the relevant teachers." },
    { type: 'received', senderInitials: 'JN', senderAvatarClass: 'dos', dateSep: null,    time: '9:35 AM', ticks: null,   text: "Understood, sir. Invigilator assignments will be distributed by Wednesday morning. I will follow up with the science department regarding the S6 practicals and report back to you by end of day." },
    { type: 'sent',                                                       dateSep: null,    time: '9:40 AM', ticks: '',     text: "Thank you. Please also coordinate with Mrs. Nzabonimana on printing logistics \u2014 last term there were delays. Keep me posted." },
]

export function AdminMessages() {
    return (
        <MessagesPage
            navItems={adminNavItems}
            secondaryItems={adminSecondaryItems}
            title="Messages"
            subtitle="Communicate with staff, department heads and parents"
            userName={adminUser.userName}
            userRole={adminUser.userRole}
            userInitials={adminUser.userInitials}
            avatarClass={adminUser.avatarClass}
            conversations={conversations}
            tabs={['All', 'Unread', 'Staff', 'DOS', 'Parents']}
            messages={messages}
            activeContact={{
                initials: 'JN', avatarClass: 'dos',
                name: 'Dr. J.C. Ndagijimana', typeTag: 'DOS', typeClass: 'dos',
                subtitle: 'Director of Studies', isOnline: true,
            }}
            composerPlaceholder="Type your message..."
        />
    )
}
