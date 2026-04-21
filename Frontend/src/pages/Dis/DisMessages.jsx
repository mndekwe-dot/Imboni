import { MessagesPage } from '../../components/messaging/MessagesPage'
import { disNavItems, disSecondaryItems, disUser } from './disNav'
import '../../styles/discipline.css'

const conversations = [
    { initials: 'GH', avatarClass: 'matron',  name: 'Mrs. G. Hakizimana', typeTag: 'Matron',  typeClass: 'matron',  time: '10 min',    preview: 'Niyomugabo Iris was found outside dormitory after curfew...', isUnread: true,  isActive: true,  isOnline: true  },
    { initials: 'JN', avatarClass: 'matron',  name: 'Mr. J. Nsabimana',   typeTag: 'Matron',  typeClass: 'matron',  time: '1 hr',      preview: 'Weekly incident report for Muhabura House submitted.',          isUnread: true,  isActive: false, isOnline: false },
    { initials: 'UA', avatarClass: 'student', name: 'Uwase Amina',         typeTag: 'Student', typeClass: 'student', time: 'Yesterday', preview: 'Thank you for the positive commendation, Mr. Mutabazi.',        isUnread: false, isActive: false, isOnline: false },
    { initials: 'GN', avatarClass: 'patron',  name: 'Mr. G. Nkurunziza',  typeTag: 'Patron',  typeClass: 'patron',  time: '2 days',    preview: 'Basketball match schedule confirmed for March 15.',              isUnread: false, isActive: false, isOnline: false },
    { initials: 'RP', avatarClass: 'parent',  name: 'Mr. R. Ndagijimana', typeTag: 'Parent',  typeClass: 'parent',  time: '3 days',    preview: "I'd like to discuss Eric's recent conduct record.",               isUnread: false, isActive: false, isOnline: false },
]

const messages = [
    { type: 'received', senderInitials: 'GH', senderAvatarClass: 'matron', dateSep: 'Today', time: '7:12 AM', ticks: null,   text: "Good morning, Mr. Mutabazi. I need to report that Niyomugabo Iris (S2A) was found outside the dormitory at 10:47 PM during last night's curfew check. She was in the common room without permission." },
    { type: 'sent',                                                           dateSep: null,    time: '7:28 AM', ticks: 'seen', text: 'Thank you Mrs. Hakizimana. Please document this formally and send me the written report. I will call Iris in this morning. This is her second dormitory violation this term.' },
    { type: 'received', senderInitials: 'GH', senderAvatarClass: 'matron', dateSep: null,    time: '7:35 AM', ticks: null,   text: "Understood. I'll have the written report to you by 9 AM. Should I also notify her class teacher Ms. Umutoni?" },
]

export function DisMessages() {
    return (
        <MessagesPage
            navItems={disNavItems}
            secondaryItems={disSecondaryItems}
            title="Messages"
            subtitle="Communicate with matrons, patrons, students & parents"
            {...disUser}
            conversations={conversations}
            tabs={['All', 'Matrons', 'Patrons', 'Students', 'Parents']}
            messages={messages}
            activeContact={{
                initials: 'GH', avatarClass: 'matron',
                name: 'Mrs. G. Hakizimana', typeTag: 'Matron', typeClass: 'matron',
                isOnline: true,
            }}
            composerPlaceholder="Type your message..."
        />
    )
}
