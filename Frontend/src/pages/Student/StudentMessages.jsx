import { MessagesPage } from '../../components/messaging/MessagesPage'
import '../../styles/student.css'
import { studentNavItems, studentSecondaryItems, studentUser } from './studentNav'


const conversations = [
    { initials: 'PR', avatarClass: 'teacher', name: 'Mr. Rurangwa',    typeTag: 'Teacher', typeClass: 'teacher', time: '5 min',     preview: 'Good work on your last quiz, Amina!',                isUnread: true,  isActive: true,  isOnline: true  },
    { initials: 'SU', avatarClass: 'teacher', name: 'Ms. Uwera',       typeTag: 'Teacher', typeClass: 'teacher', time: '1 hr',      preview: 'Your lab report is due today — please submit by 5 PM', isUnread: true, isActive: false, isOnline: false },
    { initials: 'CU', avatarClass: 'teacher', name: 'Ms. Umutoni',     typeTag: 'Teacher', typeClass: 'teacher', time: 'Yesterday', preview: 'Your essay outline was well-structured. Keep it up!',   isUnread: false, isActive: false, isOnline: false },
    { initials: 'TB', avatarClass: 'teacher', name: 'Mr. Bizimana',    typeTag: 'Teacher', typeClass: 'teacher', time: '2 days',    preview: "Don't forget to review Chapter 7 for next class",       isUnread: false, isActive: false, isOnline: false },
    { initials: 'JN', avatarClass: 'dos',     name: 'Dr. Ndagijimana', typeTag: 'DOS',     typeClass: 'dos',     time: '1 week',    preview: 'Congratulations on your Term 1 performance, Amina!',    isUnread: false, isActive: false, isOnline: false },
]

const messages = [
    { type: 'received', senderInitials: 'PR', senderAvatarClass: 'teacher', dateSep: 'Yesterday', time: '2:15 PM', ticks: null,   text: 'Hi Amina, I just finished reviewing your Quiz 3 paper. You scored 85% which is above the class average. Well done!' },
    { type: 'sent',                                                            dateSep: null,        time: '2:32 PM', ticks: 'seen', text: 'Thank you so much, Mr. Rurangwa! I worked really hard on the algebra section. I was a bit unsure about the geometry questions though.' },
    { type: 'received', senderInitials: 'PR', senderAvatarClass: 'teacher', dateSep: null,        time: '2:45 PM', ticks: null,   text: 'Your geometry was actually very good! You lost a few marks on the circle theorems. I would recommend reviewing Chapter 9. Come see me if you have questions.' },
    { type: 'received', senderInitials: 'PR', senderAvatarClass: 'teacher', dateSep: 'Today',     time: '8:05 AM', ticks: null,   text: 'Good work on your last quiz, Amina! Keep up the excellent effort. The CAT 3 is coming up on March 18, so start revising early.' },
]

export function StudentMessages() {
    return (
        <MessagesPage
            navItems={studentNavItems}
            secondaryItems={studentSecondaryItems}
            title="Messages"
            subtitle="Communicate with your teachers"
            userName="Uwase Amina"
            userRole="Student · S4A"
            userInitials="UA"
            avatarClass="student-av"
            conversations={conversations}
            tabs={['All', 'Unread', 'Teachers', 'Admin']}
            messages={messages}
            activeContact={{
                initials: 'PR', avatarClass: 'teacher',
                name: 'Mr. Rurangwa', typeTag: 'Teacher', typeClass: 'teacher',
                isOnline: true,
            }}
            composerPlaceholder="Type your message to your teacher..."
        />
    )
}
