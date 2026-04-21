import { MessagesPage } from '../../components/messaging/MessagesPage'
import '../../styles/parent.css'
import { parentNavItems, parentSecondaryItems, parentUser } from './parentNav'


const conversations = [
    { initials: 'CU', avatarClass: 'teacher', name: 'Ms. C. Umutoni',    typeTag: 'Class Teacher', typeClass: 'teacher', time: '10:22 AM',  preview: "Regarding Amina's English results…",      isUnread: true,  isActive: true,  isOnline: true  },
    { initials: 'EM', avatarClass: 'dos',     name: 'Mr. E. Mutabazi',   typeTag: 'Discipline',     typeClass: 'dos',     time: 'Yesterday', preview: 'The matter has been resolved.',            isUnread: false, isActive: false, isOnline: false },
    { initials: 'JN', avatarClass: 'dos',     name: 'Dr. J. Ndagijimana',typeTag: 'DOS',            typeClass: 'dos',     time: 'Mon',       preview: 'Term 2 results will be released…',         isUnread: true,  isActive: false, isOnline: true  },
    { initials: 'GH', avatarClass: 'matron',  name: 'Mrs. G. Hakizimana',typeTag: 'Matron',         typeClass: 'matron',  time: 'Fri',       preview: 'Amina has been doing well in Bisoke…',    isUnread: false, isActive: false, isOnline: false },
]

const messages = [
    { type: 'received', senderInitials: 'CU', senderAvatarClass: 'teacher', dateSep: 'Monday',  time: '10:05 AM', ticks: null,   text: "Good morning Mrs. Uwase. I wanted to discuss Amina's performance in English this term. She has shown great improvement in composition, but I'd like to flag her comprehension scores before the end-of-term exam." },
    { type: 'sent',                                                            dateSep: null,       time: '10:48 AM', ticks: 'seen', text: "Good morning Ms. Umutoni. Thank you for reaching out. I noticed the same — she mentioned struggling with the unseen passages. Would it be possible to arrange extra coaching sessions?" },
    { type: 'received', senderInitials: 'CU', senderAvatarClass: 'teacher', dateSep: null,       time: '11:02 AM', ticks: null,   text: 'Absolutely. I run a reading clinic every Wednesday at 4:00 PM in Room 8. I will enrol Amina starting this week. Please ensure she brings a dictionary and her past papers.' },
    { type: 'sent',                                                            dateSep: 'Today',    time: '10:15 AM', ticks: 'seen', text: "That's wonderful, thank you! I'll make sure she's prepared. Regarding the overall results — what score is she targeting to do well in the national exams?" },
    { type: 'received', senderInitials: 'CU', senderAvatarClass: 'teacher', dateSep: null,       time: '10:22 AM', ticks: null,   text: "Regarding Amina's English results — she needs at least 70% to be in a comfortable position. With the extra coaching I'm confident she'll reach that. I'll send a progress note after this Wednesday's session." },
]

export function ParentMessages() {
    return (
        <MessagesPage
            navItems={parentNavItems}
            secondaryItems={parentSecondaryItems}
            title="Messages"
            subtitle="Communicate with teachers and school staff"
            userName="Mrs. Chantal Uwase"
            userRole="Parent"
            userInitials="CU"
            avatarClass="parent-av"
            conversations={conversations}
            tabs={['All', 'Teachers', 'Admin', 'Unread']}
            messages={messages}
            activeContact={{
                initials: 'CU', avatarClass: 'teacher',
                name: 'Ms. C. Umutoni', typeTag: 'Class Teacher', typeClass: 'teacher',
                subtitle: 'Class Teacher · S4A (Uwase Amina)', isOnline: true,
            }}
            composerPlaceholder="Type a message…"
        />
    )
}
