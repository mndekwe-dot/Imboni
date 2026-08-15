export const studentNavItems = [
    { to: '/student',               icon: 'dashboard',      labelKey: 'nav.dashboard',     end: true },
    { to: '/student/results',       icon: 'assessment',     labelKey: 'nav.myResults'               },
    { to: '/student/attendance',    icon: 'fact_check',     labelKey: 'nav.attendance'               },
    { to: '/student/timetable',     icon: 'calendar_month', labelKey: 'nav.timetable'                },
    { to: '/student/assignments',   icon: 'assignment',     labelKey: 'nav.assignments'              },
    { to: '/student/activities',    icon: 'emoji_events',   labelKey: 'nav.activities'               },
    { to: '/student/discipline',    icon: 'gavel',          labelKey: 'nav.discipline'               },
    { to: '/student/announcements', icon: 'announcement',   labelKey: 'nav.announcements'            },
    { to: '/student/messages',      icon: 'chat',           labelKey: 'nav.messages'                 },
]

export const studentSecondaryItems = [
    { to: '/profile?role=student', icon: 'account_circle', labelKey: 'nav.profile' },
    { to: '/login',                icon: 'logout',         labelKey: 'nav.logout', action: 'logout'  },
]

import { notifications } from '../../data/notifications'

export const studentUser = {
    userName:      'Uwase Amina',
    userRole:      'Student · S4A',
    userInitials:  'UA',
    avatarClass:   'student-av',
    notifications: notifications.student,
}
