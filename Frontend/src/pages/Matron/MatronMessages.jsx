import { MessagesPage } from '../../components/messaging/MessagesPage'
import '../../styles/matron.css'
import { matronNavItems, matronSecondaryItems, matronUser } from './matronNav'


const conversations = [
    { initials: 'EM', avatarClass: 'discipline', name: 'Mr. E. Mutabazi',   typeTag: 'Discipline', typeClass: 'discipline', time: '30 min',    preview: 'Thank you Mrs. Hakizimana. Please document this formally...', isUnread: true,  isActive: true,  isOnline: true  },
    { initials: 'NI', avatarClass: 'student',    name: 'Niyomugabo Iris',   typeTag: 'Student',    typeClass: 'student',    time: '2 hr',      preview: "I'm sorry Mrs. Hakizimana, it won't happen again.",            isUnread: false, isActive: false, isOnline: false },
    { initials: 'KP', avatarClass: 'parent',     name: 'Mr. Kayitesi P.',   typeTag: 'Parent',     typeClass: 'parent',     time: 'Yesterday', preview: "Thank you for the update about Ursula. We'll speak to her.",   isUnread: false, isActive: false, isOnline: false },
    { initials: 'RU', avatarClass: 'parent',     name: 'Mrs. Rugamba U.',   typeTag: 'Parent',     typeClass: 'parent',     time: '2 days',    preview: "Can you please confirm Nadine's absence on Friday?",           isUnread: false, isActive: false, isOnline: false },
]

const messages = [
    { type: 'sent',                                                              dateSep: 'Today', time: '7:12 AM', ticks: 'seen', text: "Good morning, Mr. Mutabazi. I need to report that Niyomugabo Iris (S2A) was found outside the dormitory at 10:47 PM during last night's curfew check. She was in the common room without permission." },
    { type: 'received', senderInitials: 'EM', senderAvatarClass: 'discipline', dateSep: null,    time: '7:28 AM', ticks: null,   text: 'Thank you Mrs. Hakizimana. Please document this formally and send me the written report. I will call Iris in this morning. This is her second dormitory violation this term.' },
]

export function MatronMessages() {
    return (
        <MessagesPage
            navItems={matronNavItems}
            secondaryItems={matronSecondaryItems}
            title="Messages"
            subtitle="Communicate with the Discipline Master, students & parents"
            userName="Mrs. Gloriose Hakizimana"
            userRole="Matron"
            userInitials="GH"
            avatarClass="matron-av"
            conversations={conversations}
            tabs={['All', 'Discipline', 'Students', 'Parents']}
            messages={messages}
            activeContact={{
                initials: 'EM', avatarClass: 'discipline',
                name: 'Mr. E. Mutabazi', typeTag: 'Discipline', typeClass: 'discipline',
                isOnline: true,
            }}
            composerPlaceholder="Type your message..."
        />
    )
}
