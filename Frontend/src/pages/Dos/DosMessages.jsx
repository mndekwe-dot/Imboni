import { MessagesPage } from '../../components/messaging/MessagesPage'
import '../../styles/dos.css'
import { dosNavItems, dosSecondaryItems, dosUser } from './dosNav'


const conversations = [
    { initials: 'CU', avatarClass: '',                                       name: 'Ms. Claudine Umutoni',  typeTag: 'English Teacher',           typeClass: '',  time: '12:45 PM',  preview: 'The S4 results are ready...',          isUnread: true,  isActive: true,  isOnline: true  },
    { initials: 'PR', avatarClass: '', avatarStyle: { background: '#64748b' }, name: 'Mr. Pacifique Rurangwa', typeTag: 'Mathematics Teacher',      typeClass: '',  time: 'Yesterday', preview: 'Can we reschedule the board meeting?', isUnread: false, isActive: false, isOnline: false },
]

const messages = [
    { type: 'received', senderInitials: 'CU', dateSep: 'February 13, 2026', time: '12:40 PM', ticks: null,   text: "Good afternoon, Doctor. I've finished compiling the S4 mid-term results for English." },
    { type: 'sent',                            dateSep: null,                time: '12:44 PM', ticks: 'seen', text: 'Great work, Claudine. Are there any significant drops in performance?' },
    { type: 'received', senderInitials: 'CU', dateSep: null,                time: '12:45 PM', ticks: null,   attachment: { fileName: 'S4_English_Results.pdf', fileSize: '2.4 MB' } },
]

export function DosMessages() {
    return (
        <MessagesPage
            navItems={dosNavItems}
            secondaryItems={dosSecondaryItems}
            title="Messages"
            subtitle="Communicate with teachers, staff and parents"
            userName="Dr. Jean-Claude Ndagijimana"
            userRole="Director of Studies"
            userInitials="JN"
            avatarClass="dos-av"
            conversations={conversations}
            tabs={['All', 'Teachers', 'Parents']}
            messages={messages}
            activeContact={{
                initials: 'CU', avatarClass: '',
                name: 'Ms. Claudine Umutoni', typeTag: 'English Teacher', typeClass: '',
                subtitle: 'Head of Mathematics Dept', isOnline: true,
            }}
            composerPlaceholder="Write a message to Ms. Claudine Umutoni..."
        />
    )
}
