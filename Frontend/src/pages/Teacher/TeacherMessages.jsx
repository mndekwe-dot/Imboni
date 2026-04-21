import { MessagesPage } from '../../components/messaging/MessagesPage'
import '../../styles/teacher.css'
import { teacherNavItems, teacherSecondaryItems, teacherUser } from './teacherNav'


const conversations = [
    { initials: 'JN', avatarClass: 'parent',    name: 'Jean Nsabimana',      typeTag: 'Parent',  typeClass: 'parent',    time: '10 min',    preview: "Thank you for the update on Amina's progress...", isUnread: true,  isActive: true,  isOnline: true  },
    { initials: 'MU', avatarClass: 'parent',    name: 'Marie Uwimana',       typeTag: 'Parent',  typeClass: 'parent',    time: 'Yesterday', preview: 'Will Kevin be able to attend the makeup class?',   isUnread: true,  isActive: false, isOnline: false },
    { initials: 'BN', avatarClass: 'staff',     name: 'Mr. Nzeyimana',       typeTag: 'Staff',   typeClass: 'staff',     time: '2 days',    preview: 'About the upcoming staff meeting agenda...',       isUnread: false, isActive: false, isOnline: false },
    { initials: 'PH', avatarClass: 'parent',    name: 'Pascal Hakizimana',   typeTag: 'Parent',  typeClass: 'parent',    time: '3 days',    preview: 'Thank you for helping my son with extra revision',  isUnread: true,  isActive: false, isOnline: false },
    { initials: 'DN', avatarClass: 'dos',       name: 'Dr. Nsabimana',       typeTag: 'DOS',     typeClass: 'dos',       time: '1 week',    preview: 'Please submit your term 2 reports by Friday...',   isUnread: false, isActive: false, isOnline: false },
    { initials: 'AU', avatarClass: 'parent',    name: 'Alphonsine Uwineza',  typeTag: 'Parent',  typeClass: 'parent',    time: '1 week',    preview: 'When is the next parent-teacher conference?',      isUnread: true,  isActive: false, isOnline: false },
    { initials: 'PM', avatarClass: 'admin',     name: 'Principal Murenzi',   typeTag: 'Admin',   typeClass: 'admin',     time: '2 weeks',   preview: 'Class performance report submission reminder',      isUnread: false, isActive: false, isOnline: false },
]

const messages = [
    { type: 'received', senderInitials: 'JN', senderAvatarClass: 'parent', dateSep: 'Yesterday', time: '2:30 PM',   ticks: null,   text: "Good morning Mr. Rurangwa, I wanted to follow up on Amina's recent quiz performance. Is she keeping up with the rest of the class?" },
    { type: 'sent',                                                          dateSep: null,        time: '3:15 PM',   ticks: 'seen', text: "Good afternoon Mr. Nsabimana. Amina is doing quite well! Her recent quiz score was 85%, which is above the class average. She's particularly strong in algebra and geometry." },
    { type: 'received', senderInitials: 'JN', senderAvatarClass: 'parent', dateSep: 'Today',     time: '9:45 AM',   ticks: null,   text: "That's wonderful to hear! Thank you for the update and for your continued support. Would it be possible to schedule a brief call this week?" },
    { type: 'sent',                                                          dateSep: null,        time: '10:12 AM',  ticks: '',     text: "Of course! I'm available Thursday after 3 PM or Friday morning before 10 AM. Which time works best for you?" },
    { type: 'received', senderInitials: 'JN', senderAvatarClass: 'parent', dateSep: null,        time: '10 min ago', ticks: null,  text: 'Thursday at 3:30 PM works perfectly for me. Thank you for being so accommodating!' },
]

const quickReplies = (
    <div className="quick-replies-card">
        <div className="card-header">
            <h3 className="card-title">Quick Replies</h3>
            <p className="card-description">Click a reply to insert it into the message box</p>
        </div>
        <div className="quick-replies-list">
            <button className="quick-reply-btn">✅ Acknowledged</button>
            <button className="quick-reply-btn">📅 Schedule Meeting</button>
            <button className="quick-reply-btn">📞 Will Call Back</button>
            <button className="quick-reply-btn">📧 Details via Email</button>
            <button className="quick-reply-btn">👍 Noted</button>
            <button className="quick-reply-btn">🙏 Thank You</button>
        </div>
    </div>
)

export function TeacherMessages() {
    return (
        <MessagesPage
            navItems={teacherNavItems}
            secondaryItems={teacherSecondaryItems}
            title="Messages"
            subtitle="Communicate with parents and staff"
            userName="Pacifique Rurangwa"
            userRole="Teacher · Mathematics"
            userInitials="PR"
            avatarClass="teacher-av"
            conversations={conversations}
            tabs={['All', 'Unread', 'Parents', 'Staff', 'Admin']}
            messages={messages}
            activeContact={{
                initials: 'JN', avatarClass: 'parent',
                name: 'Jean Nsabimana', typeTag: 'Parent', typeClass: 'parent',
                isOnline: true,
            }}
            composerPlaceholder="Type your message..."
            extraPanel={quickReplies}
        />
    )
}
